import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const config = await prisma.cieloConfig.findFirst();
    if (!config) {
      return NextResponse.json({
        merchantId: '', merchantKey: '', isSandbox: true,
        clientId3ds: '', clientSecret3ds: '',
        establishmentCode: '', merchantName: 'Europcar Brasil', mcc: '7512',
      });
    }
    return NextResponse.json(config);
  } catch {
    // Fallback: lê apenas colunas base se migration das colunas novas não rodou
    try {
      const rows = await prisma.$queryRaw<any[]>`
        SELECT "id", "merchantId", "merchantKey", "isSandbox", "clientId3ds", "clientSecret3ds", "updatedAt"
        FROM "CieloConfig" LIMIT 1
      `;
      if (rows.length > 0) return NextResponse.json(rows[0]);
    } catch {}
    return NextResponse.json({});
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    // .trim() em todas as credenciais — copiar/colar do portal Cielo/Braspag costuma
    // trazer espaço ou quebra de linha invisível no fim, que alguns endpoints da Cielo
    // toleram (ex: /1/card) e outros rejeitam com 401 (ex: /1/sales), gerando o sintoma
    // enganoso de "credenciais válidas no teste, mas pagamento real recusado".
    const trim = (v: any) => (typeof v === 'string' ? v.trim() : v);
    const merchantId = trim(body.merchantId);
    const merchantKey = trim(body.merchantKey);
    const isSandbox = body.isSandbox;
    const clientId3ds = trim(body.clientId3ds);
    const clientSecret3ds = trim(body.clientSecret3ds);
    const establishmentCode = trim(body.establishmentCode);
    const merchantName = trim(body.merchantName);
    const mcc = trim(body.mcc);

    // Busca registro existente
    let existingId: string | null = null;
    try {
      const existing = await prisma.cieloConfig.findFirst({ select: { id: true } });
      existingId = existing?.id ?? null;
    } catch {
      const rows = await prisma.$queryRaw<any[]>`SELECT "id" FROM "CieloConfig" LIMIT 1`;
      existingId = rows[0]?.id ?? null;
    }

    // Tenta salvar com TODAS as colunas via Prisma ORM
    try {
      const data = {
        merchantId,
        merchantKey,
        isSandbox: isSandbox === true || isSandbox === 'true',
        clientId3ds:       clientId3ds       || null,
        clientSecret3ds:   clientSecret3ds   || null,
        establishmentCode: establishmentCode || null,
        merchantName:      merchantName      || 'Europcar Brasil',
        mcc:               mcc               || '7512',
      };

      const config = existingId
        ? await prisma.cieloConfig.update({ where: { id: existingId }, data })
        : await prisma.cieloConfig.create({ data });

      return NextResponse.json({ ...config, _savedVia: 'prisma' });

    } catch (prismaErr: any) {
      console.warn('[CieloConfig] Prisma save falhou (migration pendente?):', prismaErr.message);

      // FALLBACK ROBUSTO: raw SQL com apenas as colunas que existem em todas as versões
      const isSandboxBool = isSandbox === true || isSandbox === 'true';
      const safeClientId  = clientId3ds      || null;
      const safeSecret    = clientSecret3ds  || null;

      if (existingId) {
        await prisma.$executeRaw`
          UPDATE "CieloConfig"
          SET
            "merchantId"      = ${merchantId},
            "merchantKey"     = ${merchantKey},
            "isSandbox"       = ${isSandboxBool},
            "clientId3ds"     = ${safeClientId},
            "clientSecret3ds" = ${safeSecret},
            "updatedAt"       = NOW()
          WHERE id = ${existingId}
        `;
      } else {
        await prisma.$executeRaw`
          INSERT INTO "CieloConfig" (id, "merchantId", "merchantKey", "isSandbox", "clientId3ds", "clientSecret3ds", "updatedAt")
          VALUES (gen_random_uuid(), ${merchantId}, ${merchantKey}, ${isSandboxBool}, ${safeClientId}, ${safeSecret}, NOW())
        `;
      }

      // Tenta salvar as colunas novas separadamente (falha silenciosamente se não existirem)
      try {
        if (existingId && (establishmentCode || merchantName || mcc)) {
          await prisma.$executeRaw`
            UPDATE "CieloConfig"
            SET
              "establishmentCode" = ${establishmentCode || null},
              "merchantName"      = ${merchantName      || 'Europcar Brasil'},
              "mcc"               = ${mcc               || '7512'}
            WHERE id = ${existingId}
          `;
        }
      } catch {
        console.warn('[CieloConfig] Colunas 3DS ainda não existem no banco — execute a migration SQL.');
      }

      return NextResponse.json({ merchantId, merchantKey, isSandbox: isSandboxBool, _savedVia: 'rawSql' });
    }
  } catch (error: any) {
    console.error('[CieloConfig POST] Erro:', error.message);
    return new NextResponse("Internal server error: " + error.message, { status: 500 });
  }
}
