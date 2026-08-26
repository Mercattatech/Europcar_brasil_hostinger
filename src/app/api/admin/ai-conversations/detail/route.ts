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
 * GET /api/admin/ai-conversations/detail?id=xxx
 * Returns full conversation with all messages parsed
 */
export async function GET(req: Request) {
   if (!(await checkAdmin())) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
   }
   try {
      const { searchParams } = new URL(req.url);
      const id = searchParams.get('id');
      if (!id) return NextResponse.json({ error: 'id obrigatório' }, { status: 400 });

      const conv = await prisma.aIConversationLog.findUnique({ where: { id } });
      if (!conv) return NextResponse.json({ error: 'Conversa não encontrada' }, { status: 404 });

      let messages: { role: string; content: string }[] = [];
      try {
         const parsed = JSON.parse(conv.messages);
         // Handle both plain messages and Vercel AI SDK message formats
         messages = parsed.map((m: any) => {
            let content = '';
            if (typeof m.content === 'string') {
               content = m.content;
            } else if (Array.isArray(m.content)) {
               content = m.content
                  .filter((p: any) => p.type === 'text')
                  .map((p: any) => p.text)
                  .join('');
            } else if (Array.isArray(m.parts)) {
               content = m.parts
                  .filter((p: any) => p.type === 'text')
                  .map((p: any) => p.text)
                  .join('');
            }
            return { role: m.role, content };
         }).filter((m: { role: string; content: string }) => m.content);
      } catch {
         messages = [];
      }

      return NextResponse.json({
         id: conv.id,
         sessionId: conv.sessionId,
         approved: conv.approved,
         sessionStart: conv.sessionStart,
         messages,
      });
   } catch (e) {
      console.error('GET /api/admin/ai-conversations/detail error:', e);
      return NextResponse.json({ error: 'Erro ao buscar conversa' }, { status: 500 });
   }
}
