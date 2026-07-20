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
      return false; // DB might be unreachable
   }
}

export async function GET(req: Request) {
   if (!(await checkAdmin())) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
   }
   try {
      let config = await prisma.aIAgentConfig.findFirst();
      if (!config) {
         config = await prisma.aIAgentConfig.create({
            data: { isActive: true, positivePrompt: "", negativePrompt: "" }
         });
      }
      return NextResponse.json(config);
   } catch (error) {
      console.error("Erro ao buscar AI Config:", error);
      return NextResponse.json({ isActive: false, positivePrompt: "", negativePrompt: "" }); // Fallback on DB error
   }
}

export async function POST(req: Request) {
   if (!(await checkAdmin())) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
   }
   try {
      const body = await req.json();
      const { isActive, positivePrompt, negativePrompt } = body;
      
      let config = await prisma.aIAgentConfig.findFirst();
      if (config) {
         config = await prisma.aIAgentConfig.update({
            where: { id: config.id },
            data: { isActive, positivePrompt, negativePrompt }
         });
      } else {
         config = await prisma.aIAgentConfig.create({
            data: { isActive, positivePrompt, negativePrompt }
         });
      }
      return NextResponse.json(config);
   } catch (error) {
      console.error("Erro ao salvar AI Config:", error);
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
   }
}
