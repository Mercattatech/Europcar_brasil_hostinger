import { Resend } from 'resend';
import prisma from '@/lib/prisma';

let resendInstance: Resend | null = null;
let currentApiKey = '';

/**
 * Puxa os dados de configuração (API Key e Remetente) e instancia o Resend.
 */
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

/**
 * Puxa o e-mail do remetente
 */
async function getFromEmail() {
  const configFrom = await prisma.contentBlock.findUnique({ where: { key: 'RESEND_FROM_EMAIL' } });
  return configFrom?.value_ptBR || 'nao-responda@europcar.com.br';
}

/**
 * Puxa o template pelo ID mapeado no trigger
 */
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

/**
 * Atualiza a contagem mensal de e-mails enviados
 */
async function incrementMonthlyCounter() {
  const monthKey = new Date().toISOString().slice(0, 7); // ex: 2026-06
  
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

/**
 * Dispara e-mail baseado no trigger.
 * dataVars: Dicionário contendo as chaves para substituir no template (ex: { NOME: 'João' })
 */
export async function sendTransactionalEmail(to: string, trigger: string, dataVars: Record<string, string>) {
  try {
    const resend = await getResendClient();
    if (!resend) {
      console.warn('Resend API KEY não configurada. E-mail não enviado.');
      return { success: false, error: 'Resend não configurado' };
    }

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

    const { data, error } = await resend.emails.send({
      from: `Europcar Brasil <${fromEmail}>`,
      to,
      subject: parsedSubject,
      html: parsedHtml,
    });

    if (error) {
      console.error('Erro no Resend:', error);
      return { success: false, error };
    }

    await incrementMonthlyCounter();
    return { success: true, data };
  } catch (error: any) {
    console.error('Falha crítica ao enviar e-mail:', error);
    return { success: false, error: error.message };
  }
}
