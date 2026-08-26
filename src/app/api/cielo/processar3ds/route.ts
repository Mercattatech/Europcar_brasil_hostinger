import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { processPaymentWithToken, ThreeDsAuthData } from '@/lib/cielo/cieloClient';
export const dynamic = 'force-dynamic';

/**
 * POST /api/cielo/processar3ds
 * Processa autorização financeira após autenticação 3DS 2.2 concluída no frontend.
 * Recebe CAVV, XID e ECI do script Braspag MPI e inclui no nó ExternalAuthentication.
 *
 * Campos obrigatórios Cielo API 3.0 para 3DS:
 *   - EstablishmentCode (Erro 605) → config.establishmentCode
 *   - MerchantName      (Erro 606) → config.merchantName
 *   - MerchantCategoryCode (Erro 607) → config.mcc
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      amountInCents,
      cardToken,
      customerData,
      merchantOrderId,
      // Dados 3DS retornados pelo script Braspag MPI no frontend
      cavv,
      xid,
      eci,
      version,
      referenceId,
    } = body;

    if (!amountInCents || !cardToken || !merchantOrderId) {
      return NextResponse.json(
        { error: 'Parâmetros obrigatórios ausentes: amountInCents, cardToken, merchantOrderId' },
        { status: 400 }
      );
    }

    // Busca configuração Cielo do banco (inclui campos 3DS obrigatórios)
    const config = await prisma.cieloConfig.findFirst();
    if (!config?.merchantId || !config?.merchantKey) {
      return NextResponse.json(
        { error: 'Configuração Cielo não encontrada. Configure no painel admin.' },
        { status: 503 }
      );
    }

    // Avisa se campos 3DS obrigatórios não estão configurados
    if (!config.establishmentCode) {
      console.warn('[3DS] EstablishmentCode não configurado — Erro 605 provável. Configure no painel admin.');
    }

    const cieloConfig = {
      merchantId:        config.merchantId,
      merchantKey:       config.merchantKey,
      environment:       config.isSandbox ? 'sandbox' as const : 'production' as const,
      // Campos obrigatórios 3DS 2.2 (Erros 605, 606, 607)
      establishmentCode: config.establishmentCode || '',
      merchantName:      config.merchantName      || 'Europcar Brasil',
      mcc:               config.mcc               || '7512',
    };

    // Monta dados de autenticação 3DS se disponíveis
    const authData: ThreeDsAuthData | undefined = (cavv && xid && eci)
      ? { cavv, xid, eci, version: version || '2', referenceId }
      : undefined;

    if (!authData) {
      console.warn(`[3DS] Pedido ${merchantOrderId}: autorizando SEM autenticação 3DS (sem Liability Shift).`);
    }

    const result = await processPaymentWithToken(
      amountInCents,
      cardToken,
      customerData || { Name: 'Cliente Europcar' },
      merchantOrderId,
      cieloConfig,
      authData
    );

    const payment = result.Payment;
    const isApproved = payment?.Status === 1 || payment?.Status === 2;

    return NextResponse.json({
      success: isApproved,
      status:            payment?.Status,
      reasonCode:        payment?.ReasonCode,
      reasonMessage:     payment?.ReasonMessage,
      liabilityShift:    result.liabilityShift,
      paymentId:         payment?.PaymentId,
      authorizationCode: payment?.AuthorizationCode,
      eciApplied:        authData?.eci,
    });

  } catch (error: any) {
    console.error('[Cielo 3DS] Erro:', error.message);
    return NextResponse.json(
      { error: error.message || 'Erro ao processar pagamento 3DS' },
      { status: 500 }
    );
  }
}
