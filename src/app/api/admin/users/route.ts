import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import bcrypt from 'bcrypt';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';

export const dynamic = 'force-dynamic';

const ADMIN_EMAILS = ["grupomercatta@gmail.com", "matheus@grupomercatta.com.br", "matheusconti@gmail.com", "matheus@grupomercatta.com"];

async function checkAdmin() {
   const session = await getServerSession(authOptions);
   if (!session?.user?.email) return false;
   if (ADMIN_EMAILS.includes(session.user.email)) return true;
   const dbUser = await prisma.user.findUnique({ where: { email: session.user.email } });
   return dbUser?.role === 'ADMIN';
}

export async function GET() {
   try {
      if (!(await checkAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      const users = await prisma.user.findMany({ orderBy: { createdAt: 'desc' } });
      return NextResponse.json(users);
   } catch (error) {
      return NextResponse.json({ error: 'Erro ao buscar' }, { status: 500 });
   }
}

export async function POST(req: Request) {
   try {
      if (!(await checkAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      const { name, email, password, role } = await req.json();

      if (!email || !password) {
         return NextResponse.json({ error: 'E-mail e senha são obrigatórios' }, { status: 400 });
      }

      const exist = await prisma.user.findUnique({ where: { email } });
      if (exist) {
         return NextResponse.json({ error: 'E-mail já cadastrado' }, { status: 400 });
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      const user = await prisma.user.create({
         data: {
            name,
            email,
            password: hashedPassword,
            role: role || 'USER',
            status: 'ACTIVE'
         }
      });

      return NextResponse.json(user);
   } catch (error: any) {
      console.error(error);
      return NextResponse.json({ error: 'Erro ao criar usuário' }, { status: 500 });
   }
}

// Keeping PUT just in case something still uses it, but we prefer PATCH on [id]
export async function PUT(req: Request) {
   try {
      if (!(await checkAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      const { id, role } = await req.json();
      const updatedUser = await prisma.user.update({
         where: { id },
         data: { role }
      });
      return NextResponse.json(updatedUser);
   } catch (error) {
      return NextResponse.json({ error: 'Erro ao atualizar usuário' }, { status: 500 });
   }
}
