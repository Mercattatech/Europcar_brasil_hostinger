import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// We store terms in the existing ContentBlock table as JSON to avoid needing a new DB migration.
// Key format: terms_doc_RESERVA, terms_doc_PAIS, terms_doc_BRASIL_ONLINE
// Value format: JSON { fileName, mimeType, fileData, updatedAt }

const typeKey = (type: string) => `terms_doc_${type}`;

// GET: list all terms documents (metadata only, no fileData)
export async function GET() {
  try {
    const blocks = await prisma.contentBlock.findMany({
      where: { key: { in: ['terms_doc_RESERVA', 'terms_doc_PAIS', 'terms_doc_BRASIL_ONLINE'] } },
    });

    const docs = blocks.map(b => {
      try {
        const parsed = JSON.parse(b.value_ptBR);
        return {
          id: b.id,
          type: b.key.replace('terms_doc_', ''),
          fileName: parsed.fileName || '',
          mimeType: parsed.mimeType || 'application/pdf',
          updatedAt: parsed.updatedAt || b.updatedAt,
        };
      } catch {
        return null;
      }
    }).filter(Boolean);

    return NextResponse.json(docs);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// POST: upload or replace a terms document (or save external link for PAIS)
export async function POST(req: Request) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const body = await req.json();
    const { type, fileName, mimeType, fileData, externalUrl } = body;

    const validTypes = ['RESERVA', 'PAIS', 'BRASIL_ONLINE'];
    if (!type || !validTypes.includes(type)) {
      return NextResponse.json({ error: `type inválido. Use: ${validTypes.join(', ')}` }, { status: 400 });
    }

    const key = typeKey(type);
    const now = new Date().toISOString();

    let value: object;

    // PAIS with external URL
    if (type === 'PAIS' && externalUrl) {
      value = { fileName: externalUrl, mimeType: 'text/uri-list', fileData: 'EXTERNAL_LINK', updatedAt: now };
    } else {
      // File upload (all types including PAIS)
      if (!fileName || !fileData) {
        return NextResponse.json({ error: 'fileName e fileData são obrigatórios' }, { status: 400 });
      }
      value = { fileName, mimeType: mimeType || 'application/pdf', fileData, updatedAt: now };
    }

    const block = await prisma.contentBlock.upsert({
      where: { key },
      update: { value_ptBR: JSON.stringify(value) },
      create: { key, value_ptBR: JSON.stringify(value) },
    });

    const parsed = JSON.parse(block.value_ptBR);
    return NextResponse.json({
      id: block.id,
      type,
      fileName: parsed.fileName,
      mimeType: parsed.mimeType,
      updatedAt: parsed.updatedAt,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
