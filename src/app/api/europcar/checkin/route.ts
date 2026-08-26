import { NextResponse } from 'next/server';
import { callXRS } from '@/lib/europcar/xrsClient';
import { escapeXml } from '@/lib/europcar/xmlEscape';
import { getReservationOwnerEmail } from '@/lib/europcar/ownership';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      resNumber,
      firstName,
      lastName,
      email,
      phone,
      cpf,
      cnhNumero,
      cnhValidade,
      cnhCidade,
      paisEmissao,
    } = body;

    if (!resNumber) {
      return NextResponse.json(
        { error: 'Número da reserva é obrigatório' },
        { status: 400 }
      );
    }

    if (!firstName || !lastName || !email) {
      return NextResponse.json(
        { error: 'Nome, sobrenome e e-mail são obrigatórios' },
        { status: 400 }
      );
    }

    const ownerEmail = await getReservationOwnerEmail(resNumber);
    if (!ownerEmail || ownerEmail.toLowerCase() !== String(email).toLowerCase()) {
      return NextResponse.json({ error: 'Email não corresponde à reserva' }, { status: 403 });
    }

    const dCpf = (cpf || '').replace(/\D/g, '').slice(0, 11);
    const dPhone = phone || '';
    const country = paisEmissao || 'BR';

    // Build licenseList XML only if CNH data is provided
    let licenseListXml = '';
    if (cnhNumero || cnhValidade) {
      // Convert MM/YYYY → YYYYMMDD (use day 01 as default)
      let expirationDate = '';
      if (cnhValidade) {
        const parts = cnhValidade.replace(/\D/g, '/').split('/');
        if (parts.length === 2) {
          const [mm, yyyy] = parts;
          const year = yyyy.length === 2 ? `20${yyyy}` : yyyy;
          expirationDate = `${year}${mm.padStart(2, '0')}01`;
        } else if (parts.length === 3) {
          // DD/MM/YYYY format
          const [dd, mm, yyyy] = parts;
          const year = yyyy.length === 2 ? `20${yyyy}` : yyyy;
          expirationDate = `${year}${mm.padStart(2, '0')}${dd.padStart(2, '0')}`;
        }
      }

      licenseListXml = `
        <licenseList>
          <license licenseNumber="${escapeXml(cnhNumero || '')}"${expirationDate ? ` expirationDate="${escapeXml(expirationDate)}"` : ''}${cnhCidade ? ` cityOfIssuance="${escapeXml(cnhCidade)}"` : ''} countryOfIssuance="${escapeXml(country)}"/>
        </licenseList>`;
    }

    const createDriverXml = `<?xml version="1.0" encoding="UTF-8"?>
<message>
  <serviceRequest serviceCode="createDriver">
    <serviceParameters>
      <reservation resNumber="${escapeXml(resNumber)}"/>
      <driver isoLanguage="pt_BR" firstName="${escapeXml(firstName.trim())}" lastName="${escapeXml(lastName.trim())}" title="MR">
        <addressList>
          <address addressType="P" addressKind="D" addressCountry="${escapeXml(country)}">
            <emails>
              <email emailAddress="${escapeXml(email.trim())}" type="M"/>
            </emails>
            <phones>
              <phone phoneNumber="${escapeXml(dPhone)}" phoneType="M"/>
            </phones>
          </address>
        </addressList>
        <legalIdList>
          <legalId idTy="P" docNumber="${escapeXml(dCpf)}" country="${escapeXml(country)}"/>
        </legalIdList>${licenseListXml}
      </driver>
    </serviceParameters>
  </serviceRequest>
</message>`;

    const xrsResponse = await callXRS(createDriverXml, {
      callerCode: process.env.XRS_CALLER_CODE || 'DEMO',
      password: process.env.XRS_PASSWORD || 'DEMO',
      action: 'createDriver',
      sourceFile: 'checkin/route.ts',
    });

    // Extract driverID from response if available
    const driverNode =
      xrsResponse?.message?.serviceResponse?.driver ||
      xrsResponse?.serviceResponse?.driver;
    const driverID = driverNode?.$?.driverID || driverNode?.driverID || null;

    return NextResponse.json({
      success: true,
      driverID,
      resNumber,
      raw: xrsResponse,
    });
  } catch (error: any) {
    console.error('[checkin] Erro no createDriver:', error.message);
    return NextResponse.json(
      { error: error.message || 'Erro ao processar check-in online' },
      { status: 500 }
    );
  }
}
