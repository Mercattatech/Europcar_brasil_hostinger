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
 * GET /api/admin/ai-conversations
 * Returns list of saved conversations. Pass ?approved=true to get only approved ones.
 */
export async function GET(req: Request) {
   if (!(await checkAdmin())) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
   }
   try {
      const { searchParams } = new URL(req.url);
      const approvedOnly = searchParams.get('approved') === 'true';
      const page = parseInt(searchParams.get('page') || '1');
      const pageSize = 20;

      const where = approvedOnly ? { approved: true } : {};

      const [total, conversations] = await Promise.all([
         prisma.aIConversationLog.count({ where }),
         prisma.aIConversationLog.findMany({
            where,
            orderBy: { sessionStart: 'desc' },
            skip: (page - 1) * pageSize,
            take: pageSize,
         }),
      ]);

      // Parse messages JSON for a preview
      const withPreview = conversations.map(c => {
         let preview = '';
         let messageCount = 0;
         try {
            const msgs = JSON.parse(c.messages);
            messageCount = msgs.length;
            const firstUser = msgs.find((m: any) => m.role === 'user');
            preview = firstUser?.content?.substring(0, 120) ?? '';
         } catch {}
         return { ...c, preview, messageCount, messages: undefined };
      });

      return NextResponse.json({ conversations: withPreview, total, page, pageSize });
   } catch (e) {
      console.error('GET /api/admin/ai-conversations error:', e);
      return NextResponse.json({ error: 'Erro ao buscar conversas' }, { status: 500 });
   }
}

/**
 * POST /api/admin/ai-conversations
 * Save a conversation from the chat widget.
 * Body: { sessionId, messages }
 * This is called from the public chat route — no admin check.
 */
export async function POST(req: Request) {
   try {
      const { sessionId, messages } = await req.json();
      if (!sessionId || !messages) {
         return NextResponse.json({ error: 'sessionId e messages são obrigatórios' }, { status: 400 });
      }

      // Upsert: update if session already logged, create if new
      const existing = await prisma.aIConversationLog.findFirst({ where: { sessionId } });
      if (existing) {
         await prisma.aIConversationLog.update({
            where: { id: existing.id },
            data: { messages: JSON.stringify(messages) },
         });
      } else {
         await prisma.aIConversationLog.create({
            data: {
               sessionId,
               messages: JSON.stringify(messages),
               approved: false,
            },
         });
      }

      return NextResponse.json({ success: true });
   } catch (e) {
      console.error('POST /api/admin/ai-conversations error:', e);
      return NextResponse.json({ error: 'Erro ao salvar conversa' }, { status: 500 });
   }
}

/**
 * PATCH /api/admin/ai-conversations
 * Toggle approved status for a conversation.
 * Body: { id, approved }
 */
export async function PATCH(req: Request) {
   if (!(await checkAdmin())) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
   }
   try {
      const { id, approved } = await req.json();
      const conv = await prisma.aIConversationLog.update({
         where: { id },
         data: { approved },
      });
      return NextResponse.json({ id: conv.id, approved: conv.approved });
   } catch (e) {
      return NextResponse.json({ error: 'Erro ao atualizar conversa' }, { status: 500 });
   }
}

/**
 * DELETE /api/admin/ai-conversations?id=xxx
 */
export async function DELETE(req: Request) {
   if (!(await checkAdmin())) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
   }
   try {
      const { searchParams } = new URL(req.url);
      const id = searchParams.get('id');
      if (!id) return NextResponse.json({ error: 'id obrigatório' }, { status: 400 });
      await prisma.aIConversationLog.delete({ where: { id } });
      return NextResponse.json({ success: true });
   } catch (e) {
      return NextResponse.json({ error: 'Erro ao excluir conversa' }, { status: 500 });
   }
}
