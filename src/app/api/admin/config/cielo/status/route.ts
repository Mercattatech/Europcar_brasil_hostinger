import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { checkAdmin } from "@/lib/checkAdmin";
export const dynamic = "force-dynamic";

/**
 * GET /api/admin/config/cielo/status
 * Diagnóstico completo: lê o config via Prisma (com todas as colunas) E
 * via raw SQL (apenas colunas base), e compara os dois resultados.
 * Usado para confirmar o estado real do banco em produção.
 */
export async function GET() {
  if (!(await checkAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const diagnostics: Record<string, any> = {};

  // Leitura via Prisma ORM (falha se migration não rodou)
  try {
    const config = await prisma.cieloConfig.findFirst();
    diagnostics.prisma = {
      ok: true,
      isSandbox: config?.isSandbox,
      merchantId: config?.merchantId ? `${config.merchantId.substring(0, 8)}...` : null,
      hasEstablishmentCode: !!config?.establishmentCode,
      hasMerchantName: !!config?.merchantName,
      hasMcc: !!config?.mcc,
    };
  } catch (err: any) {
    diagnostics.prisma = { ok: false, error: err.message };
  }

  // Leitura via raw SQL (sempre funciona com colunas antigas)
  try {
    const rows = await prisma.$queryRaw<any[]>`
      SELECT 
        "merchantId",
        "merchantKey",
        "isSandbox",
        "clientId3ds",
        "clientSecret3ds",
        "updatedAt"
      FROM "CieloConfig" 
      LIMIT 1
    `;
    diagnostics.rawQuery = {
      ok: true,
      isSandbox: rows[0]?.isSandbox,
      merchantId: rows[0]?.merchantId ? `${String(rows[0].merchantId).substring(0, 8)}...` : null,
      updatedAt: rows[0]?.updatedAt,
    };
  } catch (err: any) {
    diagnostics.rawQuery = { ok: false, error: err.message };
  }

  // Verifica se as novas colunas existem
  try {
    const colCheck = await prisma.$queryRaw<any[]>`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'CieloConfig' 
        AND column_name IN ('establishmentCode', 'merchantName', 'mcc')
    `;
    diagnostics.newColumns = {
      found: colCheck.length,
      expected: 3,
      migrationRun: colCheck.length === 3,
      columns: colCheck.map((c: any) => c.column_name),
    };
  } catch (err: any) {
    diagnostics.newColumns = { ok: false, error: err.message };
  }

  // Variáveis de ambiente (sem expor valores)
  diagnostics.envVars = {
    CIELO_MERCHANT_ID: !!process.env.CIELO_MERCHANT_ID ? '✅ definida' : '❌ ausente',
    CIELO_MERCHANT_KEY: !!process.env.CIELO_MERCHANT_KEY ? '✅ definida' : '❌ ausente',
    CIELO_SANDBOX: process.env.CIELO_SANDBOX ?? '❌ não definida (padrão: sandbox)',
  };

  // Qual URL seria usada pela reservas route
  const isSandboxFromRaw = diagnostics.rawQuery?.isSandbox;
  diagnostics.checkoutWouldUse = {
    isSandbox: isSandboxFromRaw,
    url: isSandboxFromRaw
      ? 'https://apisandbox.cieloecommerce.cielo.com.br/1/sales/ ❌ SANDBOX'
      : 'https://api.cieloecommerce.cielo.com.br/1/sales/ ✅ PRODUÇÃO',
  };

  return NextResponse.json(diagnostics, { status: 200 });
}
