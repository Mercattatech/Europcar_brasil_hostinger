import { NextResponse } from 'next/server';
import { callXRS } from '@/lib/europcar/xrsClient';
import { prisma } from '@/lib/prisma';
import { parseStringPromise } from 'xml2js';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Brazilian stations to query for car images (valid from getStations)
const BR_STATIONS = ['CGHO03', 'GRUO02', 'VCPT02', 'POAO03', 'SAOC04', 'SSAC03'];

function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}${m}${day}`;
}

async function fetchImagesForStation(station: string): Promise<Record<string, string>> {
  const pickup = new Date();
  pickup.setDate(pickup.getDate() + 30);
  const ret = new Date(pickup);
  ret.setDate(ret.getDate() + 3);

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<message>
  <serviceRequest serviceCode="getMultipleRates">
    <serviceParameters>
      <reservation rateDetails="Y" chargesDetail="TRE">
        <checkout stationID="${station}" date="${formatDate(pickup)}" time="1000"/>
        <checkin stationID="${station}" date="${formatDate(ret)}" time="1000"/>
      </reservation>
      <driver countryOfResidence="BR" />
    </serviceParameters>
  </serviceRequest>
</message>`;

  try {
    const config = {
      callerCode: process.env.XRS_CALLER_CODE || 'DEMO',
      password: process.env.XRS_PASSWORD || 'DEMO',
      action: 'getMultipleRates',
      sourceFile: 'sync-images/route.ts',
    };

    const data = await callXRS(xml, config);

    // Parse car images from response
    const images: Record<string, string> = {};
    const rawList =
      data?.message?.serviceResponse?.reservationRateList?.reservationRate ||
      data?.serviceResponse?.reservationRateList?.reservationRate || [];
    const rateArr: any[] = Array.isArray(rawList) ? rawList : rawList ? [rawList] : [];

    for (const r of rateArr) {
      const attrs = r.$ || r;
      const carCode = attrs.carCategoryCode;
      if (!carCode) continue;

      const linksRaw = r.links?.link || [];
      const linksArr: any[] = Array.isArray(linksRaw) ? linksRaw : [linksRaw];
      const carvisual = linksArr.find((l: any) => (l.$ || l).id === 'carvisual');
      const imageUrl: string = (carvisual?.$ || carvisual)?.value || '';

      if (imageUrl && imageUrl.startsWith('http') && !images[carCode]) {
        images[carCode] = imageUrl;
      }
    }

    return images;
  } catch (e) {
    console.error(`[sync-images] Error for station ${station}:`, e);
    return {};
  }
}

export async function POST() {
  try {
    const allImages: Record<string, string> = {};

    // Fetch images from multiple stations
    for (const station of BR_STATIONS) {
      const imgs = await fetchImagesForStation(station);
      Object.assign(allImages, imgs);
      if (Object.keys(allImages).length > 20) break; // Stop early if we have enough
    }

    if (Object.keys(allImages).length === 0) {
      return NextResponse.json({
        success: false,
        message: 'Nenhuma imagem encontrada na API. Verifique se a API XRS está acessível.',
        saved: 0,
      });
    }

    // Save to DB (don't overwrite existing custom uploads)
    let saved = 0;
    for (const [carCode, imageUrl] of Object.entries(allImages)) {
      try {
        // Only upsert if no custom image already exists OR if existing is also an API URL (not base64)
        const existing = await prisma.carImageOverride.findUnique({ where: { carCode } });
        if (!existing || !existing.imageUrl.startsWith('data:')) {
          await prisma.carImageOverride.upsert({
            where: { carCode },
            update: { imageUrl },
            create: { carCode, imageUrl },
          });
          saved++;
        }
      } catch {
        // skip failed upserts
      }
    }

    return NextResponse.json({
      success: true,
      message: `${saved} imagens sincronizadas da API Europcar.`,
      saved,
      found: Object.keys(allImages).length,
      cars: Object.keys(allImages),
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
