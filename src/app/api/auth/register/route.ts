import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { sendTransactionalEmail } from "@/lib/emailService";

export const dynamic = 'force-dynamic';

// Welcome email HTML template
function buildWelcomeHtml(name: string) {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,Helvetica,sans-serif;">
  <div style="max-width:560px;margin:32px auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 16px rgba(0,0,0,0.08);">
    <div style="background:#008d36;padding:32px;text-align:center;">
      <div style="font-size:32px;font-weight:900;font-style:italic;color:#fff;letter-spacing:-1px;">Europcar</div>
      <div style="color:rgba(255,255,255,0.75);font-size:13px;margin-top:4px;">Bem-vindo à Europcar Brasil</div>
    </div>
    <div style="padding:32px;">
      <h2 style="color:#111827;margin:0 0 12px;font-size:20px;">Olá, ${name}! 👋</h2>
      <p style="color:#4b5563;font-size:14px;line-height:1.7;margin:0 0 16px;">
        Seu cadastro foi realizado com sucesso! Agora você pode acessar nossa plataforma e reservar veículos com facilidade.
      </p>
      <div style="background:#fef3c7;border:1px solid #f59e0b;border-radius:8px;padding:16px;margin:20px 0;">
        <p style="color:#92400e;font-size:13px;font-weight:bold;margin:0 0 4px;">⚠️ Importante</p>
        <p style="color:#92400e;font-size:13px;margin:0;line-height:1.5;">
          Este cadastro é válido <strong>apenas para Europcar Brasil</strong>. Para utilizar os serviços da Europcar em outros países, é necessário realizar o cadastro diretamente no site do país desejado.
        </p>
      </div>
      <p style="color:#4b5563;font-size:14px;line-height:1.7;margin:16px 0 0;">
        Se você tiver dúvidas, entre em contato conosco pelo nosso site.
      </p>
      <div style="text-align:center;margin-top:24px;">
        <a href="https://www.europcar.com.br" style="display:inline-block;background:#008d36;color:#fff;font-weight:bold;font-size:14px;text-decoration:none;padding:12px 32px;border-radius:8px;">Acessar Europcar Brasil</a>
      </div>
    </div>
    <div style="background:#f9fafb;border-top:1px solid #e5e7eb;padding:16px 32px;text-align:center;">
      <p style="color:#9ca3af;font-size:11px;margin:0;">E-mail automático — Europcar Brasil. Não responda este e-mail.</p>
    </div>
  </div>
</body>
</html>`;
}

export async function POST(req: Request) {
  try {
    const { name, email, password, phone, city, cpf } = await req.json();

    if (!name || !email || !password) {
      return new NextResponse("Dados insuficientes", { status: 400 });
    }

    const exist = await prisma.user.findUnique({ where: { email } });
    if (exist) {
      return new NextResponse("E-mail já está em uso", { status: 400 });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    // New users are ALWAYS USER — never ADMIN
    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role: "USER",
        phone: phone || null,
        city: city || null,
        cpf: cpf || null,
      },
    });

    // Send welcome email (fire-and-forget — don't block the response)
    sendTransactionalEmail(email, 'WELCOME', { NOME: name }).catch((err) => {
      console.warn('[Register] Transactional email failed, trying direct HTML...', err?.message);
    });

    // Also try direct HTML email as a fallback
    import('@/lib/emailService').then(async (mod) => {
      // The sendTransactionalEmail uses DB templates; if no template exists,
      // we send the hardcoded welcome email directly
      try {
        const fromBlock = await prisma.contentBlock.findUnique({ where: { key: 'RESEND_FROM_EMAIL' } });
        const fromEmail = fromBlock?.value_ptBR || 'nao-responda@europcar.com.br';
        
        // Check if transactional trigger exists
        const triggersBlock = await prisma.contentBlock.findUnique({ where: { key: 'EMAIL_TRIGGERS' } });
        let hasWelcomeTrigger = false;
        if (triggersBlock?.value_ptBR) {
          try {
            const triggers = JSON.parse(triggersBlock.value_ptBR);
            hasWelcomeTrigger = !!triggers['WELCOME'];
          } catch {}
        }

        // If no trigger configured, send hardcoded email
        if (!hasWelcomeTrigger) {
          const nodemailer = await import('nodemailer');
          const smtpKeys = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'SMTP_SECURE'];
          const blocks = await prisma.contentBlock.findMany({ where: { key: { in: smtpKeys } } });
          const map: Record<string, string> = {};
          for (const b of blocks) map[b.key] = b.value_ptBR || '';
          
          if (map.SMTP_HOST && map.SMTP_USER && map.SMTP_PASS) {
            const transporter = nodemailer.default.createTransport({
              host: map.SMTP_HOST,
              port: parseInt(map.SMTP_PORT || '587', 10),
              secure: map.SMTP_SECURE === 'true',
              auth: { user: map.SMTP_USER, pass: map.SMTP_PASS },
              tls: { rejectUnauthorized: false },
            });
            await transporter.sendMail({
              from: `Europcar Brasil <${map.SMTP_USER}>`,
              to: email,
              subject: 'Bem-vindo à Europcar Brasil! ✅',
              html: buildWelcomeHtml(name),
            });
            console.log(`[Register] ✅ Welcome email sent to ${email}`);
          }
        }
      } catch (e: any) {
        console.warn('[Register] Direct welcome email failed:', e?.message);
      }
    });

    return NextResponse.json({ id: user.id, name: user.name, email: user.email });
  } catch (error: any) {
    console.error("ERRO NO CADASTRO", error);
    return new NextResponse("Erro interno no servidor", { status: 500 });
  }
}

