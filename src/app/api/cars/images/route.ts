import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkAdmin } from '@/lib/checkAdmin';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const overrides = await prisma.carImageOverride.findMany();
    return NextResponse.json(overrides);
  } catch (error: any) {
    console.error("Car images GET error:", error.message);
    return NextResponse.json([]);
  }
}

// POST: receive image as base64 and store directly in DB (no filesystem needed)
export async function POST(req: Request) {
  try {
    if (!(await checkAdmin())) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const data = await req.formData();
    const file = data.get('file') as File;
    const carCode = data.get('carCode') as string;

    if (!file || !carCode) {
      return NextResponse.json({ error: 'File and carCode are required' }, { status: 400 });
    }

    // Convert file to base64 data URL — stored directly in DB, no disk write needed
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const base64 = buffer.toString('base64');
    const mimeType = file.type || 'image/jpeg';
    const imageUrl = `data:${mimeType};base64,${base64}`;

    const override = await prisma.carImageOverride.upsert({
      where: { carCode: carCode.toUpperCase() },
      update: { imageUrl },
      create: { carCode: carCode.toUpperCase(), imageUrl },
    });

    return NextResponse.json({ success: true, override: { carCode: override.carCode, imageUrl: imageUrl.substring(0, 50) + '...' } });
  } catch (error: any) {
    console.error('Upload Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE: remove override from DB only (no filesystem operations)
export async function DELETE(req: Request) {
  try {
    if (!(await checkAdmin())) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { searchParams } = new URL(req.url);
    const carCode = searchParams.get('carCode');

    if (!carCode) {
      return NextResponse.json({ error: 'carCode is required' }, { status: 400 });
    }

    await prisma.carImageOverride.delete({
      where: { carCode: carCode.toUpperCase() }
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
