import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import { callXRS } from '@/lib/europcar/xrsClient';
import { isValidXRSDate, isValidXRSTime } from '@/lib/europcar/validate';
import { escapeXml } from '@/lib/europcar/xmlEscape';
import { getReservationOwnerEmail } from '@/lib/europcar/ownership';
import prisma from '@/lib/prisma';
import { sendTransactionalEmail } from '@/lib/emailService';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      resNumber,
      pickupStationID, pickupDate, pickupTime,
      returnStationID, returnDate, returnTime,
      carCategory,
      firstName, lastName
    } = body;

    if (!resNumber) {
      return NextResponse.json({ error: 'resNumber é obrigatório para modificação' }, { status: 400 });
    }

    // Admin bypass: skip ownership check when called from admin panel
    const isAdminCall = request.headers.get('x-admin-modify') === 'true';

    if (!isAdminCall) {
      const session = await getServerSession(authOptions);
      if (!session?.user?.email) {
        return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
      }
      const ownerEmail = await getReservationOwnerEmail(resNumber);
      if (!ownerEmail || ownerEmail.toLowerCase() !== session.user.email.toLowerCase()) {
        return NextResponse.json({ error: 'Você não tem permissão para modificar esta reserva' }, { status: 403 });
      }
    }

    // Validate dates/times if provided
    if (pickupDate && !isValidXRSDate(pickupDate)) {
      return NextResponse.json({ error: 'Data de retirada inválida. Use o formato YYYYMMDD.' }, { status: 400 });
    }
    if (returnDate && !isValidXRSDate(returnDate)) {
      return NextResponse.json({ error: 'Data de devolução inválida. Use o formato YYYYMMDD.' }, { status: 400 });
    }
    if (pickupTime && !isValidXRSTime(pickupTime)) {
      return NextResponse.json({ error: 'Horário de retirada inválido. Use o formato HHMM.' }, { status: 400 });
    }
    if (returnTime && !isValidXRSTime(returnTime)) {
      return NextResponse.json({ error: 'Horário de devolução inválido. Use o formato HHMM.' }, { status: 400 });
    }

    // Build checkout block (pickup modifications)
    const checkoutParts: string[] = [];
    if (pickupStationID) checkoutParts.push(`stationID="${escapeXml(pickupStationID)}"`);
    if (pickupDate) checkoutParts.push(`date="${escapeXml(pickupDate)}"`);
    if (pickupTime) checkoutParts.push(`time="${escapeXml(pickupTime)}"`);
    const checkoutBlock = checkoutParts.length > 0
      ? `\n      <checkout ${checkoutParts.join(' ')}/>`
      : '';

    // Build checkin block (return modifications)
    const checkinParts: string[] = [];
    if (returnStationID) checkinParts.push(`stationID="${escapeXml(returnStationID)}"`);
    if (returnDate) checkinParts.push(`date="${escapeXml(returnDate)}"`);
    if (returnTime) checkinParts.push(`time="${escapeXml(returnTime)}"`);
    const checkinBlock = checkinParts.length > 0
      ? `\n      <checkin ${checkinParts.join(' ')}/>`
      : '';

    // Build reservation attributes
    const carCategoryAttr = carCategory ? ` carCategory="${escapeXml(carCategory)}"` : '';

    const xmlRequest = `<?xml version="1.0" encoding="UTF-8"?>
<message>
  <serviceRequest serviceCode="modifyReservation">
    <serviceParameters>
      <reservation resNumber="${escapeXml(resNumber)}"${carCategoryAttr}>${checkoutBlock}${checkinBlock}
      </reservation>
      <driver countryOfResidence="BR" firstName="${escapeXml(firstName || 'Passageiro')}" lastName="${escapeXml(lastName || 'Europcar')}" title="MR"/>
    </serviceParameters>
  </serviceRequest>
</message>`;

    const config = {
      callerCode: process.env.XRS_CALLER_CODE || 'DEMO',
      password: process.env.XRS_PASSWORD || 'DEMO',
      action: 'modifyReservation',
      sourceFile: 'modifyReservation/route.ts'
    };

    const xrsResponse = await callXRS(xmlRequest, config);

    const returnCode =
      xrsResponse?.message?.serviceResponse?.$?.returnCode ||
      xrsResponse?.message?.serviceResponse?.returnCode ||
      null;

    let errorMsg = 'Erro desconhecido na Europcar';
    const errors = xrsResponse?.message?.serviceResponse?.errors?.error || xrsResponse?.serviceResponse?.errors?.error;
    if (Array.isArray(errors)) {
      errorMsg = errors.map((e: any) => e.errorText || e.$?.errorText || '').join(' | ');
    } else if (errors) {
      errorMsg = errors.errorText || errors.$?.errorText || errorMsg;
    }
    
    if (errorMsg === 'Erro desconhecido na Europcar' || !errorMsg.trim()) {
      try {
        const rawErr = xrsResponse?.message?.serviceResponse?.errors || xrsResponse?.serviceResponse?.errors || xrsResponse;
        errorMsg = `Erro XRS (KO): ${JSON.stringify(rawErr).slice(0, 150)}`;
      } catch(e) {
        errorMsg = "Erro desconhecido na Europcar (XRS KO)";
      }
    }

    const hasError = returnCode && returnCode !== 'OK';

    // On success: sync local DB + send email
    if (!hasError) {
      try {
        const localRes = await prisma.localReservation.findFirst({
          where: { resNumber }
        });

        if (localRes) {
          // Sync local DB with modified fields
          const cd: any = typeof localRes.customerData === 'string'
            ? JSON.parse(localRes.customerData as string)
            : localRes.customerData;

          if (cd.booking) {
            if (pickupDate) cd.booking.pickupDate = pickupDate;
            if (pickupTime) cd.booking.pickupTime = pickupTime;
            if (pickupStationID) cd.booking.pickupStation = pickupStationID;
            if (returnDate) cd.booking.returnDate = returnDate;
            if (returnTime) cd.booking.returnTime = returnTime;
            if (returnStationID) cd.booking.returnStation = returnStationID;
            if (carCategory && cd.booking.car) cd.booking.car.carCategoryCode = carCategory;

            // Recalculate days if dates changed
            const pDate = cd.booking.pickupDate;
            const rDate = cd.booking.returnDate;
            if (pDate && rDate && pDate.length === 8 && rDate.length === 8) {
              const p = new Date(`${pDate.slice(0,4)}-${pDate.slice(4,6)}-${pDate.slice(6,8)}`);
              const r = new Date(`${rDate.slice(0,4)}-${rDate.slice(4,6)}-${rDate.slice(6,8)}`);
              const diffDays = Math.max(1, Math.round((r.getTime() - p.getTime()) / (1000 * 60 * 60 * 24)));
              cd.booking.days = diffDays;
            }
          }

          await prisma.localReservation.update({
            where: { id: localRes.id },
            data: { customerData: cd, updatedAt: new Date() }
          });

          // Send modification email
          if (cd.email) {
            await sendTransactionalEmail(cd.email, 'RESERVA_ALTERADA', {
              NOME: cd.nome || cd.firstName || '',
              SOBRENOME: cd.sobrenome || cd.lastName || '',
              NUMERO_RESERVA: resNumber,
              DATA_RETIRADA: cd.booking?.pickupDate || pickupDate || ''
            });
          }
        }
      } catch (syncErr: any) {
        console.error(`[modifyReservation] Erro ao sincronizar/enviar e-mail para ${resNumber}:`, syncErr.message);
      }
    }

    return NextResponse.json({
      success: !hasError,
      returnCode,
      error: hasError ? errorMsg : undefined,
      raw: xrsResponse
    });

  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Erro ao modificar reserva no XRS' },
      { status: 500 }
    );
  }
}
