import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
export const dynamic = 'force-dynamic';

/**
 * POST /api/cielo/get3dsToken
 * Solicita um Access Token temporário ao servidor Braspag MPI para iniciar
 * uma sessão de autenticação 3DS 2.2.
 *
 * O body da requisição deve conter, além de grant_type=client_credentials:
 *   - EstablishmentCode (Erro 605) — número de afiliação Cielo
 *   - MerchantName      (Erro 606) — nome fantasia do lojista
 *   - MCC               (Erro 607) — 7512 para Car Rental
 *
 * Ref: https://braspag.github.io/manual/emv3ds
 */
export async function POST() {
  try {
    const config = await prisma.cieloConfig.findFirst();

    if (!config?.clientId3ds || !config?.clientSecret3ds) {
      return NextResponse.json(
        { error: 'Credenciais 3DS (ClientId/ClientSecret Braspag) não configuradas no painel admin.' },
        { status: 503 }
      );
    }

    const isSandbox = config.isSandbox !== false;
    const authUrl = isSandbox
      ? 'https://mpisandbox.braspag.com.br/v2/auth/token'
      : 'https://mpi.braspag.com.br/v2/auth/token';

    const credentials = Buffer.from(`${config.clientId3ds.trim()}:${config.clientSecret3ds.trim()}`).toString('base64');

    // Campos obrigatórios para 3DS 2.2 — Erros 605, 606 e 607
    const establishmentCode = config.establishmentCode || '';
    const merchantName      = config.merchantName      || 'Europcar Brasil';
    const mcc               = config.mcc               || '7512';

    if (!establishmentCode) {
      console.warn('[3DS] EstablishmentCode não configurado — Erro 605 provável no Braspag MPI.');
    }

    // O Braspag MPI exige esses campos no body junto com grant_type
    const body = new URLSearchParams({
      grant_type:        'client_credentials',
      EstablishmentCode: establishmentCode,
      MerchantName:      merchantName,
      MCC:               mcc,
    });

    console.log(`[3DS] Solicitando token Braspag. EC: ${establishmentCode} | MCC: ${mcc} | Env: ${isSandbox ? 'sandbox' : 'production'}`);

    const response = await fetch(authUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${credentials}`,
      },
      body: body.toString(),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('[3DS] Falha ao obter Access Token Braspag:', err);
      return NextResponse.json(
        { error: `Falha ao autenticar com Braspag MPI (HTTP ${response.status}): ${err}` },
        { status: 502 }
      );
    }

    const data = await response.json();
    console.log(`[3DS] Access Token obtido. Expira em: ${data.expires_in}s`);

    return NextResponse.json({
      accessToken:  data.access_token,
      expiresIn:    data.expires_in,
      environment:  isSandbox ? 'sandbox' : 'production',
    });

  } catch (error: any) {
    console.error('[3DS] Erro ao solicitar token Braspag:', error.message);
    return NextResponse.json({ error: 'Erro interno ao solicitar token 3DS.' }, { status: 500 });
  }
}
