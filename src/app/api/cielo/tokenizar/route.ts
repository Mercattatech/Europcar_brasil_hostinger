import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import axios from 'axios';
export const dynamic = 'force-dynamic';

/**
 * POST /api/cielo/tokenizar
 * 1. Zero Auth — valida o cartão sem cobrança real antes de tokenizar.
 * 2. Tokenização — cria o CardToken para uso seguro em processar3ds.
 *
 * REGRA DE OURO: O PAN (número do cartão) nunca é logado neste servidor.
 *
 * Body esperado:
 *   { cardNumber, holder, expirationDate (MM/YYYY), brand, cvv? }
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { cardNumber, holder, expirationDate, brand, cvv } = body;

    if (!cardNumber || !holder || !expirationDate || !brand) {
      return NextResponse.json(
        { error: 'Campos obrigatórios: cardNumber, holder, expirationDate, brand' },
        { status: 400 }
      );
    }

    const config = await prisma.cieloConfig.findFirst();
    if (!config?.merchantId || !config?.merchantKey) {
      return NextResponse.json(
        { error: 'Configuração Cielo não encontrada. Configure no painel admin.' },
        { status: 503 }
      );
    }

    const isSandbox = config.isSandbox !== false;
    const baseUrl = isSandbox
      ? 'https://apisandbox.cieloecommerce.cielo.com.br'
      : 'https://api.cieloecommerce.cielo.com.br';
    const queryUrl = isSandbox
      ? 'https://apiquerysandbox.cieloecommerce.cielo.com.br'
      : 'https://api.cieloecommerce.cielo.com.br';

    const headers = {
      'Content-Type': 'application/json',
      'MerchantId':   config.merchantId,
      'MerchantKey':  config.merchantKey,
    };

    // ---------------------------------------------------------------
    // Etapa 1: Zero Auth — valida o cartão sem gerar cobrança
    // ---------------------------------------------------------------
    console.log(`[Cielo] Zero Auth iniciado para titular: ${holder}`);
    try {
      const zeroAuthRes = await axios.post(
        `${baseUrl}/1/zeroauth`,
        {
          CardType:       'CreditCard',
          CardNumber:     cardNumber,
          Holder:         holder,
          ExpirationDate: expirationDate,
          SecurityCode:   cvv || '000',
          Brand:          brand,
          SaveCard:       false,
        },
        { headers, timeout: 10000 }
      );

      const zeroAuthData = zeroAuthRes.data;
      console.log(`[Cielo] Zero Auth resultado: Valid=${zeroAuthData?.Valid}`);

      if (zeroAuthData?.Valid === false) {
        return NextResponse.json(
          { error: 'Cartão inválido ou não autorizado para esta operação (Zero Auth recusado).' },
          { status: 422 }
        );
      }
    } catch (zaErr: any) {
      // Zero Auth pode não estar habilitado em todos os MIDs — continua se der 404
      if (zaErr.response?.status !== 404) {
        console.warn(`[Cielo] Zero Auth falhou (${zaErr.response?.status}): ${zaErr.message}`);
      }
    }

    // ---------------------------------------------------------------
    // Etapa 2: Tokenização do cartão
    // ---------------------------------------------------------------
    console.log(`[Cielo] Tokenizando cartão para titular: ${holder}`);
    const tokenRes = await axios.post(
      `${queryUrl}/1/card`,
      {
        CustomerName:   holder,
        CardNumber:     cardNumber,
        Holder:         holder,
        ExpirationDate: expirationDate,
        Brand:          brand,
      },
      { headers, timeout: 10000 }
    );

    const cardToken = tokenRes.data?.CardToken;
    if (!cardToken) {
      return NextResponse.json(
        { error: 'Falha ao gerar token do cartão. Verifique os dados informados.' },
        { status: 422 }
      );
    }

    console.log(`[Cielo] Token gerado: ****${cardToken.slice(-4)}`);

    return NextResponse.json({
      success:   true,
      cardToken,
      brand,
      lastDigits: cardNumber.slice(-4),
    });

  } catch (error: any) {
    console.error('[Cielo Tokenizar] Erro:', error.message);
    if (error.response) {
      console.error('[Cielo Tokenizar] Detalhes:', JSON.stringify(error.response.data));
      const msg = error.response.data?.[0]?.Message || error.message;
      return NextResponse.json(
        { error: `Erro Cielo (HTTP ${error.response.status}): ${msg}` },
        { status: 422 }
      );
    }
    return NextResponse.json(
      { error: 'Erro interno ao processar cartão.' },
      { status: 500 }
    );
  }
}
