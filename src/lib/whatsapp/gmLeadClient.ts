/**
 * GM Lead WhatsApp Client
 * Suporta: text, template HSM e flow de automação.
 * Documentação: https://api.gmlead.com.br
 */

export type MessageType = 'text' | 'template' | 'flow';

interface GmLeadConfig {
  baseUrl?: string;
  token: string;
}

export interface SendTextOptions {
  number: string;
  body: string;
  closeTicket?: boolean;
}

export interface SendTemplateOptions {
  number: string;
  templateName: string;
  bodyParameters?: string[];
  headerImageUrl?: string;
  headerVideoUrl?: string;
  headerDocumentUrl?: string;
  headerDocumentFilename?: string;
}

export interface SendFlowOptions {
  number: string;
  flowId: string;
  closeTicket?: boolean;
}

export class GmLeadClient {
  private baseUrl: string;
  private token: string;

  constructor({ baseUrl = 'https://api.gmlead.com.br', token }: GmLeadConfig) {
    this.baseUrl = baseUrl;
    this.token = token;
  }

  private get headers() {
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.token}`,
    };
  }

  /** Sanitiza número: mantém apenas dígitos */
  static sanitizeNumber(raw: string): string {
    return raw.replace(/\D/g, '');
  }

  /** Envia uma mensagem de texto simples */
  async sendText({ number, body, closeTicket = false }: SendTextOptions) {
    const cleanNumber = GmLeadClient.sanitizeNumber(number);
    const res = await fetch(`${this.baseUrl}/api/messages/send`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({ number: cleanNumber, body, closeTicket }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.message || `Erro ao enviar texto para ${cleanNumber}`);
    return data;
  }

  /** Envia um template HSM aprovado */
  async sendTemplate({
    number,
    templateName,
    bodyParameters,
    headerImageUrl,
    headerVideoUrl,
    headerDocumentUrl,
    headerDocumentFilename,
  }: SendTemplateOptions) {
    const cleanNumber = GmLeadClient.sanitizeNumber(number);
    const res = await fetch(`${this.baseUrl}/api/messages/template`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({
        number: cleanNumber,
        templateName,
        bodyParameters,
        headerImageUrl,
        headerVideoUrl,
        headerDocumentUrl,
        headerDocumentFilename,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.message || `Erro ao enviar template para ${cleanNumber}`);
    return data;
  }

  /** Dispara um fluxo de automação */
  async sendFlow({ number, flowId, closeTicket = false }: SendFlowOptions) {
    const cleanNumber = GmLeadClient.sanitizeNumber(number);
    const res = await fetch(`${this.baseUrl}/api/messages/send-flow`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({ number: cleanNumber, flowId, closeTicket }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.message || `Erro ao disparar fluxo para ${cleanNumber}`);
    return data;
  }

  /** Testa a conexão enviando texto para um número de controle */
  async testConnection(testNumber: string): Promise<{ ok: boolean; message: string }> {
    try {
      await this.sendText({
        number: testNumber,
        body: '✅ Conexão GM Lead testada com sucesso pela Europcar Brasil.',
      });
      return { ok: true, message: 'Conexão OK' };
    } catch (err: any) {
      return { ok: false, message: err.message || 'Falha na conexão' };
    }
  }
}
