import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { checkAdmin } from "@/lib/checkAdmin";
export const dynamic = 'force-dynamic';

export const DEFAULT_XRS_CONFIG = {
  poaCid: '57269673',
  etoZeroExcessCid: '56935495',
  etoZeroExcessBa: '73804373',
  etoExcessCid: '56935466',
  etoExcessBa: '73675595',
  exoCid: '57269673',
  exoIata: '02170722',
  callerCode: process.env.XRS_CALLER_CODE || '',
  password: process.env.XRS_PASSWORD || '',
};

export async function GET() {
  if (!(await checkAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const config = await prisma.xRSConfig.findFirst();
    if (!config) {
      return NextResponse.json(DEFAULT_XRS_CONFIG);
    }
    return NextResponse.json({
      callerCode: config.callerCode || DEFAULT_XRS_CONFIG.callerCode,
      password: config.password || DEFAULT_XRS_CONFIG.password,
      poaCid: config.poaCid || DEFAULT_XRS_CONFIG.poaCid,
      etoZeroExcessCid: config.etoZeroExcessCid || DEFAULT_XRS_CONFIG.etoZeroExcessCid,
      etoZeroExcessBa: config.etoZeroExcessBa || DEFAULT_XRS_CONFIG.etoZeroExcessBa,
      etoExcessCid: config.etoExcessCid || DEFAULT_XRS_CONFIG.etoExcessCid,
      etoExcessBa: config.etoExcessBa || DEFAULT_XRS_CONFIG.etoExcessBa,
      exoCid: config.exoCid || DEFAULT_XRS_CONFIG.exoCid,
      exoIata: config.exoIata || DEFAULT_XRS_CONFIG.exoIata,
    });
  } catch (error: any) {
    console.warn('[XRSConfig GET] Fallback para padroes:', error?.message);
    return NextResponse.json(DEFAULT_XRS_CONFIG);
  }
}

export async function POST(req: Request) {
  if (!(await checkAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const trim = (v: any) => (typeof v === 'string' ? v.trim() : v);

    const poaCid = trim(body.poaCid) || DEFAULT_XRS_CONFIG.poaCid;
    const etoZeroExcessCid = trim(body.etoZeroExcessCid) || DEFAULT_XRS_CONFIG.etoZeroExcessCid;
    const etoZeroExcessBa = trim(body.etoZeroExcessBa) || DEFAULT_XRS_CONFIG.etoZeroExcessBa;
    const etoExcessCid = trim(body.etoExcessCid) || DEFAULT_XRS_CONFIG.etoExcessCid;
    const etoExcessBa = trim(body.etoExcessBa) || DEFAULT_XRS_CONFIG.etoExcessBa;
    const exoCid = trim(body.exoCid) || DEFAULT_XRS_CONFIG.exoCid;
    const exoIata = trim(body.exoIata) || DEFAULT_XRS_CONFIG.exoIata;
    const callerCode = trim(body.callerCode) || DEFAULT_XRS_CONFIG.callerCode;
    const password = trim(body.password) || DEFAULT_XRS_CONFIG.password;

    const existing = await prisma.xRSConfig.findFirst({ select: { id: true } });

    const data = {
      callerCode,
      password,
      poaCid,
      etoZeroExcessCid,
      etoZeroExcessBa,
      etoExcessCid,
      etoExcessBa,
      exoCid,
      exoIata,
    };

    const config = existing?.id
      ? await prisma.xRSConfig.update({ where: { id: existing.id }, data })
      : await prisma.xRSConfig.create({ data });

    return NextResponse.json({ success: true, config });
  } catch (error: any) {
    console.error('[XRSConfig POST] Erro:', error?.message);
    return NextResponse.json({ error: 'Erro ao salvar configuracao: ' + error?.message }, { status: 500 });
  }
}
