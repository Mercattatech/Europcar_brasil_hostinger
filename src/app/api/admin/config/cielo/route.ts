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
  } catch (error) {
    return new NextResponse("Internal server error", { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const {
      merchantId, merchantKey, isSandbox,
      clientId3ds, clientSecret3ds,
      establishmentCode, merchantName, mcc,
    } = await req.json();

    let config = await prisma.cieloConfig.findFirst();

    const data = {
      merchantId,
      merchantKey,
      isSandbox,
      clientId3ds:       clientId3ds       || null,
      clientSecret3ds:   clientSecret3ds   || null,
      establishmentCode: establishmentCode || null,
      merchantName:      merchantName      || 'Europcar Brasil',
      mcc:               mcc               || '7512',
    };

    if (config) {
      config = await prisma.cieloConfig.update({ where: { id: config.id }, data });
    } else {
      config = await prisma.cieloConfig.create({ data });
    }

    return NextResponse.json(config);
  } catch (error) {
    return new NextResponse("Internal server error", { status: 500 });
  }
}
