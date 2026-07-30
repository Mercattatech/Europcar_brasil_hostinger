import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const config = await prisma.cieloConfig.findFirst();
    if (!config) {
      return NextResponse.json({ merchantId: '', merchantKey: '', isSandbox: true });
    }
    return NextResponse.json(config);
  } catch (error) {
    return new NextResponse("Internal server error", { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { merchantId, merchantKey, isSandbox, clientId3ds, clientSecret3ds } = await req.json();

    let config = await prisma.cieloConfig.findFirst();

    if (config) {
      config = await prisma.cieloConfig.update({
        where: { id: config.id },
        data: { merchantId, merchantKey, isSandbox, clientId3ds: clientId3ds || null, clientSecret3ds: clientSecret3ds || null }
      });
    } else {
      config = await prisma.cieloConfig.create({
        data: { merchantId, merchantKey, isSandbox, clientId3ds: clientId3ds || null, clientSecret3ds: clientSecret3ds || null }
      });
    }

    return NextResponse.json(config);
  } catch (error) {
    return new NextResponse("Internal server error", { status: 500 });
  }
}
