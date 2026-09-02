import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
export const dynamic = 'force-dynamic';

// Hardcoded defaults — used to seed if DB is empty
// Each entry can be a string (code auto-generated) or { name, code } with an explicit XRS loyaltyID.
const DEFAULTS: Array<string | { name: string; code: string }> = [
  'AIR CARAIBES – PREFERENCE',
  { name: 'AIR EUROPA SUMA', code: 'UXP' }, // loyaltyID correto fornecido pela Europcar (Antonio)
  'AIR INDIA MAHARAJA CLUB',
  'AIRBERLIN TOPBONUS',
  'ALL – ACCOR LIVE LIMITLESS',
  'AMERICAN AIRLINES ADVANTAGE PROGR.',
  'ASIA MILES',
  'BAHN.BONUS',
  'C.G.O.S',
  'CARREFOUR',
  'CARTAFRECCIA',
  'CARTASI IOSI',
  'DELTA SKY MILES',
  'EL AL FREQUENT FLYER CLUB',
  'EMIRATES SKYWARDS',
  'FINNAIR PLUS',
  'FLYING BLUE AIR FRANCE/KLM',
  'GULF AIR FALCON FLYER',
  'H REWARDS',
  'ITALO PIU\' MEMBER',
  'MABUHAY MILES',
  'MAS RENFE',
  'MELIAREWARDS',
  'MILES & MORE',
  'QATAR PRIVILEGE CLUB',
  'RADISSON REWARDS',
  'ROTANA REWARDS',
  'ROYAL AIR MAROC SAFAR FLYER',
  'SAS EUROBONUS REWARDS',
  'SHEBAMILES ETHIOPIAN AIRLINES',
  'SINDBAD',
  'SINGAPORE AIRLINES KRISFLYER',
  'SOUTH AFRICAN AIRWAYS VOYAGER',
  'TAP MILES AND GO',
  'TURKISH AIRLINES',
  'UIA PANORAMA CLUB',
  'VIRGIN AUSTRALIA VELOCITY',
  'YOU & ENI',
];

function nameToCode(name: string): string {
  return name.replace(/[^A-Z0-9]/g, '').slice(0, 20) || name.slice(0, 20);
}

// GET — list all active loyalty programs
export async function GET() {
  try {
    let programs = await prisma.loyaltyProgram.findMany({
      where: { active: true },
      orderBy: { name: 'asc' },
    });

    // Seed defaults if empty
    if (programs.length === 0) {
      await prisma.loyaltyProgram.createMany({
        data: DEFAULTS.map(entry => {
          const name = typeof entry === 'string' ? entry : entry.name;
          const code = typeof entry === 'string' ? nameToCode(name.toUpperCase()) : entry.code;
          return { name, code, active: true };
        }),
        skipDuplicates: true,
      });
      programs = await prisma.loyaltyProgram.findMany({
        where: { active: true },
        orderBy: { name: 'asc' },
      });
    }

    return NextResponse.json(programs);
  } catch (error: any) {
    // Fallback: return hardcoded list if DB fails
    console.error('[loyalty-programs] DB error, returning defaults:', error.message);
    return NextResponse.json(
      DEFAULTS.map((entry, i) => {
        const name = typeof entry === 'string' ? entry : entry.name;
        const code = typeof entry === 'string' ? nameToCode(name.toUpperCase()) : entry.code;
        return { id: `default-${i}`, name, code, active: true };
      })
    );
  }
}

// POST — create new loyalty program
export async function POST(req: Request) {
  try {
    const { name, code } = await req.json();
    if (!name) return NextResponse.json({ error: 'Nome obrigatório' }, { status: 400 });

    const finalCode = code || nameToCode(name.toUpperCase());
    const program = await prisma.loyaltyProgram.create({
      data: { name, code: finalCode, active: true },
    });
    return NextResponse.json(program);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PUT — update loyalty program
export async function PUT(req: Request) {
  try {
    const { id, name, code, active } = await req.json();
    if (!id) return NextResponse.json({ error: 'ID obrigatório' }, { status: 400 });

    const program = await prisma.loyaltyProgram.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(code !== undefined && { code }),
        ...(active !== undefined && { active }),
      },
    });
    return NextResponse.json(program);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE — delete loyalty program
export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'ID obrigatório' }, { status: 400 });

    await prisma.loyaltyProgram.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
