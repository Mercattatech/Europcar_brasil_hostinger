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

/* ------------------------------------------------------------------ */
/* Consulta BIN — identifica a bandeira real a partir dos 6 primeiros  */
/* dígitos do cartão (mais confiável que adivinhar pelo primeiro dígito) */
/* ------------------------------------------------------------------ */

export interface BinInfo {
  /** Nome da bandeira como a Cielo retorna, ex: "Visa", "Master", "Amex", "Elo", "Diners" */
  brand: string;
  /** Sigla de 2 letras para o nó meanOfPayment do XRS */
  cardIssuer: string;
  foreignCard: boolean;
  corporateCard: boolean;
}

/** Bandeira Cielo → sigla de 2 letras usada pelo XRS (padrão IATA onde existe;
 *  Elo não tem código IATA oficial — confirmar com o time XRS/Europcar se
 *  precisar de um valor diferente de "EC"). */
const BRAND_TO_ISSUER: Record<string, string> = {
  visa: 'VI',
  master: 'CA',
  mastercard: 'CA',
  amex: 'AX',
  elo: 'EC',
  diners: 'DC',
  discover: 'DS',
  hipercard: 'HC',
  jcb: 'JC',
};

export function mapBrandToCardIssuer(brand: string): string {
  return BRAND_TO_ISSUER[(brand || '').toLowerCase().replace(/\s/g, '')] || 'VI';
}

/** Heurística de fallback pelo primeiro dígito — usada só se a Consulta BIN falhar */
export function guessBrandByFirstDigit(cardNumber: string): string {
  const d = cardNumber.charAt(0);
  return d === '4' ? 'Visa' : d === '5' ? 'Master' : d === '3' ? 'Amex' : 'Elo';
}

/**
 * Consulta BIN Cielo — GET /1/cardBin/{bin}. Identifica a bandeira real do
 * cartão pelos 6 primeiros dígitos, evitando erros de Payment.CreditCard.Brand
 * incorreto (que a Cielo recusa) quando o BIN não segue a heurística simples.
 */
export async function consultarBin(
  cardNumber: string,
  merchantId: string,
  merchantKey: string,
  isSandbox: boolean
): Promise<BinInfo | null> {
  const bin = cardNumber.replace(/\D/g, '').slice(0, 6);
  if (bin.length < 6) return null;

  const url = isSandbox
    ? `https://apiquerysandbox.cieloecommerce.cielo.com.br/1/cardBin/${bin}`
    : `https://apiquery.cieloecommerce.cielo.com.br/1/cardBin/${bin}`;

  try {
    const response = await axios.get(url, {
      headers: { MerchantId: merchantId, MerchantKey: merchantKey },
      timeout: 8000,
    });
    const provider = response.data?.Provider;
    if (!provider) return null;
    return {
      brand: provider,
      cardIssuer: mapBrandToCardIssuer(provider),
      foreignCard: !!response.data?.ForeignCard,
      corporateCard: !!response.data?.CorporateCard,
    };
  } catch (err: any) {
    console.warn('[Cielo] Consulta BIN falhou, usando heurística de fallback:', err.message);
    return null;
  }
}

/* ------------------------------------------------------------------ */
/* Zero Auth — valida se o cartão é funcional ANTES de autorizar ou    */
/* autenticar via 3DS, evitando processamentos inúteis no XRS quando   */
/* o cartão já nasce inválido.                                         */
/* ------------------------------------------------------------------ */

export interface ZeroAuthResult {
  valid: boolean;
  message?: string;
}

export async function zeroAuthCard(
  card: { number: string; holder: string; expirationDate: string; brand: string },
  merchantId: string,
  merchantKey: string,
  isSandbox: boolean
): Promise<ZeroAuthResult> {
  const url = isSandbox
    ? 'https://apisandbox.cieloecommerce.cielo.com.br/1/zeroauth/card'
    : 'https://api.cieloecommerce.cielo.com.br/1/zeroauth/card';

  try {
    const response = await axios.post(
      url,
      {
        CardNumber: card.number,
        Holder: card.holder,
        ExpirationDate: card.expirationDate,
        Brand: card.brand,
        SaveCard: false,
      },
      {
        headers: {
          'Content-Type': 'application/json',
          MerchantId: merchantId,
          MerchantKey: merchantKey,
        },
        timeout: 10000,
      }
    );
    // A Cielo retorna { Valid: true } quando o cartão passa na validação Zero Auth
    return { valid: response.data?.Valid !== false };
  } catch (err: any) {
    const data = err.response?.data;
    const msg = data?.Message || data?.[0]?.Message || err.message;
    console.warn('[Cielo] Zero Auth recusou o cartão:', msg);
    return { valid: false, message: msg };
  }
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

/* ------------------------------------------------------------------ */
/* Void / Estorno — cancela na Cielo o pagamento de uma reserva que foi */
/* cancelada. Mesmo endpoint da API 3.0 serve para Cartão e Pix.        */
/* ------------------------------------------------------------------ */

export interface VoidResult {
  success: boolean;
  message?: string;
  raw?: any;
}

export async function voidCieloPayment(
  paymentId: string,
  merchantId: string,
  merchantKey: string,
  isSandbox: boolean
): Promise<VoidResult> {
  const url = isSandbox
    ? `https://apisandbox.cieloecommerce.cielo.com.br/1/sales/${paymentId}/void`
    : `https://api.cieloecommerce.cielo.com.br/1/sales/${paymentId}/void`;

  try {
    const response = await axios.put(
      url,
      {},
      {
        headers: {
          'Content-Type': 'application/json',
          MerchantId: merchantId.trim(),
          MerchantKey: merchantKey.trim(),
        },
        timeout: 15000,
      }
    );

    // Status 10 = Voided, 11 = Refunded — ambos indicam estorno bem-sucedido
    const status = response.data?.Status;
    const success = status === 10 || status === 11 || response.status === 200;
    console.log(`[Cielo] Void ${paymentId} → HTTP ${response.status} | Status: ${status}`);
    return { success, raw: response.data };
  } catch (error: any) {
    const data = error.response?.data;
    const msg = data?.Message || data?.[0]?.Message || error.message;
    console.error(`[Cielo] Falha ao estornar ${paymentId}:`, msg);
    return { success: false, message: msg, raw: data };
  }
}
