import { NextResponse } from 'next/server';
import { callXRS } from '@/lib/europcar/xrsClient';
export const dynamic = 'force-dynamic';

// Friendly names and emojis for equipment codes
const EQUIPMENT_META: Record<string, { name: string; icon: string; description: string }> = {
  CSB: { name: 'Cadeira de bebê (0-12 meses)', icon: '👶', description: 'Cadeira infantil para bebês de até 12 meses (grupo 0).' },
  CST: { name: 'Cadeira de criança (1-3 anos)', icon: '🧒', description: 'Cadeira infantil para crianças de 1 a 3 anos (grupo 1).' },
  BST: { name: 'Assento elevatório (4-12 anos)', icon: '💺', description: 'Assento elevatório (booster) para crianças de 4 a 12 anos.' },
  NVS: { name: 'GPS / Navegador', icon: '🗺️', description: 'Navegador GPS portátil com mapas atualizados.' },
  SKR: { name: 'Rack de esqui', icon: '🎿', description: 'Suporte para transporte de esquis no teto do veículo.' },
  CHN: { name: 'Correntes para neve', icon: '⛓️', description: 'Correntes para pneus, obrigatórias em regiões com neve.' },
  WFI: { name: 'Wi-Fi portátil', icon: '📶', description: 'Hotspot Wi-Fi portátil com dados móveis inclusos.' },
  TAB: { name: 'Tablet de entretenimento', icon: '📱', description: 'Tablet com conteúdo de entretenimento para passageiros.' },
  BIK: { name: 'Suporte para bicicleta', icon: '🚲', description: 'Rack traseiro para transporte de bicicletas.' },
  ADD: { name: 'Condutor adicional', icon: '👤', description: 'Adicionar um motorista extra à reserva.' },
  YDR: { name: 'Condutor jovem', icon: '🧑', description: 'Taxa para motoristas com menos de 25 anos.' },
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const stationCode = (searchParams.get('station') ?? '').trim().toUpperCase();

  if (!stationCode) {
    return NextResponse.json({ error: 'Parâmetro station é obrigatório.' }, { status: 400 });
  }

  try {
    const xmlRequest = `<?xml version="1.0" encoding="UTF-8"?>
<message>
  <serviceRequest serviceCode="getEquipmentList">
    <serviceParameters>
      <station stationCode="${stationCode}"/>
    </serviceParameters>
  </serviceRequest>
</message>`;

    const config = {
      callerCode: process.env.XRS_CALLER_CODE || '',
      password: process.env.XRS_PASSWORD || '',
      action: 'getEquipmentList',
      sourceFile: 'getEquipmentList/route.ts',
    };

    const xrsResponse = await callXRS(xmlRequest, config);

    // Navigate to equipment list in response
    const rawList =
      xrsResponse?.message?.serviceResponse?.equipmentList?.equipment ||
      xrsResponse?.serviceResponse?.equipmentList?.equipment ||
      null;

    if (!rawList) {
      return NextResponse.json({ equipment: [] });
    }

    const list = Array.isArray(rawList) ? rawList : [rawList];

    const equipment = list.map((eq: any) => {
      const attrs = eq.$ || eq;
      const code = attrs.equipmentCode || attrs.code || '';
      const meta = EQUIPMENT_META[code];
      return {
        code,
        name: meta?.name || attrs.equipmentName || attrs.description || code,
        icon: meta?.icon || '📦',
        description: meta?.description || '',
        price: parseFloat(attrs.price || attrs.pricePerDay || '0'),
        currency: attrs.currency || 'EUR',
        maxQty: parseInt(attrs.maxQuantity || attrs.maxQty || '4', 10),
        type: attrs.type || 'O', // O=Optional, M=Mandatory, I=Included
        onRequest: attrs.onRequest === 'Y' || attrs.onRequest === 'true',
      };
    });

    // Only return optional equipment (type O) — mandatory and included are automatic
    const optional = equipment.filter((eq: any) => eq.type === 'O' || eq.type === 'optional');

    return NextResponse.json({ equipment: optional });

  } catch (error: any) {
    console.error('[getEquipmentList] Error:', error.message);
    return NextResponse.json(
      { error: error.message || 'Erro ao consultar XRS getEquipmentList' },
      { status: 500 }
    );
  }
}
