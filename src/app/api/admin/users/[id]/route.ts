import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import bcrypt from 'bcryptjs';
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

// PATCH /api/admin/users/[id] - Update user (role, status, password, name)
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
   if (!(await checkAdmin())) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
   }

   try {
      const body = await req.json();
      const updateData: any = {};

      if (body.role !== undefined) updateData.role = body.role;
      if (body.status !== undefined) updateData.status = body.status;
      if (body.name !== undefined) updateData.name = body.name;

      if (body.newPassword) {
         const hashed = await bcrypt.hash(body.newPassword, 10);
         updateData.password = hashed;
      }

      const updatedUser = await prisma.user.update({
         where: { id: params.id },
         data: updateData,
         select: {
            id: true,
            name: true,
            email: true,
            role: true,
            status: true,
            createdAt: true,
         }
      });

      return NextResponse.json(updatedUser);
   } catch (error: any) {
      console.error('Error updating user:', error);
      return NextResponse.json({ error: 'Erro ao atualizar usuário' }, { status: 500 });
   }
}

// DELETE /api/admin/users/[id] - Delete user and all related data
export async function DELETE(req: Request, { params }: { params: { id: string } }) {
   if (!(await checkAdmin())) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
   }

   try {
      // Delete related data first (sessions, accounts)
      await prisma.session.deleteMany({ where: { userId: params.id } });
      await prisma.account.deleteMany({ where: { userId: params.id } });
      await prisma.user.delete({ where: { id: params.id } });

      return NextResponse.json({ success: true });
   } catch (error: any) {
      console.error('Error deleting user:', error);
      return NextResponse.json({ error: 'Erro ao excluir usuário' }, { status: 500 });
   }
}
