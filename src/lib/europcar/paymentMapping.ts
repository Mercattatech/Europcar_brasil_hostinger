// Monta os atributos de pagamento (prepaidMode/prepaidPercentage/prepaidAmount)
// e o nó <meanOfPayment> do bookReservation XRS a partir do método de
// pagamento escolhido no checkout. Centraliza a regra para não duplicar entre
// reservas/route.ts (fluxo síncrono: CREDIT/BALCAO/VOUCHER) e bookXRS.ts
// (fluxo assíncrono: PIX confirmado).

import { escapeXml } from '@/lib/europcar/xmlEscape';

export const CID_TO_BA: Record<string, string> = {
  '56935466': '73675595',  // ETO Líquido (Excesso)
  '56935495': '73804373',  // ETO Internacional (Excesso Zero)
};

export interface VoucherContext {
  type: string;           // 'ETO' | 'EXO' | 'EOTTO' | 'ETV' | ...
  id?: string;
  businessAccount?: string;
  iataNumber?: string;
}

export interface CreditCardGuaranteeContext {
  number: string;         // PAN — nunca logar em texto claro
  holderName: string;
  validity: string;       // MM/AAAA
  cardIssuer: string;     // sigla de 2 letras (VI/CA/AX/EC/DC...)
}

export interface PaymentAttrsContext {
  method: 'CREDIT' | 'PIX' | 'BALCAO' | 'VOUCHER';
  /** true quando a Cielo já capturou o pagamento (cartão cobrado agora, ou PIX confirmado) */
  captured: boolean;
  amountBRL?: number;
  creditCardGuarantee?: CreditCardGuaranteeContext;
  voucherData?: VoucherContext;
  contractID?: string;
  carCategory?: string;
  pickupDate?: string;    // YYYYMMDD
  returnDate?: string;    // YYYYMMDD
  /** MerchantOrderId da cobrança Cielo — usado como voucherID do nó VCH/PP quando captured=true */
  merchantOrderId?: string;
}

function voucherDurationDays(pickupDate?: string, returnDate?: string): number {
  if (!pickupDate || !returnDate) return 1;
  const d1 = new Date(parseInt(pickupDate.slice(0, 4)), parseInt(pickupDate.slice(4, 6)) - 1, parseInt(pickupDate.slice(6, 8)));
  const d2 = new Date(parseInt(returnDate.slice(0, 4)), parseInt(returnDate.slice(4, 6)) - 1, parseInt(returnDate.slice(6, 8)));
  // Vouchers têm limite de 30 dias de locação — o chamador deve validar isso
  // antes de reservar; aqui só calculamos a duração para o atributo do XRS.
  return Math.max(1, Math.round((d2.getTime() - d1.getTime()) / 86400000));
}

/** Constrói o fragmento <meanOfPayment typeCode="VCH" .../> para o bookReservation inicial.
 *  EXO não entra aqui: o voucher EXO é registrado depois via createVoucher (ver buildCreateVoucherXml). */
function buildVoucherMeanOfPaymentXml(voucherData: VoucherContext, contractID?: string, carCategory?: string, pickupDate?: string, returnDate?: string): string {
  if (!voucherData || voucherData.type === 'EXO') return '';
  const ba = (contractID && CID_TO_BA[contractID]) || voucherData.businessAccount || '';
  const duration = voucherDurationDays(pickupDate, returnDate);
  // Antonio/Europcar: voucherID must be numeric, max 8 digits
  const numericVoucherID = (voucherData.id && /^\d{1,8}$/.test(voucherData.id))
    ? voucherData.id
    : Date.now().toString().slice(-8);

  return `\n        <meanOfPayment typeCode="VCH" voucherType="${escapeXml(voucherData.type)}" voucherID="${escapeXml(numericVoucherID)}" businessAccount="${escapeXml(ba)}" voucherCarCategory="${escapeXml(carCategory || '')}" voucherRentalDuration="${escapeXml(duration)}"/>`;
}

export interface PaymentAttrsResult {
  /** Ex: ' prepaidMode="NP"' ou ' prepaidMode="PP" prepaidPercentage="100.00" prepaidAmountInBookingCurrency="123.45"' — vazio para voucher */
  prepaidAttrs: string;
  /** Fragmento XML do nó <meanOfPayment> (VCH ou CC), ou string vazia */
  meanOfPaymentXml: string;
}

export function buildReservationPaymentAttrs(ctx: PaymentAttrsContext): PaymentAttrsResult {
  // Voucher: o próprio nó VCH substitui o prepaidMode (exceto EXO, que segue o
  // fluxo padrão prepaidMode="NP" + createVoucher em uma segunda chamada).
  if (ctx.method === 'VOUCHER' && ctx.voucherData) {
    const meanOfPaymentXml = buildVoucherMeanOfPaymentXml(ctx.voucherData, ctx.contractID, ctx.carCategory, ctx.pickupDate, ctx.returnDate);
    const prepaidAttrs = ctx.voucherData.type === 'EXO' ? ' prepaidMode="NP"' : '';
    return { prepaidAttrs, meanOfPaymentXml };
  }

  // Pago online (PIX confirmado ou Cartão capturado pela Cielo):
  if (ctx.captured) {
    const isETO = ctx.contractID === '56935466' || ctx.contractID === '56935495';

    if (isETO) {
      // ETO (corporativo): meanOfPayment VCH vai DIRETO no bookReservationRQ.
      // Confirmado por Antonio/Europcar: createVoucher NÃO é suportado para ETO.
      // O erro mop.invalidVoucherNumber era causado por voucherID com mais de 8 dígitos.
      // voucherID: numérico, máximo 8 dígitos.
      const ba = CID_TO_BA[ctx.contractID!] || '';
      const duration = voucherDurationDays(ctx.pickupDate, ctx.returnDate);
      const voucherID = (ctx.merchantOrderId || '').replace(/\D/g, '').slice(0, 8)
                        || Date.now().toString().slice(-8);
      const meanOfPaymentXml = `\n        <meanOfPayment typeCode="VCH" voucherType="ETO" voucherID="${escapeXml(voucherID)}" businessAccount="${escapeXml(ba)}" voucherCarCategory="${escapeXml(ctx.carCategory || '')}" voucherRentalDuration="${escapeXml(duration)}"/>`;
      return { prepaidAttrs: '', meanOfPaymentXml };
    } else {
      // POA público: EXO (Europcar Brasil como agência IATA 02170722)
      // EXO exige prepaidMode="NP" no bookReservation e createVoucher separado depois.
      return { prepaidAttrs: ' prepaidMode="NP"', meanOfPaymentXml: '' };
    }
  }

  // Pagar na retirada: prepaidMode="NP". Se houver cartão de garantia (guarantee,
  // não cobrado agora), inclui o nó CC com cardmask="Y" para não expor o PAN.
  const cc = ctx.creditCardGuarantee;
  const meanOfPaymentXml = cc
    ? `\n        <meanOfPayment typeCode="CC" cardIssuer="${escapeXml(cc.cardIssuer)}" cardNumber="${escapeXml(cc.number)}" cardHolderName="${escapeXml(cc.holderName)}" validade="${escapeXml(cc.validity)}" cardmask="Y"/>`
    : '';
  return { prepaidAttrs: ' prepaidMode="NP"', meanOfPaymentXml };
}

/** Segunda etapa: registra o voucher ETO ou EXO no GreenWay após o resNumber existir.
 *  - ETO: usa businessAccount (BA) para faturamento corporativo
 *  - EXO: usa IATANumber para faturamento via agência
 *
 *  voucherCarCategory e voucherRentalDuration são obrigatórios pelo XRS — sem eles
 *  o createVoucher falha silenciosamente (erro só logado, não aborta a reserva),
 *  deixando a reserva sem split registrado no GW. Confirmado comparando com
 *  buildVoucherMeanOfPaymentXml (fluxo manual, já testado em homologação) e com
 *  a resposta real do GW em scratch/relatorio_homologacao.json, que sempre inclui
 *  esses dois atributos no meanOfPayment retornado. */
export function buildCreateVoucherXml(
  resNumber: string,
  voucherData: VoucherContext,
  voucherAmount: string,
  voucherCurrency: string,
  carCategory?: string,
  pickupDate?: string,
  returnDate?: string,
): string {
  const isETO = voucherData.type === 'ETO';

  // ETO: <meanOfPayment typeCode="VCH" voucherType="ETO" businessAccount="73675595" ...>
  // EXO: <meanOfPayment typeCode="VCH" voucherType="EXO" IATANumber="02170722" ...>
  const typeSpecificAttrs = isETO
    ? `businessAccount="${escapeXml(voucherData.businessAccount || '')}"`
    : `IATANumber="${escapeXml(voucherData.iataNumber || '02170722')}"`;
  const duration = voucherDurationDays(pickupDate, returnDate);

  return `<?xml version="1.0" encoding="UTF-8"?>
<message>
  <serviceRequest serviceCode="createVoucher">
    <serviceParameters>
      <reservation resNumber="${escapeXml(resNumber)}">
        <meanOfPayment typeCode="VCH" voucherType="${escapeXml(voucherData.type)}" ${typeSpecificAttrs} voucherAmount="${escapeXml(voucherAmount)}" voucherCurrency="${escapeXml(voucherCurrency)}" voucherCarCategory="${escapeXml(carCategory || '')}" voucherRentalDuration="${escapeXml(duration)}"/>
      </reservation>
    </serviceParameters>
  </serviceRequest>
</message>`;
}
