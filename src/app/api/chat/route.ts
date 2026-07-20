import { openai } from '@ai-sdk/openai';
import { streamText, tool } from 'ai';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { getStations } from '@/lib/europcar/xrsClient';

// Allow responses up to 30 seconds
export const maxDuration = 30;
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const { messages } = await req.json();

  // Load config from DB
  let config = null;
  try {
     config = await prisma.aIAgentConfig.findFirst();
  } catch (e) {
     // DB not connected fallback
  }

  const isActive = config?.isActive ?? true;
  if (!isActive) {
      return new Response("O agente está desativado temporariamente.", { status: 403 });
  }
  
  const positive = config?.positivePrompt || "";
  const negative = config?.negativePrompt || "";

  const systemPrompt = `
Você é um assistente virtual experiente da Europcar Brasil. 
Sua função exclusiva é ajudar os clientes a encontrar e reservar carros de aluguel.
Seja direto, muito educado e use mensagens curtas (estilo WhatsApp).
IMPORTANTE: Se despeça sempre com cordialidade.

${positive ? `DIRETRIZES DE ATENDIMENTO:\n${positive}\n` : ''}
${negative ? `O QUE NUNCA FAZER:\n${negative}\n` : ''}

REGRAS RÍGIDAS:
- Nunca dê descontos não autorizados ou invente preços.
- Não lide com atendimento humano ou diga que vai transferir. Você mesmo resolve o fluxo da reserva pelo chat.
- Não trate de assuntos que não sejam aluguel de carros (reserva, preços, proteções).

FLUXO DA RESERVA (Passo a Passo OBRIGATÓRIO):
1. Cumprimente e pergunte qual a cidade/aeroporto de Retirada. (Ex: "Qual cidade ou aeroporto você deseja retirar o carro?")
2. Pergunte as Datas e Horários de Retirada e Devolução. (Tente pegar tudo em uma mensagem, ex: "Para quais datas?")
3. Pergunte se a devolução será na mesma cidade ou em outra.
4. Quando você tiver a cidade, USE A TOOL "searchStations" para achar os códigos das lojas na Europcar (Ex: FCOT01).
5. Depois de confirmar o código da loja e as datas, USE A TOOL "getRates" para buscar as opções de carros e tarifas. 
   -> Retorne ao usuário os 3 a 4 carros mais relevantes, COM FOTOS em Markdown e PREÇOS, além de sugerir Proteções e Extras disponíveis.
   -> Para mostrar fotos, use: ![Nome do Carro](https://static.europcar.com/carvisuals/partners/835x557/ACRISS_IT.png) substituindo ACRISS pelo código (ex: MBMR).
6. Quando o usuário escolher e confirmar um carro e os detalhes, USE A TOOL "generateCheckoutUrl" para gerar o link final e envie para o cliente concluir a reserva.
`;

  const result = streamText({
    model: openai('gpt-4o-mini'),
    system: systemPrompt,
    messages,
    tools: {
      searchStations: tool({
        description: 'Busca os códigos de lojas (stations) da Europcar pelo nome da cidade ou aeroporto. Obrigatório usar antes de cotar.',
        parameters: z.object({
          query: z.string().describe('Nome da cidade ou aeroporto. Ex: Roma, Miami, Guarulhos'),
        }),
        execute: async ({ query }) => {
           // We can reuse the API logic or call it directly via fetch
           // Note: since this runs on the server, we need absolute URL. It's safer to just implement a lightweight search here or call getStations directly.
           // To keep it simple, we use the country mappings if possible, but let's assume we can fetch our own endpoint
           try {
              const url = new URL(`${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/europcar/getStations?q=${encodeURIComponent(query)}`);
              const res = await fetch(url.toString());
              if (!res.ok) return { error: "Erro ao buscar lojas." };
              const data = await res.json();
              return { 
                 stations: data.stations.map((s: any) => ({
                    code: s.code,
                    name: s.name,
                    city: s.city,
                    country: s.country
                 }))
              };
           } catch(e: any) {
              return { error: e.message };
           }
        }
      }),
      
      getRates: tool({
        description: 'Busca os veículos disponíveis e preços (cotação) em tempo real.',
        parameters: z.object({
          pickupStation: z.string().describe('O código da loja de retirada. Ex: FCOT01'),
          returnStation: z.string().describe('O código da loja de devolução (igual ao pickup se for mesma). Ex: FCOT01'),
          pickupDate: z.string().describe('A data de retirada no formato AAAAMMDD. Ex: 20260715'),
          returnDate: z.string().describe('A data de devolução no formato AAAAMMDD. Ex: 20260720'),
          pickupTime: z.string().optional().describe('Horário de retirada HHMM. Padrão: 1000'),
          returnTime: z.string().optional().describe('Horário de devolução HHMM. Padrão: 1000')
        }),
        execute: async ({ pickupStation, returnStation, pickupDate, returnDate, pickupTime, returnTime }) => {
           try {
              const url = new URL(`${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/europcar/getCarCategories`);
              const resCats = await fetch(url.toString(), {
                 method: 'POST', headers: { 'Content-Type': 'application/json' },
                 body: JSON.stringify({ stationID: pickupStation })
              });
              const cats = await resCats.json();
              if (!cats || !cats.categories) return { error: "Nenhum carro encontrado para esta loja." };

              const acrissCodes = cats.categories.slice(0, 10).map((c: any) => c.code);

              const urlRates = new URL(`${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/europcar/getMultipleRates`);
              const resRates = await fetch(urlRates.toString(), {
                 method: 'POST', headers: { 'Content-Type': 'application/json' },
                 body: JSON.stringify({
                    pickupStation,
                    returnStation: returnStation || pickupStation,
                    pickupDate,
                    returnDate,
                    pickupTime: pickupTime || '1000',
                    returnTime: returnTime || '1000',
                    acrissCodes
                 })
              });
              const ratesData = await resRates.json();

              // Parse XML responses
              const options = [];
              for (const result of ratesData.results || []) {
                 const rates = result?.message?.serviceResponse?.reservationList?.reservation?.rateList?.rate;
                 if (rates) {
                    const rList = Array.isArray(rates) ? rates : [rates];
                    for (const r of rList) {
                       options.push({
                          acriss: r.$?.carCategory || r.carCategory,
                          rateId: r.$?.rateId || r.rateId,
                          amount: r.chargesDetail?.charge?.[0]?.$?.amount || "Indisponível",
                          currency: r.chargesDetail?.charge?.[0]?.$?.currency || "EUR"
                       });
                    }
                 }
              }
              return { 
                 mensagem: "Aqui estão os carros disponíveis encontrados:",
                 opcoes: options.slice(0, 4) // Retorna os primeiros 4 para o LLM mostrar
              };
           } catch(e: any) {
              return { error: e.message };
           }
        }
      }),

      generateCheckoutUrl: tool({
        description: 'Gera a URL final de checkout com todos os parâmetros que o usuário escolheu.',
        parameters: z.object({
           rateId: z.string().describe('ID da tarifa escolhida (rateId).'),
           acriss: z.string().describe('Código da categoria do carro (acriss).'),
           price: z.number().describe('Preço convertido em centavos (ex: se for R$ 100,50 mande 10050). Mande apenas números inteiros.'),
           pickupStation: z.string().describe('Código da loja de retirada.'),
           pickupDate: z.string().describe('Data de retirada.'),
           returnDate: z.string().describe('Data de devolução.')
        }),
        execute: async (params) => {
           // O front-end precisa dos dados na URL para montar o carrinho/checkout
           const queryString = new URLSearchParams({
              rateId: params.rateId,
              acriss: params.acriss,
              price: params.price.toString(),
              pickup: params.pickupStation,
              date: params.pickupDate,
              returnDate: params.returnDate
           }).toString();

           const link = `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/checkout?${queryString}`;
           return {
              mensagem: "Pronto! Clique no link abaixo para finalizar a reserva de forma segura:",
              link
           };
        }
      })
    },
  });

  return result.toDataStreamResponse();
}
