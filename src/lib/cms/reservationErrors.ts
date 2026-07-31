import prisma from '@/lib/prisma';

/**
 * Mapeamento de erros de pagamento/reserva → mensagem amigável, editável pelo
 * admin via CMS (tabela ContentBlock, chave "reservation.error.<code>"). Isso
 * evita mensagens fixas no código: quando a Cielo ou o XRS retornam um código
 * conhecido (ex: ReturnCode 129 "Affiliation not found"), buscamos o texto
 * correspondente no CMS antes de cair no fallback técnico.
 */
export async function getReservationErrorMessage(code: string | number | undefined | null, fallback: string): Promise<string> {
  if (!code && code !== 0) return fallback;
  try {
    const block = await prisma.contentBlock.findUnique({
      where: { key: `reservation.error.${code}` },
    });
    return block?.value_ptBR || fallback;
  } catch (err) {
    console.warn('[CMS] Falha ao buscar reservation.error:', (err as Error).message);
    return fallback;
  }
}
