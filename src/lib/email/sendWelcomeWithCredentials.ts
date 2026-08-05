import { sendEmail } from '@/lib/emailService';
import prisma from '@/lib/prisma';

interface WelcomeCredentialsParams {
  toEmail: string;
  firstName: string;
  password: string;
  resNumber?: string;
}

/**
 * Envia e-mail de boas-vindas para cliente que teve conta criada automaticamente
 * durante o checkout sem login (guest checkout).
 */
export async function sendWelcomeWithCredentials({
  toEmail,
  firstName,
  password,
  resNumber,
}: WelcomeCredentialsParams): Promise<void> {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.europcar.com.br';
  const loginUrl = `${siteUrl}/reservas`;

  const subject = 'Sua conta Europcar Brasil foi criada — acesse suas reservas';

  const html = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Bem-vindo à Europcar Brasil</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

          <!-- Header -->
          <tr>
            <td style="background:#008d36;padding:28px 32px;text-align:center;">
              <img src="${siteUrl}/logo.jpg" alt="Europcar Brasil" width="140" style="height:auto;display:block;margin:0 auto;" />
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:36px 32px;">
              <h1 style="margin:0 0 8px 0;font-size:22px;font-weight:800;color:#111111;">
                Olá, ${firstName}! 👋
              </h1>
              <p style="margin:0 0 20px 0;font-size:15px;color:#444444;line-height:1.6;">
                Sua reserva foi confirmada com sucesso e criamos automaticamente uma conta para você na Europcar Brasil.
                Agora você pode acompanhar todas as suas reservas a qualquer momento.
              </p>

              ${resNumber ? `
              <!-- Reservation number -->
              <div style="background:#f0faf4;border:1px solid #c3e6cb;border-radius:8px;padding:16px 20px;margin-bottom:24px;text-align:center;">
                <p style="margin:0 0 4px 0;font-size:11px;font-weight:700;color:#008d36;text-transform:uppercase;letter-spacing:1px;">Número da Reserva</p>
                <p style="margin:0;font-size:28px;font-weight:900;color:#008d36;letter-spacing:3px;">${resNumber}</p>
              </div>
              ` : ''}

              <!-- Credentials box -->
              <div style="background:#f8f9fa;border:1px solid #e9ecef;border-radius:8px;padding:20px 24px;margin-bottom:28px;">
                <p style="margin:0 0 14px 0;font-size:13px;font-weight:700;color:#333333;text-transform:uppercase;letter-spacing:0.5px;">
                  🔑 Seus dados de acesso
                </p>
                <table width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="padding:6px 0;font-size:13px;color:#666666;width:80px;">E-mail:</td>
                    <td style="padding:6px 0;font-size:13px;font-weight:700;color:#111111;">${toEmail}</td>
                  </tr>
                  <tr>
                    <td style="padding:6px 0;font-size:13px;color:#666666;">Senha:</td>
                    <td style="padding:6px 0;">
                      <span style="font-size:15px;font-weight:800;color:#111111;background:#fff3cd;padding:2px 10px;border-radius:4px;letter-spacing:1px;font-family:monospace;">${password}</span>
                    </td>
                  </tr>
                </table>
              </div>

              <p style="margin:0 0 6px 0;font-size:13px;color:#888888;">
                ⚠️ Por segurança, recomendamos que você altere sua senha após o primeiro acesso.
              </p>

              <!-- CTA Button -->
              <div style="text-align:center;margin:28px 0 8px 0;">
                <a href="${loginUrl}" target="_blank"
                   style="display:inline-block;background:#008d36;color:#ffffff;text-decoration:none;font-size:15px;font-weight:700;padding:14px 36px;border-radius:8px;letter-spacing:0.3px;">
                  Acessar Minhas Reservas
                </a>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f8f9fa;border-top:1px solid #e9ecef;padding:20px 32px;text-align:center;">
              <p style="margin:0 0 4px 0;font-size:11px;color:#aaaaaa;">
                Europcar Brasil — Grupo Mercatta. Todos os direitos reservados.
              </p>
              <p style="margin:0;font-size:11px;color:#cccccc;">
                Se não foi você quem fez esta reserva, entre em contato: reservas@europcar.com.br
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();

  try {
    // Resolve the configured sender address (same as emailService internal logic)
    let fromEmail = 'nao-responda@europcar.com.br';
    try {
      const configFrom = await prisma.contentBlock.findUnique({ where: { key: 'RESEND_FROM_EMAIL' } });
      if (configFrom?.value_ptBR) fromEmail = configFrom.value_ptBR;
    } catch { /* fallback to default */ }

    await sendEmail(fromEmail, toEmail, subject, html);
  } catch (err) {
    // Never throw — e-mail failure should not block the reservation confirmation
    console.error('[sendWelcomeWithCredentials] Falha ao enviar e-mail de boas-vindas:', err);
  }
}
