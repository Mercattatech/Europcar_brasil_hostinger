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

    await resend.emails.send({
      from: "Europcar Brasil <noreply@europcar.com.br>",
      to: email,
      subject: "Redefinição de senha — Europcar Brasil",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 520px; margin: 0 auto; background: #fff; border-radius: 8px; overflow: hidden; border: 1px solid #e5e7eb;">
          <div style="background: #008d36; padding: 24px; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 24px; font-weight: 900; font-style: italic;">Europcar</h1>
          </div>
          <div style="padding: 32px;">
            <h2 style="color: #1a1a1a; font-size: 20px; margin-bottom: 8px;">Redefinição de senha</h2>
            <p style="color: #4b5563; font-size: 15px; margin-bottom: 24px;">
              Recebemos uma solicitação para redefinir a senha da sua conta <strong>${email}</strong>.<br/>
              Clique no botão abaixo para criar uma nova senha. O link expira em <strong>1 hora</strong>.
            </p>
            <a href="${resetLink}"
               style="display: inline-block; background: #008d36; color: white; padding: 14px 32px; border-radius: 6px; font-weight: bold; font-size: 16px; text-decoration: none; margin-bottom: 24px;">
              Redefinir minha senha
            </a>
            <p style="color: #9ca3af; font-size: 13px; margin-top: 16px;">
              Se você não solicitou a redefinição, ignore este e-mail. Sua senha permanece a mesma.
            </p>
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;"/>
            <p style="color: #d1d5db; font-size: 12px;">© 2025 Europcar Brasil. Todos os direitos reservados.</p>
          </div>
        </div>
      `,
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("[forgot-password]", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
