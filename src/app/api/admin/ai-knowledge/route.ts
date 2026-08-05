import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';

export const dynamic = 'force-dynamic';

const ADMIN_EMAILS = ["grupomercatta@gmail.com", "matheus@grupomercatta.com.br", "matheusconti@gmail.com", "matheus@grupomercatta.com"];

async function checkAdmin() {
   const session = await getServerSession(authOptions);
   if (!session?.user?.email) return false;
   if (ADMIN_EMAILS.includes(session.user.email)) return true;
   try {
      const dbUser = await prisma.user.findUnique({ where: { email: session.user.email } });
      return dbUser?.role === 'ADMIN';
   } catch {
      return false;
   }
}

/**
 * GET /api/admin/ai-knowledge
 * Returns all knowledge documents (without the full extracted text to keep payload small)
 */
export async function GET() {
   if (!(await checkAdmin())) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
   }
   try {
      const docs = await prisma.aIKnowledgeDoc.findMany({
         select: {
            id: true,
            fileName: true,
            fileType: true,
            active: true,
            sizeBytes: true,
            createdAt: true,
            // Preview of extracted text (first 200 chars)
            extractedText: true,
         },
         orderBy: { createdAt: 'desc' },
      });

      // Return with text preview only
      return NextResponse.json(docs.map(d => ({
         ...d,
         textPreview: d.extractedText?.substring(0, 200) + (d.extractedText?.length > 200 ? '...' : ''),
         extractedText: undefined,
         charCount: d.extractedText?.length ?? 0,
      })));
   } catch (e) {
      console.error('GET /api/admin/ai-knowledge error:', e);
      return NextResponse.json({ error: 'Erro ao buscar documentos' }, { status: 500 });
   }
}

/**
 * POST /api/admin/ai-knowledge
 * Upload one or more files. Accepts multipart/form-data with field "files".
 * Extracts text from PDF/TXT, uses OpenAI vision for images.
 */
export async function POST(req: Request) {
   if (!(await checkAdmin())) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
   }
   try {
      const formData = await req.formData();
      const files = formData.getAll('files') as File[];

      if (!files || files.length === 0) {
         return NextResponse.json({ error: 'Nenhum arquivo enviado.' }, { status: 400 });
      }

      const results: { fileName: string; status: string; error?: string }[] = [];

      for (const file of files) {
         try {
            const fileType = getFileType(file.type, file.name);
            const arrayBuffer = await file.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);
            let extractedText = '';

            if (fileType === 'pdf') {
               extractedText = await extractPdfText(buffer);
            } else if (fileType === 'txt') {
               extractedText = buffer.toString('utf-8');
            } else if (fileType === 'image') {
               extractedText = await describeImageWithAI(buffer, file.type, file.name);
            } else {
               results.push({ fileName: file.name, status: 'error', error: 'Tipo de arquivo não suportado' });
               continue;
            }

            if (!extractedText || extractedText.trim().length < 10) {
               results.push({ fileName: file.name, status: 'error', error: 'Não foi possível extrair texto do arquivo' });
               continue;
            }

            await prisma.aIKnowledgeDoc.create({
               data: {
                  fileName: file.name,
                  fileType,
                  extractedText: extractedText.trim(),
                  active: true,
                  sizeBytes: buffer.length,
               },
            });

            results.push({ fileName: file.name, status: 'success' });
         } catch (fileError: any) {
            console.error(`Error processing file ${file.name}:`, fileError);
            results.push({ fileName: file.name, status: 'error', error: fileError.message });
         }
      }

      return NextResponse.json({ results });
   } catch (e: any) {
      console.error('POST /api/admin/ai-knowledge error:', e);
      return NextResponse.json({ error: 'Erro ao processar arquivos' }, { status: 500 });
   }
}

/**
 * PATCH /api/admin/ai-knowledge
 * Toggle active status of a document
 */
export async function PATCH(req: Request) {
   if (!(await checkAdmin())) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
   }
   try {
      const { id, active } = await req.json();
      const doc = await prisma.aIKnowledgeDoc.update({
         where: { id },
         data: { active },
         select: { id: true, active: true },
      });
      return NextResponse.json(doc);
   } catch (e) {
      return NextResponse.json({ error: 'Erro ao atualizar documento' }, { status: 500 });
   }
}

/**
 * DELETE /api/admin/ai-knowledge?id=xxx
 */
export async function DELETE(req: Request) {
   if (!(await checkAdmin())) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
   }
   try {
      const { searchParams } = new URL(req.url);
      const id = searchParams.get('id');
      if (!id) return NextResponse.json({ error: 'id obrigatório' }, { status: 400 });
      await prisma.aIKnowledgeDoc.delete({ where: { id } });
      return NextResponse.json({ success: true });
   } catch (e) {
      return NextResponse.json({ error: 'Erro ao excluir documento' }, { status: 500 });
   }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getFileType(mimeType: string, fileName: string): 'pdf' | 'txt' | 'image' | 'unknown' {
   if (mimeType === 'application/pdf' || fileName.toLowerCase().endsWith('.pdf')) return 'pdf';
   if (mimeType.startsWith('text/') || fileName.toLowerCase().endsWith('.txt') || fileName.toLowerCase().endsWith('.md')) return 'txt';
   if (mimeType.startsWith('image/')) return 'image';
   return 'unknown';
}

async function extractPdfText(buffer: Buffer): Promise<string> {
   // Dynamic import to avoid issues with pdf-parse and Next.js edge runtime
   const pdfParse = (await import('pdf-parse')).default;
   const data = await pdfParse(buffer);
   return data.text;
}

async function describeImageWithAI(buffer: Buffer, mimeType: string, fileName: string): Promise<string> {
   const base64 = buffer.toString('base64');
   const apiKey = process.env.OPENAI_API_KEY;
   if (!apiKey) return `[Imagem: ${fileName}] — Sem chave OpenAI para análise.`;

   const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
         'Authorization': `Bearer ${apiKey}`,
         'Content-Type': 'application/json',
      },
      body: JSON.stringify({
         model: 'gpt-4o-mini',
         messages: [
            {
               role: 'user',
               content: [
                  {
                     type: 'text',
                     text: `Você é um assistente que extrai informações de imagens para uma base de conhecimento de suporte ao cliente da Europcar Brasil (locadora de veículos). Descreva detalhadamente o conteúdo desta imagem, incluindo textos, tabelas, números, políticas, condições, mapas de lojas ou qualquer informação relevante para atendimento ao cliente. Seja completo e detalhado. Nome do arquivo: ${fileName}`,
                  },
                  {
                     type: 'image_url',
                     image_url: {
                        url: `data:${mimeType};base64,${base64}`,
                        detail: 'high',
                     },
                  },
               ],
            },
         ],
         max_tokens: 2000,
      }),
   });

   if (!response.ok) {
      throw new Error(`OpenAI Vision API error: ${response.statusText}`);
   }

   const data = await response.json();
   return `[Imagem: ${fileName}]\n${data.choices?.[0]?.message?.content ?? ''}`;
}
