import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';

const ADMIN_EMAILS = ["grupomercatta@gmail.com", "matheus@grupomercatta.com.br", "matheusconti@gmail.com", "matheus@grupomercatta.com"];

async function checkAdmin() {
   const session = await getServerSession(authOptions);
   if (!session?.user?.email) return false;
   if (ADMIN_EMAILS.includes(session.user.email)) return true;
   const dbUser = await prisma.user.findUnique({ where: { email: session.user.email } });
   return dbUser?.role === 'ADMIN';
}

// Chaves usadas para armazenar as configs no ContentBlock
const TAG_KEYS = {
   googleAnalyticsId: 'google_analytics_id',
   gtmId: 'google_tag_manager_id',
   customHeadScripts: 'custom_head_scripts',
   customBodyScripts: 'custom_body_scripts',
};

// GET — Retorna todas as tags cadastradas
export async function GET() {
   if (!(await checkAdmin())) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
   }

   try {
      const keys = Object.values(TAG_KEYS);
      const configs = await prisma.contentBlock.findMany({
         where: { key: { in: keys } }
      });

      const result: Record<string, string> = {};
      for (const key of keys) {
         const found = configs.find(c => c.key === key);
         result[key] = found?.value_ptBR || '';
      }

      return NextResponse.json(result);
   } catch (error: any) {
      console.error('Tags API error:', error);
      return NextResponse.json({ error: 'Erro ao carregar tags' }, { status: 500 });
   }
}

// POST — Salva/atualiza as tags
export async function POST(request: Request) {
   if (!(await checkAdmin())) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
   }

   try {
      const body = await request.json();

      // Salvar cada tag como ContentBlock
      const updates = [];
      for (const [field, dbKey] of Object.entries(TAG_KEYS)) {
         const value = body[dbKey] !== undefined ? body[dbKey] : (body[field] || '');
         updates.push(
            prisma.contentBlock.upsert({
               where: { key: dbKey },
               update: { value_ptBR: String(value) },
               create: { key: dbKey, value_ptBR: String(value) },
            })
         );
      }

      await Promise.all(updates);

      return NextResponse.json({ success: true });
   } catch (error: any) {
      console.error('Tags API error:', error);
      return NextResponse.json({ error: 'Erro ao salvar tags' }, { status: 500 });
   }
}
