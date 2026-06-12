import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { Resend } from "resend";
import { randomUUID } from "crypto";

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const { email } = await req.json();

    if (!email) {
      return NextResponse.json({ error: "E-mail obrigatório" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    // Always return success to avoid email enumeration
    if (!user) {
      return NextResponse.json({ success: true });
    }

    // Invalidate previous tokens for this email
    await prisma.passwordResetToken.updateMany({
      where: { email, used: false },
      data: { used: true },
    });

    const token = randomUUID();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await prisma.passwordResetToken.create({
      data: { email, token, expiresAt },
    });

    const baseUrl = process.env.NEXTAUTH_URL || "https://europcar.com.br";
    const resetLink = `${baseUrl}/reset-senha?token=${token}`;

    import('@/lib/emailService').then(({ sendTransactionalEmail }) => {
       sendTransactionalEmail(email, 'RESET_SENHA', {
          NOME: user.name || '',
          LINK_RESET: resetLink
       }).catch(console.error);
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("[forgot-password]", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
