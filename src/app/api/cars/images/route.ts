import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { writeFile, unlink } from 'fs/promises';
import { join } from 'path';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const overrides = await prisma.carImageOverride.findMany();
    return NextResponse.json(overrides);
  } catch (error: any) {
    console.error("Car images GET error (table might not exist):", error.message);
    return NextResponse.json([]); // return empty array as fallback
  }
}

// POST to upload an image and save to DB
export async function POST(req: Request) {
  try {
    const data = await req.formData();
    const file = data.get('file') as File;
    const carCode = data.get('carCode') as string;

    if (!file || !carCode) {
      return NextResponse.json({ error: 'File and carCode are required' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Save to public/uploads/cars
    const fileName = `${carCode.toUpperCase()}.jpg`;
    const uploadDir = join(process.cwd(), 'public', 'uploads', 'cars');
    const filePath = join(uploadDir, fileName);

    await writeFile(filePath, buffer);

    const imageUrl = `/uploads/cars/${fileName}?v=${Date.now()}`;

    // Update DB
    const override = await prisma.carImageOverride.upsert({
      where: { carCode: carCode.toUpperCase() },
      update: { imageUrl },
      create: { carCode: carCode.toUpperCase(), imageUrl },
    });

    return NextResponse.json({ success: true, override });
  } catch (error: any) {
    console.error('Upload Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE to remove override and delete file
export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const carCode = searchParams.get('carCode');

    if (!carCode) {
      return NextResponse.json({ error: 'carCode is required' }, { status: 400 });
    }

    const fileName = `${carCode.toUpperCase()}.jpg`;
    const filePath = join(process.cwd(), 'public', 'uploads', 'cars', fileName);

    // Try deleting file if exists
    try {
      await unlink(filePath);
    } catch (e) {
      // Ignore if file doesn't exist
    }

    // Delete from DB
    await prisma.carImageOverride.delete({
      where: { carCode: carCode.toUpperCase() }
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
