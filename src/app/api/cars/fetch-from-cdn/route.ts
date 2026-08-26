import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkAdmin } from '@/lib/checkAdmin';

export const dynamic = 'force-dynamic';

// Only the Europcar-owned CDN host is allowed as a fetch target, to prevent SSRF.
const ALLOWED_CDN_HOSTS = ['static.europcar.com'];

function isAllowedCdnUrl(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl);
    return parsed.protocol === 'https:' && ALLOWED_CDN_HOSTS.includes(parsed.hostname);
  } catch {
    return false;
  }
}

// Server-side proxy: fetch car image from Europcar CDN and store as base64 in DB
export async function POST(req: Request) {
  try {
    if (!(await checkAdmin())) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { carCode, urls } = await req.json();

    if (!carCode || !Array.isArray(urls) || urls.length === 0) {
      return NextResponse.json({ error: 'carCode e urls são obrigatórios' }, { status: 400 });
    }

    let imageBuffer: Buffer | null = null;
    let mimeType = 'image/png';
    let successUrl = '';

    // Try each URL until one works
    for (const url of urls) {
      if (!isAllowedCdnUrl(url)) continue;
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
