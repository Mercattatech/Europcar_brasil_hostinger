import { NextResponse } from 'next/server';
import { callXRS } from '@/lib/europcar/xrsClient';
import prisma from '@/lib/prisma';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      carCategory, rateId,
      pickupStation, returnStation,
      pickupDate, returnDate,
      pickupTime, returnTime,
      driverData, paymentData, contractID,
      voucherData
    } = body;

    if (!carCategory || !rateId) {
      return NextResponse.json({ error: 'carCategory e rateId são obrigatórios' }, { status: 400 });
    }

    // Build contractID attribute if promotion is active
    const contractAttr = contractID ? ` contractID="${contractID}" type="C"` : '';

    // CID to BA mapping for ETO vouchers provided by Ewa
    const cidToBa: Record<string, string> = {
      '56935466': '73675595',
      '56935495': '73804373'
    };

    let meanOfPaymentXml = '';
    if (voucherData && voucherData.type === 'ETO') {
      const ba = cidToBa[contractID] || voucherData.businessAccount || '';
      // Calculate duration in days for the voucher
      const d1 = new Date(parseInt(pickupDate.slice(0,4)), parseInt(pickupDate.slice(4,6))-1, parseInt(pickupDate.slice(6,8)));
      const d2 = new Date(parseInt(returnDate.slice(0,4)), parseInt(returnDate.slice(4,6))-1, parseInt(returnDate.slice(6,8)));
      const duration = Math.max(1, Math.round((d2.getTime() - d1.getTime()) / 86400000));

      meanOfPaymentXml = `
        <meanOfPayment typeCode="VCH" voucherType="ETO" voucherID="${voucherData.id || '1234'}"
                       businessAccount="${ba}" voucherCarCategory="${carCategory}"
                       voucherRentalDuration="${duration}"/>`;
    }

    const xmlRequest = `<?xml version="1.0" encoding="UTF-8"?>
<message>
  <serviceRequest serviceCode="bookReservation">
    <serviceParameters>
      <reservation carCategory="${carCategory}" rateId="${rateId}" chargesDetail="TRE" prepaidMode="NP"${contractAttr}>
        <checkout stationID="${pickupStation}" date="${pickupDate}" time="${pickupTime || '1000'}"/>
        <checkin stationID="${returnStation || pickupStation}" date="${returnDate}" time="${returnTime || '1000'}"/>
        <equipmentList/>${meanOfPaymentXml}
      </reservation>
      <driver countryOfResidence="BR"
              firstName="${driverData?.firstName || 'Test'}"
              lastName="${driverData?.lastName || 'Client'}"
              title="${driverData?.title || 'MR'}"/>
    </serviceParameters>
  </serviceRequest>
</message>`;

    const config = {
      callerCode: process.env.XRS_CALLER_CODE || 'DEMO',
      password: process.env.XRS_PASSWORD || 'DEMO',
      action: 'bookReservation',
      sourceFile: 'bookReservation/route.ts'
    };

    const xrsResponse = await callXRS(xmlRequest, config);

    // Extract reservation number from response
    const resNumber =
      xrsResponse?.message?.serviceResponse?.reservation?.$?.resNumber ||
      xrsResponse?.serviceResponse?.reservation?.$?.resNumber ||
      null;

    // Save local reservation record
    if (paymentData) {
      await prisma.localReservation.create({
        data: {
          resNumber: resNumber || `LOCAL_${Date.now()}`,
          merchantOrderId: paymentData.merchantOrderId || `ORDER_${Date.now()}`,
          customerData: JSON.stringify({
            ...driverData,
            contractID: contractID || null,
            carCategory,
          }),
          status: paymentData.paid ? 'CONFIRMED_PREPAID' : 'CONFIRMED_NON_PREPAID'
        }
      });
    }

    return NextResponse.json({
      success: true,
      resNumber,
      raw: xrsResponse
    });

  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Erro ao consultar XRS bookReservation' },
      { status: 500 }
    );
  }
}
