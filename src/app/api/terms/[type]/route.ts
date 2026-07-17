import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

const typeToKey: Record<string, string> = {
  reserva: 'terms_doc_RESERVA',
  pais: 'terms_doc_PAIS',
  brasil: 'terms_doc_BRASIL_ONLINE',
};

// GET /api/terms/[type] — serve the raw file (PDF/DOC) for browser viewing
export async function GET(_req: Request, { params }: { params: { type: string } }) {
  try {
    const dbKey = typeToKey[params.type?.toLowerCase()];
    if (!dbKey) {
      return NextResponse.json({ error: 'Tipo inválido' }, { status: 404 });
    }

    const block = await prisma.contentBlock.findUnique({ where: { key: dbKey } });
    if (!block) {
      return NextResponse.json({ error: 'Documento não encontrado. Faça upload no painel administrativo.' }, { status: 404 });
    }

    let parsed: any;
    try {
      parsed = JSON.parse(block.value_ptBR);
    } catch {
      return NextResponse.json({ error: 'Documento inválido no banco.' }, { status: 500 });
    }

    // If it's an external link, redirect
    if (parsed.mimeType === 'text/uri-list' || parsed.fileData === 'EXTERNAL_LINK') {
      return NextResponse.redirect(parsed.fileName);
    }

    const buffer = Buffer.from(parsed.fileData, 'base64');
    // Encode filename for Content-Disposition (RFC 5987) to support non-ASCII chars
    const safeFileName = parsed.fileName.replace(/[^\x00-\x7F]/g, '_');
    const encodedFileName = encodeURIComponent(parsed.fileName);

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': parsed.mimeType || 'application/pdf',
        'Content-Disposition': `inline; filename="${safeFileName}"; filename*=UTF-8''${encodedFileName}`,
        'Content-Length': buffer.length.toString(),
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
