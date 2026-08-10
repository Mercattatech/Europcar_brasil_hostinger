/**
 * parsePayerList
 *
 * Extrai o split de pagamento do XML de resposta do XRS (chargesDetail="TRE").
 * O payerList retorna quem deve pagar o quê:
 *  - payer com dvrName → motorista (cobrado online pela Cielo)
 *  - payer com ba     → conta corporativa/agência (faturado separado)
 *
 * Estrutura XML (xml2js, explicitArray: false):
 *   reservation.quote.payerList.payer → array ou objeto único
 *     $.dvrName → indica pagador motorista
 *     $.ba      → indica conta corporativa
 *     $.dueToPayInBookingCurrency → valor na moeda da reserva (BRL para BR)
 *     $.dueToPay                  → valor na moeda da locação (EUR para internacionais)
 */

export interface PayerSplit {
  /** Valor que o motorista paga ONLINE em BRL (enviar para a Cielo) */
  driverDueBRL: number;
  /** Valor que a conta corporativa paga (faturado separado, NÃO vai para a Cielo) */
  businessDueBRL: number;
  /** Valor motorista na moeda da locação (EUR para internacionais) */
  driverDueXRS: number;
  /** Origem do split — para logging */
  source: 'payerList' | 'fallback';
}

/**
 * Tenta extrair o split de pagamento do payerList do XRS.
 * Retorna null se o payerList não estiver disponível na resposta.
 *
 * @param xrsReservationNode - O nó `reservation` da resposta XRS parseada pelo xml2js
 */
export function parsePayerList(xrsReservationNode: any): PayerSplit | null {
  try {
    const quote = xrsReservationNode?.quote;
    if (!quote) return null;

    const payerListNode = quote.payerList;
    if (!payerListNode) return null;

    const rawPayers = payerListNode.payer;
    if (!rawPayers) return null;

    const payers = Array.isArray(rawPayers) ? rawPayers : [rawPayers];

    let driverDueBRL = 0;
    let businessDueBRL = 0;
    let driverDueXRS = 0;
    let hasDriverPayer = false;
    let hasBusinessPayer = false;

    for (const p of payers) {
      const attrs = p.$ || p;
      const dueBRL = parseFloat(attrs.dueToPayInBookingCurrency || '0');
      const dueXRS = parseFloat(attrs.dueToPay || '0');

      if ('dvrName' in attrs || attrs.dvrName !== undefined) {
        // Motorista — este é o valor que vai para a Cielo
        driverDueBRL += dueBRL;
        driverDueXRS += dueXRS;
        hasDriverPayer = true;
      } else if ('ba' in attrs || attrs.ba !== undefined) {
        // Conta corporativa — NÃO vai para a Cielo
        businessDueBRL += dueBRL;
        hasBusinessPayer = true;
      }
    }

    // Se não encontrou nenhum pagador reconhecível, retorna null
    if (!hasDriverPayer && !hasBusinessPayer) return null;

    return {
      driverDueBRL,
      businessDueBRL,
      driverDueXRS,
      source: 'payerList',
    };
  } catch (e) {
    return null;
  }
}

/**
 * Parseia o chargeList para retornar os itens individuais com quem paga cada um.
 * Útil para exibição detalhada no checkout.
 */
export interface ChargeLine {
  type: string;
  description: string;
  priceBRL: number;
  priceXRS: number;
  paidBy: 'driver' | 'business' | 'unknown';
}

export function parseChargeList(xrsReservationNode: any): ChargeLine[] {
  try {
    const quote = xrsReservationNode?.quote;
    if (!quote) return [];

    const rawLines = quote.chargeList?.chargeLine;
    if (!rawLines) return [];

    const lines = Array.isArray(rawLines) ? rawLines : [rawLines];

    return lines.map((line: any): ChargeLine => {
      const a = line.$ || line;
      const payerAttrs = line.payer?.$ || line.payer || {};

      let paidBy: 'driver' | 'business' | 'unknown' = 'unknown';
      if ('dvrName' in payerAttrs) paidBy = 'driver';
      else if ('ba' in payerAttrs) paidBy = 'business';

      return {
        type: a.chrgTy || '',
        description: a.chrgTyDesc || '',
        priceBRL: parseFloat(a.priceInBookingCurrency || '0'),
        priceXRS: parseFloat(a.price || '0'),
        paidBy,
      };
    });
  } catch {
    return [];
  }
}
