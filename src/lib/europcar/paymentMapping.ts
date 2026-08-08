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
  const numericVoucherID = (voucherData.id && /^\d+$/.test(voucherData.id))
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

  // Pago online (PIX confirmado ou Cartão capturado pela Cielo agora): informa ao XRS
  // que a tarifa já foi quitada antecipadamente (prepaidMode="PP").
  //
  // NÃO enviamos <meanOfPayment> para pagamentos capturados porque:
  // 1. O pagamento já foi processado pela Cielo — a Europcar não precisa cobrar novamente.
  // 2. typeCode="CC" com dados do cartão causa xrs.cctokenisationerror: o XRS tenta
  //    tokenizar o número em um serviço interno não habilitado nesse contrato.
  // 3. typeCode="VCH" voucherType="PP" era inválido (PP não existe na spec XRS).
  // → prepaidMode="PP" + prepaidPercentage + prepaidAmountInBookingCurrency já bastam.
  if (ctx.captured) {
    const amount = (ctx.amountBRL ?? 0).toFixed(2);
    return {
      prepaidAttrs: ` prepaidMode="PP" prepaidPercentage="100.00" prepaidAmountInBookingCurrency="${amount}"`,
      meanOfPaymentXml: '',
    };
  }

  // Pagar na retirada: prepaidMode="NP". Se houver cartão de garantia (guarantee,
  // não cobrado agora), inclui o nó CC com cardmask="Y" para não expor o PAN.
  const cc = ctx.creditCardGuarantee;
  const meanOfPaymentXml = cc
    ? `\n        <meanOfPayment typeCode="CC" cardIssuer="${escapeXml(cc.cardIssuer)}" cardNumber="${escapeXml(cc.number)}" cardHolderName="${escapeXml(cc.holderName)}" validade="${escapeXml(cc.validity)}" cardmask="Y"/>`
    : '';
  return { prepaidAttrs: ' prepaidMode="NP"', meanOfPaymentXml };
}

/** Segunda etapa do voucher EXO — registra o documento no GreenWay após o resNumber existir. */
export function buildCreateVoucherXml(resNumber: string, voucherData: VoucherContext, voucherAmount: string, voucherCurrency: string): string {
  const iataNumber = voucherData.iataNumber || '02170722';
  return `<?xml version="1.0" encoding="UTF-8"?>
<message>
  <serviceRequest serviceCode="createVoucher">
    <serviceParameters>
      <reservation resNumber="${escapeXml(resNumber)}">
        <meanOfPayment typeCode="VCH" voucherType="EXO" IATANumber="${escapeXml(iataNumber)}" voucherAmount="${escapeXml(voucherAmount)}" voucherCurrency="${escapeXml(voucherCurrency)}"/>
      </reservation>
    </serviceParameters>
  </serviceRequest>
</message>`;
}
