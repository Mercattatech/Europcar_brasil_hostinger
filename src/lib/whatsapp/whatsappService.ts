/**
 * WhatsApp Service — Europcar Brasil
 *
 * Orquestra disparos de WhatsApp via GM Lead para dois públicos:
 *  1. Cliente que gerou a reserva (telefone do customerData)
 *  2. Lista de números internos cadastrados no painel (/painel/whatsapp)
 *
 * Configurações lidas do banco (ContentBlock com prefixo WA_):
 *  - WA_TOKEN        — Bearer token do GM Lead
 *  - WA_NUMBERS      — JSON array de strings: ["5511999999999", ...]
 *  - WA_INTERVAL_MS  — intervalo entre envios em ms (padrão: 10000)
 *  - WA_TRIGGER_<TRIGGER> — JSON com { type, body, templateName, bodyParams, flowId }
 */

import prisma from '@/lib/prisma';
import { GmLeadClient } from './gmLeadClient';

export type WaTrigger = 'RESERVA_SUCESSO' | 'RESERVA_BALCAO' | 'CANCELAMENTO';

export interface WaTriggerVariables {
  NOME?: string;
  SOBRENOME?: string;
  NUMERO_RESERVA?: string;
  TELEFONE_CLIENTE?: string;
  CARRO?: string;
  DATA_RETIRADA?: string;
  DATA_DEVOLUCAO?: string;
  LOCAL_RETIRADA?: string;
  LOCAL_DEVOLUCAO?: string;
  VALOR_TOTAL?: string;
  FORMA_PAGAMENTO?: string;
}

interface WaTriggerConfig {
  type: 'text' | 'template' | 'flow';
  body?: string;           // Para type=text (com variáveis {{NOME}} etc.)
  templateName?: string;   // Para type=template
  bodyParams?: string[];   // Parâmetros do template (substituídos em ordem)
  flowId?: string;         // Para type=flow
  enabled: boolean;
}

/** Substitui variáveis {{NOME}} em um texto */
function interpolate(template: string, vars: WaTriggerVariables): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    return (vars as Record<string, string>)[key] ?? `{{${key}}}`;
  });
}

/** Carrega um ContentBlock com prefixo WA_ */
async function getWaConfig(key: string): Promise<string | null> {
  try {
    const block = await prisma.contentBlock.findUnique({
      where: { key: `WA_${key}` },
    });
    return block?.value_ptBR || null;
  } catch {
    return null;
  }
}

/**
 * Dispara WhatsApp para todos os destinatários configurados.
 *
 * @param trigger - Identificador do gatilho (RESERVA_SUCESSO | CANCELAMENTO)
 * @param vars    - Variáveis para substituição no template
 * @param clientPhone - Telefone do cliente (disparo direto para ele, opcional)
 */
export async function sendWhatsappTrigger(
  trigger: WaTrigger,
  vars: WaTriggerVariables,
  clientPhone?: string,
): Promise<void> {
  // 1. Carrega configurações base
  const token = await getWaConfig('TOKEN');
  if (!token) {
    throw new Error('WA_TOKEN não configurado. Salve o token GM Lead no painel.');
  }

  const triggerRaw = await getWaConfig(`TRIGGER_${trigger}`);
  if (!triggerRaw) {
    throw new Error(`Gatilho "${trigger}" não configurado no banco. Acesse o painel, configure e clique em Salvar Tudo.`);
  }

  let triggerCfg: WaTriggerConfig;
  try {
    triggerCfg = JSON.parse(triggerRaw);
  } catch {
    console.error(`[whatsapp] Falha ao parsear WA_TRIGGER_${trigger}`);
    return;
  }

  if (!triggerCfg.enabled) {
    throw new Error(`Gatilho "${trigger}" está DESABILITADO. Ative o toggle no painel e clique em Salvar Tudo.`);
  }

  // 2. Monta lista de destinatários
  const numbersRaw = await getWaConfig('NUMBERS');
  const internalNumbers: string[] = [];
  if (numbersRaw) {
    try {
      const parsed = JSON.parse(numbersRaw);
      if (Array.isArray(parsed)) internalNumbers.push(...parsed.filter(Boolean));
    } catch {}
  }

  // Lista final: cliente primeiro (se tiver telefone), depois internos
  const allNumbers: string[] = [];
  if (clientPhone) {
    const cleaned = clientPhone.replace(/\D/g, '');
    if (cleaned.length >= 10) allNumbers.push(cleaned);
  }
  for (const n of internalNumbers) {
    const cleaned = n.replace(/\D/g, '');
    if (cleaned.length >= 10 && !allNumbers.includes(cleaned)) {
      allNumbers.push(cleaned);
    }
  }

  if (allNumbers.length === 0) {
    throw new Error('Nenhum número de destino configurado. Cadastre ao menos um número interno no painel ou passe o telefone do cliente.');
  }

  // 3. Intervalo entre envios
  const intervalRaw = await getWaConfig('INTERVAL_MS');
  const intervalMs = parseInt(intervalRaw || '10000', 10) || 10000;

  // 4. Cliente GM Lead
  const gm = new GmLeadClient({ token });

  // 5. Dispara para cada número com delay
  for (let i = 0; i < allNumbers.length; i++) {
    const number = allNumbers[i];

    if (i > 0) {
      await new Promise(resolve => setTimeout(resolve, intervalMs));
    }

    try {
      if (triggerCfg.type === 'text' && triggerCfg.body) {
        const body = interpolate(triggerCfg.body, vars);
        await gm.sendText({ number, body });
        console.log(`[whatsapp] ✅ Texto enviado para ${number} (${trigger})`);

      } else if (triggerCfg.type === 'template' && triggerCfg.templateName) {
        const bodyParameters = (triggerCfg.bodyParams || []).map(p => interpolate(p, vars));
        await gm.sendTemplate({ number, templateName: triggerCfg.templateName, bodyParameters });
        console.log(`[whatsapp] ✅ Template "${triggerCfg.templateName}" enviado para ${number} (${trigger})`);

      } else if (triggerCfg.type === 'flow' && triggerCfg.flowId) {
        await gm.sendFlow({ number, flowId: triggerCfg.flowId });
        console.log(`[whatsapp] ✅ Flow "${triggerCfg.flowId}" disparado para ${number} (${trigger})`);

      } else {
        console.warn(`[whatsapp] Configuração inválida para trigger ${trigger}:`, triggerCfg);
      }
    } catch (err: any) {
      console.error(`[whatsapp] ❌ Falha ao enviar para ${number} (${trigger}):`, err.message);
    }
  }
}
