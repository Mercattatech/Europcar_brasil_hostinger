import { NextResponse } from 'next/server';
import { callXRS } from '@/lib/europcar/xrsClient';
import { isValidXRSDate } from '@/lib/europcar/validate';
export const dynamic = 'force-dynamic';

// ── CMS / Friendly name catalog ────────────────────────────────────────────
// Used as fallback when the API doesn't return a description.
// Production names come from the admin CMS (extras table).
const EQUIPMENT_CATALOG: Record<string, { name: string; icon: string; description: string; maxQty: number }> = {
  CSB: { name: 'Assento de bebê (0–12 meses)', icon: '👶', description: 'Cadeira infantil para bebês de 0 a 12 meses (grupo 0).', maxQty: 2 },
  CSI: { name: 'Assento criança (1–3 anos)', icon: '🧒', description: 'Cadeira para crianças de 1 a 3 anos (grupo I, 9–18 kg).', maxQty: 2 },
  CST: { name: 'Assento criança (1–3 anos)', icon: '🧒', description: 'Cadeira para crianças de 1 a 3 anos (grupo I, 9–18 kg).', maxQty: 2 },
  BST: { name: 'Assento elevatório (4–7 anos)', icon: '💺', description: 'Booster para crianças de 4 a 7 anos (15–30 kg).', maxQty: 2 },
  NVS: { name: 'Sistema de navegação GPS', icon: '🗺️', description: 'Navegador GPS portátil com mapas atualizados.', maxQty: 1 },
  NAV: { name: 'Sistema de navegação GPS', icon: '🗺️', description: 'GPS com mapeamento local e internacional.', maxQty: 1 },
  ADD: { name: 'Condutor adicional', icon: '👤', description: 'Permite compartilhar a direção em longas viagens.', maxQty: 3 },
  ADR: { name: 'Condutor adicional', icon: '👤', description: 'Condutor extra habilitado a dirigir o veículo alugado.', maxQty: 3 },
  JAC: { name: 'Sobretaxa motorista jovem', icon: '🧑‍🦱', description: 'Exigida para motoristas com menos de 25 anos.', maxQty: 1 },
  YOU: { name: 'Sobretaxa motorista jovem', icon: '🧑‍🦱', description: 'Taxa para motoristas com menos de 25 anos.', maxQty: 1 },
  TRH: { name: 'Engate para reboque', icon: '🔗', description: 'Suporte para reboque de trailers ou caravanas.', maxQty: 1 },
  CBF: { name: 'Taxa transfronteiriça', icon: '🌍', description: 'Permite conduzir o veículo em países adicionais.', maxQty: 1 },
  LRC: { name: 'Taxa transfronteiriça', icon: '🌍', description: 'Autorização para condução em países adicionais.', maxQty: 1 },
  DVD: { name: 'Diesel garantido', icon: '⛽', description: 'Disponível apenas para categorias EDMR, CDMR, EVMR, IVMR e SDMR.', maxQty: 1 },
  SKR: { name: 'Rack de esqui', icon: '🎿', description: 'Suporte para transporte de esquis no teto do veículo.', maxQty: 1 },
  SKB: { name: 'Rack de esqui', icon: '🎿', description: 'Rack para esquis ou snowboards.', maxQty: 1 },
  SKV: { name: 'Rack de esqui', icon: '🎿', description: 'Rack para transporte de esquis.', maxQty: 1 },
  SNO: { name: 'Correntes para neve', icon: '⛓️', description: 'Correntes para pneus — obrigatórias em certas regiões.', maxQty: 1 },
  CHN: { name: 'Correntes para neve', icon: '⛓️', description: 'Correntes para pneus em condições de neve.', maxQty: 1 },
  WFI: { name: 'Wi-Fi portátil', icon: '📶', description: 'Hotspot Wi-Fi móvel com dados inclusos.', maxQty: 1 },
  LUG: { name: 'Proteção de bagagem', icon: '🧳', description: 'Cobertura para danos ou roubo de bagagem.', maxQty: 1 },
  HEL: { name: 'Capacete de motocicleta', icon: '🪖', description: 'Capacete fornecido junto com o veículo.', maxQty: 2 },
  MMS: { name: 'Proteção de espelhos', icon: '🪞', description: 'Cobertura adicional para espelhos retrovisores.', maxQty: 1 },
  JAB: { name: 'Dispositivo antiabandono', icon: '🔔', description: 'Alarme antiabandono para crianças.', maxQty: 1 },
};

/**
 * GET /api/europcar/getEquipmentList
 *
 * Query params:
 *   station  — stationID de retirada (obrigatório)
 *   date     — data de retirada no formato YYYYMMDD (obrigatório)
 *   returnDate — data de devolução no formato YYYYMMDD (obrigatório)
 *   prepaidMode — "NP" (POA) | "PP" (ETO prepaid) — default: "NP"
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const stationID    = (searchParams.get('station') ?? '').trim().toUpperCase();
  const date         = (searchParams.get('date') ?? '').trim();
  const returnDate   = (searchParams.get('returnDate') ?? '').trim();
  const prepaidMode  = searchParams.get('prepaidMode') === 'PP' ? 'PP' : 'NP';

  if (!stationID) {
    return NextResponse.json({ error: 'Parâmetro station é obrigatório.' }, { status: 400 });
  }
  if (!isValidXRSDate(date)) {
    return NextResponse.json({ error: 'Parâmetro date inválido. Use o formato YYYYMMDD.' }, { status: 400 });
  }
  if (returnDate && !isValidXRSDate(returnDate)) {
    return NextResponse.json({ error: 'Parâmetro returnDate inválido. Use o formato YYYYMMDD.' }, { status: 400 });
  }

  try {
    // ── Build XRS XML request ────────────────────────────────────────────────
    // Use the <checkout stationID> + <checkin stationID> format as documented.
    // The returnDate node is optional but improves availability accuracy.
    const checkinNode = returnDate
      ? `\n        <checkin stationID="${stationID}" date="${returnDate}"/>`
      : '';

    const xmlRequest = `<?xml version="1.0" encoding="UTF-8"?>
<message>
  <serviceRequest serviceCode="getEquipmentList">
    <serviceContext language="pt_PT"/>
    <serviceParameters>
      <reservation prepaidMode="${prepaidMode}">
        <checkout stationID="${stationID}" date="${date}"/>${checkinNode}
      </reservation>
    </serviceParameters>
  </serviceRequest>
</message>`;

    const config = {
      callerCode: process.env.XRS_CALLER_CODE || '',
      password:   process.env.XRS_PASSWORD || '',
      action:     'getEquipmentList',
      sourceFile: 'getEquipmentList/route.ts',
    };

    const xrsResponse = await callXRS(xmlRequest, config);

    // ── Navigate the response ────────────────────────────────────────────────
    const rawList =
      xrsResponse?.message?.serviceResponse?.equipmentList?.equipment ||
      xrsResponse?.serviceResponse?.equipmentList?.equipment ||
      null;

    if (!rawList) {
      // API returned no equipment — not an error, just unavailable for this station
      return NextResponse.json({ equipment: [] });
    }

    const list = Array.isArray(rawList) ? rawList : [rawList];

    // ── Parse + filter equipment items ──────────────────────────────────────
    const equipment = list
      .map((eq: any) => {
        const a = eq.$ || eq;
        const code       = (a.equipmentCode || a.code || '').toString().trim().toUpperCase();
        const statusCode = (a.statusCode || a.status || 'F').toString().trim().toUpperCase();

        // "U" = Unavailable → discard completely
        if (statusCode === 'U') return null;

        const meta   = EQUIPMENT_CATALOG[code];
        const priceRaw = parseFloat(a.price || a.pricePerDay || '0');

        // Attempt to read both NP and PP prices if the API returns them separately
        // Some XRS versions return a single price based on prepaidMode sent
        const priceNP = parseFloat(a.priceNP || (prepaidMode === 'NP' ? (a.price || '0') : '0'));
        const pricePP = parseFloat(a.pricePP || (prepaidMode === 'PP' ? (a.price || '0') : '0'));

        return {
          code,
          name:        meta?.name        || a.equipmentName  || a.description || code,
          icon:        meta?.icon        || '📦',
          description: meta?.description || a.description    || '',
          maxQty:      Math.min(parseInt(a.maxQuantity || a.maxQty || String(meta?.maxQty ?? 4), 10), 4),
          // Pricing
          price:       priceRaw,
          priceNP,
          pricePP,
          currency:    a.currency        || 'EUR',
          // Availability status
          statusCode,                               // "F" = Free Sell, "R" = On Request
          onRequest:   statusCode === 'R',
          // Extras type (O=optional, M=mandatory, I=included)
          type:        a.type || 'O',
        };
      })
      .filter(Boolean)
      // Only optional equipment — mandatory/included are automatic
      .filter((eq: any) => eq.type === 'O' || eq.type === 'optional' || !eq.type);

    return NextResponse.json({ equipment, prepaidMode });

  } catch (error: any) {
    console.error('[getEquipmentList] Error:', error.message);
    return NextResponse.json(
      { error: error.message || 'Erro ao consultar XRS getEquipmentList' },
      { status: 500 }
    );
  }
}
