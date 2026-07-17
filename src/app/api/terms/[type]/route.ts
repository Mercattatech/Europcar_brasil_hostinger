import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// GET /api/terms/[type] — serve the raw file (PDF/DOC) for browser viewing
export async function GET(_req: Request, { params }: { params: { type: string } }) {
  try {
    const typeMap: Record<string, string> = {
      reserva: 'RESERVA',
      pais: 'PAIS',
      brasil: 'BRASIL_ONLINE',
    };

    const dbType = typeMap[params.type?.toLowerCase()];
    if (!dbType) {
      return NextResponse.json({ error: 'Tipo inválido' }, { status: 404 });
    }

    const doc = await prisma.termsDocument.findUnique({ where: { type: dbType } });
    if (!doc) {
      return NextResponse.json({ error: 'Documento não encontrado. Faça upload no painel administrativo.' }, { status: 404 });
    }

    const buffer = Buffer.from(doc.fileData, 'base64');

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': doc.mimeType,
        'Content-Disposition': `inline; filename="${doc.fileName}"`,
        'Content-Length': buffer.length.toString(),
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
