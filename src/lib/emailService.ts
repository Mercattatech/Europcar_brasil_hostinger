import { Resend } from 'resend';
import nodemailer from 'nodemailer';
import prisma from '@/lib/prisma';

let resendInstance: Resend | null = null;
let currentApiKey = '';

// ─── Resend Client ───────────────────────────────────────────
async function getResendClient() {
  const configApiKey = await prisma.contentBlock.findUnique({ where: { key: 'RESEND_API_KEY' } });
  const apiKey = configApiKey?.value_ptBR;

  if (!apiKey) return null;

  if (!resendInstance || currentApiKey !== apiKey) {
    resendInstance = new Resend(apiKey);
    currentApiKey = apiKey;
  }
  return resendInstance;
}

// ─── SMTP Config Loader ─────────────────────────────────────
async function getSmtpConfig() {
  const keys = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'SMTP_SECURE'];
  const blocks = await prisma.contentBlock.findMany({
    where: { key: { in: keys } }
  });

  const map: Record<string, string> = {};
  for (const b of blocks) {
    map[b.key] = b.value_ptBR || '';
  }

  if (!map.SMTP_HOST || !map.SMTP_PORT || !map.SMTP_USER || !map.SMTP_PASS) {
    return null;
  }

  return {
    host: map.SMTP_HOST,
    port: parseInt(map.SMTP_PORT, 10) || 587,
    secure: map.SMTP_SECURE === 'true',
    auth: {
      user: map.SMTP_USER,
      pass: map.SMTP_PASS,
    }
  };
}

// ─── Email Provider Preference ───────────────────────────────
async function getEmailProvider(): Promise<'SMTP' | 'RESEND'> {
  const block = await prisma.contentBlock.findUnique({ where: { key: 'EMAIL_PROVIDER' } });
  const val = block?.value_ptBR?.toUpperCase();
  if (val === 'SMTP') return 'SMTP';
  return 'RESEND';
}

// ─── From Email ──────────────────────────────────────────────
async function getFromEmail() {
  const configFrom = await prisma.contentBlock.findUnique({ where: { key: 'RESEND_FROM_EMAIL' } });
  return configFrom?.value_ptBR || 'nao-responda@europcar.com.br';
}

// ─── Template Loader ─────────────────────────────────────────
async function getTemplateHtml(trigger: string): Promise<{ subject: string, html: string } | null> {
  const triggersBlock = await prisma.contentBlock.findUnique({ where: { key: 'EMAIL_TRIGGERS' } });
  if (!triggersBlock?.value_ptBR) return null;

  const templatesBlock = await prisma.contentBlock.findUnique({ where: { key: 'EMAIL_TEMPLATES' } });
  if (!templatesBlock?.value_ptBR) return null;

  try {
    const triggers = JSON.parse(triggersBlock.value_ptBR);
    const templates = JSON.parse(templatesBlock.value_ptBR);

    const templateId = triggers[trigger];
    if (!templateId) return null;

    const template = templates.find((t: any) => t.id === templateId);
    if (!template) return null;

    return { subject: template.subject, html: template.html };
  } catch (e) {
    return null;
  }
}

// ─── Monthly Counter ─────────────────────────────────────────
async function incrementMonthlyCounter() {
  const monthKey = new Date().toISOString().slice(0, 7);
  
  let block = await prisma.contentBlock.findUnique({ where: { key: 'RESEND_MONTHLY_COUNT' } });
  let data: any = {};
  if (block?.value_ptBR) {
    try { data = JSON.parse(block.value_ptBR); } catch(e){}
  }
  
  if (data.month !== monthKey) {
    data = { month: monthKey, count: 1 };
  } else {
    data.count = (data.count || 0) + 1;
  }

  await prisma.contentBlock.upsert({
    where: { key: 'RESEND_MONTHLY_COUNT' },
    update: { value_ptBR: JSON.stringify(data) },
    create: { key: 'RESEND_MONTHLY_COUNT', value_ptBR: JSON.stringify(data) }
  });
}

// ─── Send via SMTP (Nodemailer) ──────────────────────────────
async function sendViaSmtp(fromEmail: string, to: string, subject: string, html: string): Promise<{ success: boolean; error?: string }> {
  const smtpConfig = await getSmtpConfig();
  if (!smtpConfig) {
    return { success: false, error: 'SMTP não configurado' };
  }

  try {
    const transporter = nodemailer.createTransport(smtpConfig);
    await transporter.sendMail({
      from: `Europcar Brasil <${fromEmail}>`,
      to,
      subject,
      html,
    });
    return { success: true };
  } catch (error: any) {
    console.error('[SMTP] Erro ao enviar:', error.message);
    return { success: false, error: error.message };
  }
}

// ─── Send via Resend ─────────────────────────────────────────
async function sendViaResend(fromEmail: string, to: string, subject: string, html: string): Promise<{ success: boolean; error?: string; data?: any }> {
  const resend = await getResendClient();
  if (!resend) {
    return { success: false, error: 'Resend API KEY não configurada' };
  }

  try {
    const { data, error } = await resend.emails.send({
      from: `Europcar Brasil <${fromEmail}>`,
      to,
      subject,
      html,
    });

    if (error) {
      console.error('[Resend] Erro:', error);
      return { success: false, error: JSON.stringify(error) };
    }

    return { success: true, data };
  } catch (error: any) {
    console.error('[Resend] Falha crítica:', error.message);
    return { success: false, error: error.message };
  }
}

// ─── Core: Send Email (with provider selection + fallback) ───
async function sendEmail(fromEmail: string, to: string, subject: string, html: string): Promise<{ success: boolean; provider?: string; error?: string; data?: any }> {
  const provider = await getEmailProvider();

  if (provider === 'SMTP') {
    // Try SMTP first
    const smtpResult = await sendViaSmtp(fromEmail, to, subject, html);
    if (smtpResult.success) {
      return { success: true, provider: 'SMTP' };
    }

    // Fallback to Resend
    console.warn(`[Email] SMTP falhou (${smtpResult.error}). Tentando fallback via Resend...`);
    const resendResult = await sendViaResend(fromEmail, to, subject, html);
    if (resendResult.success) {
      return { success: true, provider: 'RESEND (fallback)', data: resendResult.data };
    }

    return { success: false, error: `SMTP: ${smtpResult.error} | Resend: ${resendResult.error}` };
  }

  // Provider is RESEND (default)
  const resendResult = await sendViaResend(fromEmail, to, subject, html);
  if (resendResult.success) {
    return { success: true, provider: 'RESEND', data: resendResult.data };
  }

  return { success: false, error: resendResult.error };
}

// ─── Public: Send Transactional Email via Trigger ────────────
/**
 * Dispara e-mail baseado no trigger.
 * dataVars: Dicionário contendo as chaves para substituir no template (ex: { NOME: 'João' })
 */
export async function sendTransactionalEmail(to: string, trigger: string, dataVars: Record<string, string>) {
  try {
    const template = await getTemplateHtml(trigger);
    if (!template || !template.html) {
      console.warn(`Template não encontrado para o trigger ${trigger}. E-mail não enviado.`);
      return { success: false, error: 'Template não encontrado' };
    }

    const fromEmail = await getFromEmail();

    // Replace variables (e.g. {{NOME}} => João)
    let parsedHtml = template.html;
    let parsedSubject = template.subject;
    for (const [key, value] of Object.entries(dataVars)) {
      const regex = new RegExp(`{{${key}}}`, 'g');
      parsedHtml = parsedHtml.replace(regex, value || '');
      parsedSubject = parsedSubject.replace(regex, value || '');
    }

    const result = await sendEmail(fromEmail, to, parsedSubject, parsedHtml);

    if (result.success) {
      await incrementMonthlyCounter();
      console.log(`[Email] ✅ Enviado via ${result.provider} para ${to} (trigger: ${trigger})`);
    }

    return result;
  } catch (error: any) {
    console.error('Falha crítica ao enviar e-mail:', error);
    return { success: false, error: error.message };
  }
}

// ─── Public: Send Test Email (for SMTP/Resend testing) ───────
export async function sendTestEmail(to: string): Promise<{ success: boolean; provider?: string; error?: string }> {
  try {
    const fromEmail = await getFromEmail();
    const subject = '✅ Teste de Configuração — Europcar Brasil';
    const html = `
<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,Helvetica,sans-serif;">
  <div style="max-width:520px;margin:32px auto;background:#ffffff;border-radius:10px;overflow:hidden;box-shadow:0 4px 16px rgba(0,0,0,0.08);">
    <div style="background:#008d36;padding:28px 32px;text-align:center;">
      <div style="font-size:28px;font-weight:900;font-style:italic;color:#fff;letter-spacing:-1px;">Europcar</div>
      <div style="color:rgba(255,255,255,0.7);font-size:12px;margin-top:4px;">Teste de Configuração de E-mail</div>
    </div>
    <div style="padding:32px;text-align:center;">
      <div style="font-size:48px;margin-bottom:16px;">✅</div>
      <h2 style="color:#111827;margin:0 0 8px;">Configuração OK!</h2>
      <p style="color:#6b7280;font-size:14px;margin:0;">
        Se você está recebendo este e-mail, sua configuração de envio está funcionando corretamente.
      </p>
      <div style="margin-top:20px;padding:12px 16px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;">
        <p style="color:#166534;font-size:13px;margin:0;"><strong>Provedor utilizado:</strong> Será informado no painel.</p>
        <p style="color:#166534;font-size:13px;margin:4px 0 0;">
          <strong>Data/Hora:</strong> ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}
        </p>
      </div>
    </div>
    <div style="background:#f9fafb;border-top:1px solid #e5e7eb;padding:16px 32px;text-align:center;">
      <p style="color:#9ca3af;font-size:11px;margin:0;">E-mail automático de teste — Europcar Brasil</p>
    </div>
  </div>
</body>
</html>`;

    const result = await sendEmail(fromEmail, to, subject, html);
    return result;
  } catch (error: any) {
    console.error('[TestEmail] Erro:', error.message);
    return { success: false, error: error.message };
  }
}
