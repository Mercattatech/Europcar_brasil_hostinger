import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// GET: list all terms documents (without file data to keep response small)
export async function GET() {
  try {
    const docs = await prisma.termsDocument.findMany({
      select: { id: true, type: true, fileName: true, mimeType: true, updatedAt: true },
      orderBy: { type: 'asc' },
    });
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

    // PAIS type accepts an external URL instead of file upload
    if (type === 'PAIS') {
      if (!externalUrl) {
        return NextResponse.json({ error: 'externalUrl é obrigatório para o tipo PAIS' }, { status: 400 });
      }
      const doc = await prisma.termsDocument.upsert({
        where: { type },
        update: { fileName: externalUrl, mimeType: 'text/uri-list', fileData: 'EXTERNAL_LINK' },
        create: { type, fileName: externalUrl, mimeType: 'text/uri-list', fileData: 'EXTERNAL_LINK' },
      });
      return NextResponse.json({ id: doc.id, type: doc.type, fileName: doc.fileName, updatedAt: doc.updatedAt });
    }

    // Other types require file upload
    if (!fileName || !fileData) {
      return NextResponse.json({ error: 'fileName e fileData são obrigatórios' }, { status: 400 });
    }

    const doc = await prisma.termsDocument.upsert({
      where: { type },
      update: { fileName, mimeType: mimeType || 'application/pdf', fileData },
      create: { type, fileName, mimeType: mimeType || 'application/pdf', fileData },
    });

    return NextResponse.json({ id: doc.id, type: doc.type, fileName: doc.fileName, updatedAt: doc.updatedAt });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
