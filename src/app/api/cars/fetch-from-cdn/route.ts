import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// Server-side proxy: fetch car image from Europcar CDN and store as base64 in DB
export async function POST(req: Request) {
  try {
    const { carCode, urls } = await req.json();

    if (!carCode || !Array.isArray(urls) || urls.length === 0) {
      return NextResponse.json({ error: 'carCode e urls são obrigatórios' }, { status: 400 });
    }

    let imageBuffer: Buffer | null = null;
    let mimeType = 'image/png';
    let successUrl = '';

    // Try each URL until one works
    for (const url of urls) {
      try {
        const res = await fetch(url, {
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; EuropcarBot/1.0)' },
          signal: AbortSignal.timeout(8000),
        });

        if (res.ok) {
          const contentType = res.headers.get('content-type') || '';
          // Only accept image responses (not error HTML pages)
          if (contentType.startsWith('image/')) {
            const bytes = await res.arrayBuffer();
            imageBuffer = Buffer.from(bytes);
            mimeType = contentType.split(';')[0].trim();
            successUrl = url;
            break;
          }
        }
      } catch {
        // Try next URL
        continue;
      }
    }

    if (!imageBuffer) {
      return NextResponse.json({
        error: `Nenhuma imagem encontrada na Europcar para o código "${carCode}". Verifique se o código SIPP está correto.`
      }, { status: 404 });
    }

    const base64 = imageBuffer.toString('base64');
    const imageUrl = `data:${mimeType};base64,${base64}`;

    // Save to DB
    await prisma.carImageOverride.upsert({
      where: { carCode: carCode.toUpperCase() },
      update: { imageUrl },
      create: { carCode: carCode.toUpperCase(), imageUrl },
    });

    return NextResponse.json({ success: true, carCode, source: successUrl });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
