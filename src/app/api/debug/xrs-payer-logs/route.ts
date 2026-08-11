import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Rota temporária para diagnóstico do payerList no XRS
// Acesse: GET /api/debug/xrs-payer-logs
export async function GET() {
  try {
    const logs = await (prisma as any).logXRS.findMany({
      where: {
        action: { in: ['bookReservation', 'getQuote'] },
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: {
        id: true,
        action: true,
        hasError: true,
        httpStatus: true,
        createdAt: true,
        xmlRequest: true,
        xmlResponse: true,
      },
    });

    const analyzed = logs.map((log: any) => {
      const resp = log.xmlResponse || '';
      const req  = log.xmlRequest  || '';
      return {
        id:           log.id,
        action:       log.action,
        hasError:     log.hasError,
        httpStatus:   log.httpStatus,
        createdAt:    log.createdAt,
        // Detecta se TRE foi enviado na request
        sentTRE:      req.includes('chargesDetail="TRE"') || req.includes("chargesDetail='TRE'"),
        // Detecta se payerList veio na response
        hasPayerList: resp.includes('payerList') || resp.includes('payerlist'),
        // Detecta o split de texto que o GW mostra
        hasDriverAmount:   resp.includes('AMOUNT TO BE PAID BY THE DRIVER') || resp.includes('dueToPayInBookingCurrency'),
        hasBAAmount:       resp.includes('AMOUNT TO BE INVOICED TO BA') || resp.includes('ba='),
        // Trecho relevante da response (payerList ou erro)
        payerListSnippet: (() => {
          const idx = resp.indexOf('payerList');
          if (idx === -1) return null;
          return resp.substring(Math.max(0, idx - 50), Math.min(resp.length, idx + 800));
        })(),
        // Trecho do erro se houver
        errorSnippet: log.hasError
          ? resp.substring(0, 500)
          : null,
      };
    });

    return NextResponse.json({ ok: true, count: analyzed.length, logs: analyzed });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
