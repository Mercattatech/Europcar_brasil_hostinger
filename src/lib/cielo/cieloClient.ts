import axios from 'axios';

export interface CieloConfig {
  merchantId: string;
  merchantKey: string;
  environment?: 'sandbox' | 'production';
  /** Número de afiliação Cielo — obrigatório para 3DS 2.2 (Erro 605) */
  establishmentCode?: string;
  /** Nome fantasia exibido na tela de autenticação 3DS (Erro 606) */
  merchantName?: string;
  /** Merchant Category Code — 7512 para Car Rental (Erro 607) */
  mcc?: string;
}

export interface CustomerData {
  Name: string;
  Email?: string;
  Identity?: string; // CPF
  IdentityType?: string; // "CPF"
  Address?: {
    Street: string;
    Number: string;
    Complement?: string;
    ZipCode: string;
    City: string;
    State: string;
    Country: string;
  };
}

export interface CreditCardTokenRequest {
  CustomerName: string;
  CardNumber: string; // PAN — nunca logado
  Holder: string;
  ExpirationDate: string; // MM/YYYY
  Brand: string;
}

/** Dados retornados pelo script Braspag MPI após autenticação 3DS 2.2 */
export interface ThreeDsAuthData {
  cavv: string;          // Cardholder Authentication Verification Value
  xid: string;           // Transaction Identifier
  eci: string;           // Electronic Commerce Indicator (05=Visa auth, 02=MC auth)
  version: string;       // Versão do protocolo: "2" para 3DS 2.2
  referenceId?: string;  // ReferenceID retornado pelo Braspag
}

/** ECI codes que garantem Liability Shift para o banco emissor */
const LIABILITY_SHIFT_ECI = new Set(['02', '05', '2', '5']);

/** Máscara de token: exibe apenas os últimos 4 chars */
function maskToken(token: string): string {
  if (!token || token.length < 4) return '****';
  return `****${token.slice(-4)}`;
}

export async function createCreditCardToken(
  requestData: CreditCardTokenRequest,
  config: CieloConfig
) {
  const isSandbox = config.environment !== 'production';
  const url = isSandbox
    ? 'https://apiquerysandbox.cieloecommerce.cielo.com.br/1/card'
    : 'https://api.cieloecommerce.cielo.com.br/1/card';

  // REGRA DE OURO: PAN nunca é logado — apenas o nome do titular
  console.log(`[Cielo] Tokenizando cartão para titular: ${requestData.Holder}`);

  try {
    const response = await axios.post(url, requestData, {
      headers: {
        'Content-Type': 'application/json',
        'MerchantId': config.merchantId,
        'MerchantKey': config.merchantKey,
      },
      timeout: 10000,
    });

    console.log(`[Cielo] Token gerado: ${maskToken(response.data.CardToken)}`);
    return response.data;
  } catch (error: any) {
    console.error(`[Cielo] Falha na tokenização:`, error.message);
    if (error.response) {
      console.error(`[Cielo] Detalhes:`, JSON.stringify(error.response.data));
    }
    throw new Error('Não foi possível validar o cartão de crédito.');
  }
}

export async function processPaymentWithToken(
  amountInCents: number,
  cardToken: string,
  customerData: CustomerData,
  merchantOrderId: string,
  config: CieloConfig,
  authData?: ThreeDsAuthData  // 3DS 2.2 — opcional mas fortemente recomendado
) {
  const isSandbox = config.environment !== 'production';
  const url = isSandbox
    ? 'https://apisandbox.cieloecommerce.cielo.com.br/1/sales'
    : 'https://api.cieloecommerce.cielo.com.br/1/sales';

  const hasLiabilityShift = authData ? LIABILITY_SHIFT_ECI.has(authData.eci) : false;

  // Campos obrigatórios para 3DS 2.2 — Erros 605, 606 e 607
  const establishmentCode = config.establishmentCode || '';
  const merchantName      = config.merchantName      || 'Europcar Brasil';
  const mcc               = config.mcc               || '7512'; // Car Rental Agencies

  if (!establishmentCode) {
    console.warn('[Cielo] AVISO: EstablishmentCode não configurado — pode causar Erro 605 no 3DS.');
  }

  const payload: any = {
    MerchantOrderId: merchantOrderId,
    // Campos obrigatórios 3DS 2.2 (Erros 605 / 606 / 607)
    MerchantName:         merchantName,
    EstablishmentCode:    establishmentCode,
    MerchantCategoryCode: mcc,
    Customer: customerData,
    Payment: {
      Type: 'CreditCard',
      Amount: amountInCents,
      Installments: 1,
      SoftDescriptor: 'EUROPCAR', // Nome na fatura do cliente
      CreditCard: {
        CardToken: cardToken,
      },
    },
  };

  // Inclui nó de autenticação 3DS quando disponível (garante Liability Shift)
  if (authData) {
    payload.Payment.ExternalAuthentication = {
      Cavv:        authData.cavv,
      Xid:         authData.xid,
      Eci:         authData.eci,
      Version:     authData.version,
      ReferenceID: authData.referenceId || '',
    };
  }

  console.log(
    `[Cielo] Autorizando pagamento. Pedido: ${merchantOrderId} | ` +
    `Valor: ${amountInCents} centavos | Token: ${maskToken(cardToken)} | ` +
    `EC: ${establishmentCode} | MCC: ${mcc} | ` +
    `3DS: ${authData ? `ECI=${authData.eci} LiabilityShift=${hasLiabilityShift}` : 'NÃO'}`
  );

  try {
    const response = await axios.post(url, payload, {
      headers: {
        'Content-Type': 'application/json',
        'MerchantId':  config.merchantId,
        'MerchantKey': config.merchantKey,
      },
      timeout: 20000,
    });

    const payment = response.data.Payment;
    console.log(
      `[Cielo] Transação processada. Status: ${payment.Status} | ` +
      `ReasonCode: ${payment.ReasonCode} | LiabilityShift: ${hasLiabilityShift}`
    );

    return { ...response.data, liabilityShift: hasLiabilityShift };
  } catch (error: any) {
    console.error(`[Cielo] Falha no pagamento:`, error.message);
    if (error.response) {
      console.error(`[Cielo] Detalhes:`, JSON.stringify(error.response.data));
      // Repassa a mensagem exata da Cielo para facilitar diagnóstico no frontend
      const cieloMsg =
        error.response.data?.Payment?.ReturnMessage ||
        error.response.data?.[0]?.Message ||
        error.message;
      throw new Error(
        `Transação Recusada pela Operadora: HTTP ${error.response.status} (${error.response.statusText}): ${cieloMsg}`
      );
    }
    throw new Error('Transação financeira recusada ou falhou.');
  }
}
