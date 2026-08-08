import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { checkAdmin } from "@/lib/checkAdmin";
export const dynamic = "force-dynamic";

/**
 * POST /api/admin/config/cielo/test
 * Testa as credenciais Cielo e Braspag 3DS sem realizar cobranças reais.
 *
 * Cielo: tenta tokenizar um cartão de teste — 401 = chaves erradas, qualquer
 *        outro código (200 ou erro de bandeira) = chaves válidas.
 * 3DS:   solicita um Access Token ao servidor Braspag MPI, incluindo os campos
 *        obrigatórios EstablishmentCode (605), MerchantName (606) e MCC (607).
 */
export async function POST() {
  if (!(await checkAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const config = await prisma.cieloConfig.findFirst();

  if (!config?.merchantId || !config?.merchantKey) {
    return NextResponse.json(
      { error: "Configuração Cielo não encontrada. Salve as credenciais antes de testar." },
      { status: 503 }
    );
  }

  const isSandbox = config.isSandbox !== false;
  const results: Record<string, any> = {};
  // .trim() defensivo — mesma causa raiz do 401 divergente entre /1/card e /1/sales
  const merchantId = String(config.merchantId).trim();
  const merchantKey = String(config.merchantKey).trim();

  /* ------------------------------------------------------------------ */
  /* 1. Teste Cielo — Tokenização de cartão fictício                      */
  /* ------------------------------------------------------------------ */
  const cieloCardUrl = isSandbox
    ? "https://apiquerysandbox.cieloecommerce.cielo.com.br/1/card"
    : "https://api.cieloecommerce.cielo.com.br/1/card";

  const testCard = isSandbox
    ? { CustomerName: "Teste Cielo", CardNumber: "4551870000000183", Holder: "TESTE CIELO", ExpirationDate: "12/2030", Brand: "Visa" }
    : { CustomerName: "Teste Cielo", CardNumber: "4532117080573700", Holder: "TESTE CIELO", ExpirationDate: "12/2030", Brand: "Visa" };

  try {
    const cieloRes = await fetch(cieloCardUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        MerchantId: merchantId,
        MerchantKey: merchantKey,
      },
      body: JSON.stringify(testCard),
      signal: AbortSignal.timeout(10000),
    });

    const cieloBody = await cieloRes.json().catch(() => ({}));

    if (cieloRes.status === 401) {
      results.cielo = {
        ok: false,
        label: "❌ Credenciais inválidas (401 — Não Autorizado)",
        detail: "O MerchantId ou MerchantKey está incorreto, ou você está misturando chaves de ambientes diferentes.",
      };
    } else if (cieloRes.status === 403) {
      results.cielo = {
        ok: false,
        label: "❌ Acesso negado (403)",
        detail: "Suas chaves não têm permissão para esta operação. Verifique o portal Cielo.",
      };
    } else {
      results.cielo = {
        ok: true,
        label: `✅ Credenciais válidas (HTTP ${cieloRes.status})`,
        detail: isSandbox
          ? "Comunicação com o sandbox Cielo estabelecida com sucesso."
          : "Comunicação com a API de Produção Cielo estabelecida com sucesso.",
        cardToken: cieloBody?.CardToken ? `****${cieloBody.CardToken.slice(-4)}` : undefined,
      };
    }
  } catch (err: any) {
    results.cielo = {
      ok: false,
      label: "❌ Erro de conexão com Cielo",
      detail: err?.message || "Timeout ou falha de rede ao contactar a API Cielo.",
    };
  }

  /* ------------------------------------------------------------------ */
  /* 2. Teste 3DS — Access Token Braspag MPI (com campos 605/606/607)    */
  /* ------------------------------------------------------------------ */
  if (config.clientId3ds && config.clientSecret3ds) {
    const authUrl = isSandbox
      ? "https://mpisandbox.braspag.com.br/v2/auth/token"
      : "https://mpi.braspag.com.br/v2/auth/token";

    const credentials = Buffer.from(
      `${config.clientId3ds}:${config.clientSecret3ds}`
    ).toString("base64");

    // Campos obrigatórios no body do token Braspag MPI (Erros 605, 606, 607)
    const tokenBody = new URLSearchParams({
      grant_type:        "client_credentials",
      EstablishmentCode: config.establishmentCode || "",
      MerchantName:      config.merchantName      || "Europcar Brasil",
      MCC:               config.mcc               || "7512",
    });

    try {
      const dsRes = await fetch(authUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: `Basic ${credentials}`,
        },
        body: tokenBody.toString(),
        signal: AbortSignal.timeout(10000),
      });

      if (dsRes.ok) {
        const dsBody = await dsRes.json().catch(() => ({}));
        results.threeds = {
          ok: true,
          label: "✅ Credenciais 3DS válidas",
          detail: `Access Token obtido com sucesso. Expira em ${dsBody.expires_in ?? "?"}s.`,
        };
      } else {
        const errText = await dsRes.text().catch(() => "");
        results.threeds = {
          ok: false,
          label: `❌ Credenciais 3DS inválidas (HTTP ${dsRes.status})`,
          detail: `Resposta Braspag: ${errText.slice(0, 300)}`,
        };
      }
    } catch (err: any) {
      results.threeds = {
        ok: false,
        label: "❌ Erro de conexão com Braspag MPI",
        detail: err?.message || "Timeout ou falha de rede ao contactar o servidor 3DS.",
      };
    }
  } else {
    results.threeds = {
      ok: null,
      label: "⚠️ Credenciais 3DS não configuradas",
      detail: "Preencha o Client ID e Client Secret 3DS para habilitar autenticação 3DS 2.2.",
    };
  }

  return NextResponse.json({
    environment: isSandbox ? "sandbox" : "production",
    results,
  });
}
