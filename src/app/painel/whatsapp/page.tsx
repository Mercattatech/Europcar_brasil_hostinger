"use client";

import { useState, useEffect, useCallback } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

type MsgType = "text" | "template" | "flow";

interface TriggerConfig {
  type: MsgType;
  enabled: boolean;
  body: string;         // text mode
  templateName: string; // template mode
  bodyParams: string[]; // template params
  flowId: string;       // flow mode
}

const DEFAULT_TRIGGER: TriggerConfig = {
  type: "text",
  enabled: false,
  body: "",
  templateName: "",
  bodyParams: [],
  flowId: "",
};

const TRIGGERS = [
  {
    id: "RESERVA_SUCESSO",
    label: "✅ Reserva Confirmada",
    description: "Disparado quando o cliente confirma uma reserva real (com número de reserva) via cartão ou voucher.",
    color: "emerald",
    defaultBody:
      "🚗 *Reserva Confirmada - Europcar Brasil*\n\nOlá, {{NOME}}! 🎉\n\nSua reserva foi confirmada com sucesso!\n\n📋 *Nº da Reserva:* {{NUMERO_RESERVA}}\n🚘 *Veículo:* {{CARRO}}\n📅 *Retirada:* {{DATA_RETIRADA}} — {{LOCAL_RETIRADA}}\n📅 *Devolução:* {{DATA_DEVOLUCAO}} — {{LOCAL_DEVOLUCAO}}\n💰 *Valor Total:* {{VALOR_TOTAL}}\n\nEm caso de dúvidas, entre em contato conosco.\n_Europcar Brasil_",
  },
  {
    id: "RESERVA_BALCAO",
    label: "🏪 Pagamento no Balcão",
    description: "Disparado quando a reserva é feita com pagamento na loja (balcão). Lembra o cliente de trazer os documentos.",
    color: "blue",
    defaultBody:
      "🚗 *Reserva Recebida - Europcar Brasil*\n\nOlá, {{NOME}}! 👋\n\nSua reserva foi criada com sucesso e o pagamento será realizado diretamente no balcão da loja.\n\n📋 *Nº da Reserva:* {{NUMERO_RESERVA}}\n🚘 *Veículo:* {{CARRO}}\n📅 *Retirada:* {{DATA_RETIRADA}} — {{LOCAL_RETIRADA}}\n📅 *Devolução:* {{DATA_DEVOLUCAO}} — {{LOCAL_DEVOLUCAO}}\n\n⚠️ *Atenção — Documentos obrigatórios:*\n✔️ CNH (Carteira Nacional de Habilitação) válida\n✔️ Documento de identidade\n✔️ Cartão de crédito em seu nome (garantia)\n\nO pagamento e a assinatura do contrato serão feitos no momento da retirada do veículo.\n\nEm caso de dúvidas, entre em contato conosco.\n_Europcar Brasil_",
  },
  {
    id: "CANCELAMENTO",
    label: "❌ Cancelamento",
    description: "Disparado quando uma reserva é cancelada.",
    color: "red",
    defaultBody:
      "🚫 *Cancelamento de Reserva - Europcar Brasil*\n\nOlá, {{NOME}}.\n\nInformamos que a reserva *{{NUMERO_RESERVA}}* foi cancelada.\n\nSe precisar de ajuda ou quiser fazer uma nova reserva, acesse nosso site ou entre em contato.\n_Europcar Brasil_",
  },
];

const VARIABLES = [
  { key: "{{NOME}}", label: "Nome do cliente", color: "text-emerald-400" },
  { key: "{{SOBRENOME}}", label: "Sobrenome", color: "text-emerald-400" },
  { key: "{{NUMERO_RESERVA}}", label: "Número da reserva", color: "text-blue-400" },
  { key: "{{TELEFONE_CLIENTE}}", label: "Telefone do cliente", color: "text-blue-400" },
  { key: "{{CARRO}}", label: "Veículo", color: "text-yellow-400" },
  { key: "{{DATA_RETIRADA}}", label: "Data de retirada", color: "text-purple-400" },
  { key: "{{DATA_DEVOLUCAO}}", label: "Data de devolução", color: "text-purple-400" },
  { key: "{{LOCAL_RETIRADA}}", label: "Local de retirada", color: "text-purple-400" },
  { key: "{{LOCAL_DEVOLUCAO}}", label: "Local de devolução", color: "text-purple-400" },
  { key: "{{VALOR_TOTAL}}", label: "Valor total", color: "text-orange-400" },
  { key: "{{FORMA_PAGAMENTO}}", label: "Forma de pagamento", color: "text-orange-400" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function waGet(key: string): Promise<string | null> {
  const r = await fetch(`/api/admin/whatsapp?key=${key}`);
  const d = await r.json();
  return d.value ?? null;
}

async function waSet(key: string, value: string) {
  await fetch("/api/admin/whatsapp", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ key, value }),
  });
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function WhatsappPage() {
  // ── Token & Conexão ────────────────────────────────────────────
  const [token, setToken] = useState("");
  const [baseUrl, setBaseUrl] = useState("https://api.gmlead.com.br");

  // ── Números internos ───────────────────────────────────────────
  const [numbers, setNumbers] = useState<string[]>([]);
  const [newNumber, setNewNumber] = useState("");
  const [intervalMs, setIntervalMs] = useState(10000);

  // ── Triggers ───────────────────────────────────────────────────
  const [triggerConfigs, setTriggerConfigs] = useState<Record<string, TriggerConfig>>({
    RESERVA_SUCESSO: { ...DEFAULT_TRIGGER },
    RESERVA_BALCAO: { ...DEFAULT_TRIGGER },
    CANCELAMENTO: { ...DEFAULT_TRIGGER },
  });
  const [activeTriggerId, setActiveTriggerId] = useState("RESERVA_SUCESSO");

  // ── UI State ───────────────────────────────────────────────────
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  // ── Teste manual ───────────────────────────────────────────────
  const [testNumber, setTestNumber] = useState("");
  const [testLoading, setTestLoading] = useState(false);
  const [testResult, setTestResult] = useState<{ text: string; ok: boolean } | null>(null);

  const [triggerTestLoading, setTriggerTestLoading] = useState(false);
  const [triggerTestResult, setTriggerTestResult] = useState<{ text: string; ok: boolean } | null>(null);
  const [triggerToTest, setTriggerToTest] = useState("RESERVA_SUCESSO");

  // ── Carregar dados ─────────────────────────────────────────────
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [tkn, bUrl, nums, intv, trRs, trBc, trCanc] = await Promise.all([
        waGet("TOKEN"),
        waGet("BASE_URL"),
        waGet("NUMBERS"),
        waGet("INTERVAL_MS"),
        waGet("TRIGGER_RESERVA_SUCESSO"),
        waGet("TRIGGER_RESERVA_BALCAO"),
        waGet("TRIGGER_CANCELAMENTO"),
      ]);

      if (tkn) setToken(tkn);
      if (bUrl) setBaseUrl(bUrl);
      if (nums) {
        try { setNumbers(JSON.parse(nums)); } catch { }
      }
      if (intv) setIntervalMs(parseInt(intv, 10) || 10000);

      const parseTrigger = (raw: string | null, id: string): TriggerConfig => {
        if (raw) {
          try { return { ...DEFAULT_TRIGGER, ...JSON.parse(raw) }; } catch { }
        }
        const def = TRIGGERS.find(t => t.id === id);
        return { ...DEFAULT_TRIGGER, body: def?.defaultBody || "" };
      };

      setTriggerConfigs({
        RESERVA_SUCESSO: parseTrigger(trRs, "RESERVA_SUCESSO"),
        RESERVA_BALCAO: parseTrigger(trBc, "RESERVA_BALCAO"),
        CANCELAMENTO: parseTrigger(trCanc, "CANCELAMENTO"),
      });
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Salvar ─────────────────────────────────────────────────────
  const saveAll = async () => {
    setSaving(true);
    setMsg(null);
    try {
      await Promise.all([
        waSet("TOKEN", token),
        waSet("BASE_URL", baseUrl || "https://api.gmlead.com.br"),
        waSet("NUMBERS", JSON.stringify(numbers)),
        waSet("INTERVAL_MS", String(intervalMs)),
        waSet("TRIGGER_RESERVA_SUCESSO", JSON.stringify(triggerConfigs.RESERVA_SUCESSO)),
        waSet("TRIGGER_RESERVA_BALCAO", JSON.stringify(triggerConfigs.RESERVA_BALCAO)),
        waSet("TRIGGER_CANCELAMENTO", JSON.stringify(triggerConfigs.CANCELAMENTO)),
      ]);
      setMsg({ text: "✅ Configurações salvas com sucesso!", ok: true });
      setTimeout(() => setMsg(null), 4000);
    } catch {
      setMsg({ text: "❌ Erro ao salvar configurações.", ok: false });
    } finally {
      setSaving(false);
    }
  };

  // ── Adicionar número ───────────────────────────────────────────
  const addNumber = () => {
    const clean = newNumber.replace(/\D/g, "");
    if (clean.length < 10) {
      setMsg({ text: "❌ Número inválido. Use DDI+DDD+Número (ex: 5511999999999)", ok: false });
      setTimeout(() => setMsg(null), 3000);
      return;
    }
    if (numbers.includes(clean)) {
      setMsg({ text: "⚠️ Este número já está na lista.", ok: false });
      setTimeout(() => setMsg(null), 3000);
      return;
    }
    setNumbers([...numbers, clean]);
    setNewNumber("");
  };

  const removeNumber = (n: string) => {
    setNumbers(numbers.filter(x => x !== n));
  };

  // ── Atualizar trigger ──────────────────────────────────────────
  const updateTrigger = (id: string, patch: Partial<TriggerConfig>) => {
    setTriggerConfigs(prev => ({
      ...prev,
      [id]: { ...prev[id], ...patch },
    }));
  };

  // ── Teste de conexão ───────────────────────────────────────────
  const handleTest = async () => {
    const clean = testNumber.replace(/\D/g, "");
    if (clean.length < 10) {
      setTestResult({ text: "❌ Informe um número válido (DDI+DDD+número)", ok: false });
      return;
    }
    setTestLoading(true);
    setTestResult(null);
    try {
      const r = await fetch("/api/admin/whatsapp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "test", number: clean }),
      });
      const d = await r.json();
      if (d.ok) {
        setTestResult({ text: `✅ Mensagem enviada para ${clean}!`, ok: true });
      } else {
        setTestResult({ text: `❌ ${d.error || "Falha no envio."}`, ok: false });
      }
    } catch {
      setTestResult({ text: "❌ Erro de rede.", ok: false });
    } finally {
      setTestLoading(false);
      setTimeout(() => setTestResult(null), 8000);
    }
  };

  // ── Teste de gatilho ───────────────────────────────────────────
  const handleTriggerTest = async () => {
    setTriggerTestLoading(true);
    setTriggerTestResult(null);
    try {
      const r = await fetch("/api/admin/whatsapp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "trigger",
          trigger: triggerToTest,
          vars: {
            NOME: "João Silva (Teste)",
            NUMERO_RESERVA: "RES-999999",
            CARRO: "Fiat Cronos",
            DATA_RETIRADA: "15/08/2026",
            DATA_DEVOLUCAO: "20/08/2026",
            LOCAL_RETIRADA: "POA - Aeroporto",
            LOCAL_DEVOLUCAO: "POA - Aeroporto",
            VALOR_TOTAL: "R$ 850,00",
            FORMA_PAGAMENTO: "Cartão de Crédito",
          },
        }),
      });
      const d = await r.json();
      if (d.ok) {
        setTriggerTestResult({ text: `✅ ${d.message}`, ok: true });
      } else {
        setTriggerTestResult({ text: `❌ ${d.error}`, ok: false });
      }
    } catch {
      setTriggerTestResult({ text: "❌ Erro de rede.", ok: false });
    } finally {
      setTriggerTestLoading(false);
      setTimeout(() => setTriggerTestResult(null), 8000);
    }
  };

  const activeTrigger = TRIGGERS.find(t => t.id === activeTriggerId)!;
  const activeCfg = triggerConfigs[activeTriggerId] || DEFAULT_TRIGGER;

  // ── Render ──────────────────────────────────────────────────────
  return (
    <div className="space-y-8 pb-20">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-black text-white flex items-center gap-2">
            📲 WhatsApp Automático
          </h1>
          <p className="text-gray-400 text-sm mt-1">
            Configure o GM Lead, cadastre números de alerta e defina mensagens por gatilho de reserva.
          </p>
        </div>
        <button
          onClick={saveAll}
          disabled={saving}
          className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold px-6 py-2.5 rounded-xl transition-colors flex items-center gap-2"
        >
          {saving ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : "💾 Salvar Tudo"}
        </button>
      </div>

      {/* Feedback global */}
      {msg && (
        <div className={`p-4 rounded-xl font-bold text-sm ${msg.ok ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"}`}>
          {msg.text}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

          {/* ══════════════════════════════════════════════════════
              COLUNA ESQUERDA
          ══════════════════════════════════════════════════════ */}
          <div className="space-y-6">

            {/* Token GM Lead */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <h2 className="text-sm font-bold text-white mb-1 flex items-center gap-2">
                🔑 Token GM Lead
              </h2>
              <p className="text-xs text-gray-500 mb-4">
                Bearer token obtido no painel do GM Lead. Mantido no banco de forma segura.
              </p>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">Bearer Token</label>
                  <input
                    type="password"
                    value={token}
                    onChange={e => setToken(e.target.value)}
                    placeholder="eyJhbGci..."
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-500 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">Base URL</label>
                  <input
                    type="text"
                    value={baseUrl}
                    onChange={e => setBaseUrl(e.target.value)}
                    placeholder="https://api.gmlead.com.br"
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-500 font-mono"
                  />
                  <p className="text-[10px] text-gray-600 mt-1">Padrão: https://api.gmlead.com.br</p>
                </div>
              </div>
            </div>

            {/* Números internos de alerta */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <h2 className="text-sm font-bold text-white mb-1 flex items-center gap-2">
                📋 Números de Alerta (Internos)
              </h2>
              <p className="text-xs text-gray-500 mb-4">
                Estes números receberão <strong className="text-gray-300">cópia de todas as mensagens</strong> disparadas (gestores, equipe de suporte). O cliente também receberá no telefone dele.
              </p>

              {/* Input para novo número */}
              <div className="flex gap-2 mb-3">
                <input
                  type="text"
                  value={newNumber}
                  onChange={e => setNewNumber(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && addNumber()}
                  placeholder="5511999999999"
                  className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-500 font-mono"
                />
                <button
                  onClick={addNumber}
                  className="bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-400 font-bold px-3 py-2 rounded-lg text-sm transition-colors border border-emerald-600/30"
                >
                  + Add
                </button>
              </div>
              <p className="text-[10px] text-gray-600 mb-3">DDI+DDD+Número sem espaços ou símbolos. Ex: 5551999999999</p>

              {/* Lista de números */}
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {numbers.length === 0 ? (
                  <p className="text-xs text-gray-600 text-center py-4">Nenhum número cadastrado</p>
                ) : (
                  numbers.map((n, i) => (
                    <div key={i} className="flex items-center justify-between bg-gray-800 rounded-lg px-3 py-2">
                      <span className="text-sm font-mono text-white">{n}</span>
                      <button
                        onClick={() => removeNumber(n)}
                        className="text-red-400 hover:text-red-300 text-xs font-bold ml-2"
                      >
                        ✕
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Intervalo entre envios */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <h2 className="text-sm font-bold text-white mb-1 flex items-center gap-2">
                ⏱️ Intervalo entre Envios
              </h2>
              <p className="text-xs text-gray-500 mb-4">
                Tempo de espera entre cada mensagem disparada para evitar bloqueio do WhatsApp.
              </p>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  value={intervalMs / 1000}
                  onChange={e => setIntervalMs(Math.max(1, parseInt(e.target.value) || 10) * 1000)}
                  min={1}
                  max={60}
                  className="w-24 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-500 text-center font-bold"
                />
                <span className="text-gray-400 text-sm font-medium">segundos</span>
              </div>
              <div className="mt-3 flex gap-2 flex-wrap">
                {[5, 10, 15, 30].map(s => (
                  <button
                    key={s}
                    onClick={() => setIntervalMs(s * 1000)}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${intervalMs === s * 1000 ? "bg-emerald-600 text-white" : "bg-gray-800 text-gray-400 hover:bg-gray-700"}`}
                  >
                    {s}s
                  </button>
                ))}
              </div>
            </div>

            {/* Teste de conexão */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <h2 className="text-sm font-bold text-white mb-1 flex items-center gap-2">🧪 Testar Conexão</h2>
              <p className="text-xs text-gray-500 mb-4">
                Salve o token primeiro, depois envie uma mensagem de teste para um número.
              </p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={testNumber}
                  onChange={e => setTestNumber(e.target.value)}
                  placeholder="5511999999999"
                  className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-yellow-500 font-mono"
                />
                <button
                  onClick={handleTest}
                  disabled={testLoading}
                  className="bg-yellow-600 hover:bg-yellow-500 disabled:opacity-50 text-white font-bold px-3 py-2 rounded-lg text-sm transition-colors flex items-center gap-2 whitespace-nowrap"
                >
                  {testLoading ? <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : "📤 Testar"}
                </button>
              </div>
              {testResult && (
                <div className={`mt-3 px-3 py-2 rounded-lg text-xs font-bold ${testResult.ok ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400"}`}>
                  {testResult.text}
                </div>
              )}
            </div>

            {/* Teste de gatilho */}
            <div className="bg-gray-900 border border-purple-500/30 rounded-xl p-5">
              <h2 className="text-sm font-bold text-white mb-1 flex items-center gap-2">🚀 Disparar Gatilho (Teste)</h2>
              <p className="text-xs text-gray-500 mb-4">
                Dispara um gatilho com dados fictícios para todos os números cadastrados. Perfeito para validar o fluxo completo.
              </p>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">Gatilho</label>
                  <select
                    value={triggerToTest}
                    onChange={e => setTriggerToTest(e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-500"
                  >
                    {TRIGGERS.map(t => (
                      <option key={t.id} value={t.id}>{t.label}</option>
                    ))}
                  </select>
                </div>
                <button
                  onClick={handleTriggerTest}
                  disabled={triggerTestLoading}
                  className="w-full bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-bold py-2.5 px-4 rounded-lg text-sm transition-colors flex items-center justify-center gap-2"
                >
                  {triggerTestLoading
                    ? <><span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Disparando...</>
                    : "🔥 Disparar Agora"}
                </button>
              </div>
              {triggerTestResult && (
                <div className={`mt-3 px-3 py-2 rounded-lg text-xs font-bold ${triggerTestResult.ok ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400"}`}>
                  {triggerTestResult.text}
                </div>
              )}
            </div>
          </div>

          {/* ══════════════════════════════════════════════════════
              COLUNA DIREITA — Editor de Gatilhos
          ══════════════════════════════════════════════════════ */}
          <div className="lg:col-span-2 space-y-6">

            {/* Tabs de gatilhos */}
            <div className="flex gap-2 flex-wrap">
              {TRIGGERS.map(t => (
                <button
                  key={t.id}
                  onClick={() => setActiveTriggerId(t.id)}
                  className={`px-4 py-2 rounded-xl text-sm font-bold transition-all border ${activeTriggerId === t.id
                    ? t.color === "emerald"
                      ? "bg-emerald-600/20 text-emerald-400 border-emerald-600/40"
                      : t.color === "blue"
                        ? "bg-blue-600/20 text-blue-400 border-blue-600/40"
                        : "bg-red-600/20 text-red-400 border-red-600/40"
                    : "bg-gray-800 text-gray-400 border-gray-700 hover:border-gray-600"
                    }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* Editor do trigger ativo */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
              {/* Header do trigger */}
              <div className="px-6 py-4 border-b border-gray-800 flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-base font-bold text-white">{activeTrigger.label}</h2>
                  <p className="text-xs text-gray-500 mt-0.5">{activeTrigger.description}</p>
                </div>
                {/* Toggle habilitado/desabilitado */}
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-xs text-gray-400 font-medium">
                    {activeCfg.enabled ? "Ativo" : "Inativo"}
                  </span>
                  <button
                    onClick={() => updateTrigger(activeTriggerId, { enabled: !activeCfg.enabled })}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${activeCfg.enabled ? "bg-emerald-600" : "bg-gray-700"}`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${activeCfg.enabled ? "translate-x-6" : "translate-x-1"}`} />
                  </button>
                </div>
              </div>

              <div className="p-6 space-y-6">

                {/* Tipo de mensagem */}
                <div>
                  <label className="block text-xs font-bold text-gray-400 mb-3">Tipo de Mensagem</label>
                  <div className="flex gap-2 flex-wrap">
                    {(["text", "template", "flow"] as MsgType[]).map(type => (
                      <button
                        key={type}
                        onClick={() => updateTrigger(activeTriggerId, { type })}
                        className={`px-4 py-2 rounded-lg text-sm font-bold transition-all border ${activeCfg.type === type
                          ? "bg-blue-600/20 text-blue-400 border-blue-600/40"
                          : "bg-gray-800 text-gray-500 border-gray-700 hover:border-gray-600"
                          }`}
                      >
                        {type === "text" && "📝 Texto Simples"}
                        {type === "template" && "📋 Template HSM"}
                        {type === "flow" && "🔀 Fluxo (Flow)"}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Campos por tipo */}
                {activeCfg.type === "text" && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-xs font-bold text-gray-400">Corpo da Mensagem</label>
                      <button
                        onClick={() => updateTrigger(activeTriggerId, { body: activeTrigger.defaultBody })}
                        className="text-[10px] text-blue-400 hover:text-blue-300 font-bold"
                      >
                        ↩ Restaurar padrão
                      </button>
                    </div>
                    <textarea
                      value={activeCfg.body}
                      onChange={e => updateTrigger(activeTriggerId, { body: e.target.value })}
                      placeholder="Olá, {{NOME}}! Sua reserva {{NUMERO_RESERVA}} foi confirmada."
                      className="w-full bg-gray-950 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-blue-500 resize-none font-mono leading-relaxed"
                      style={{ minHeight: "200px" }}
                    />
                    <p className="text-[10px] text-gray-600 mt-1">
                      Use *texto* para negrito e _texto_ para itálico no WhatsApp.
                    </p>
                  </div>
                )}

                {activeCfg.type === "template" && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-400 mb-1">Nome do Template (exato, aprovado no WhatsApp Business)</label>
                      <input
                        type="text"
                        value={activeCfg.templateName}
                        onChange={e => updateTrigger(activeTriggerId, { templateName: e.target.value })}
                        placeholder="confirmacao_reserva"
                        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500 font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-400 mb-1">
                        Parâmetros do Template (um por linha — mapeados para {"{"}{"{"} 1 {"}"}{"}"}, {"{"}{"{"} 2 {"}"}{"}"}, ...)
                      </label>
                      <textarea
                        value={(activeCfg.bodyParams || []).join("\n")}
                        onChange={e => updateTrigger(activeTriggerId, { bodyParams: e.target.value.split("\n").filter(Boolean) })}
                        placeholder={"{{NOME}}\n{{NUMERO_RESERVA}}\n{{DATA_RETIRADA}}"}
                        className="w-full bg-gray-950 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-blue-500 resize-none font-mono"
                        style={{ minHeight: "120px" }}
                      />
                      <p className="text-[10px] text-gray-600 mt-1">
                        Cada linha = um parâmetro. Use as variáveis {"{{"} NOME {"}"} {"}"} etc. abaixo.
                      </p>
                    </div>
                  </div>
                )}

                {activeCfg.type === "flow" && (
                  <div>
                    <label className="block text-xs font-bold text-gray-400 mb-1">Flow ID (obtido no painel GM Lead)</label>
                    <input
                      type="text"
                      value={activeCfg.flowId}
                      onChange={e => updateTrigger(activeTriggerId, { flowId: e.target.value })}
                      placeholder="abc123-flow-id"
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500 font-mono"
                    />
                    <p className="text-[10px] text-gray-600 mt-2">
                      O fluxo será disparado sem variáveis adicionais. Configure as variáveis diretamente no fluxo do GM Lead.
                    </p>
                  </div>
                )}

                {/* Variáveis disponíveis */}
                <div className="bg-gray-800/60 border border-gray-700/50 rounded-xl p-4">
                  <p className="text-xs font-bold text-gray-400 mb-3">📋 Variáveis disponíveis — clique para copiar:</p>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {VARIABLES.map(v => (
                      <button
                        key={v.key}
                        onClick={() => navigator.clipboard?.writeText(v.key)}
                        title={`Copiar ${v.key}`}
                        className="text-left group px-2 py-1.5 rounded-lg hover:bg-gray-700 transition-colors"
                      >
                        <p className={`text-[11px] font-mono font-bold ${v.color} group-hover:opacity-80`}>{v.key}</p>
                        <p className="text-[9px] text-gray-600 truncate">{v.label}</p>
                      </button>
                    ))}
                  </div>
                  <p className="text-[10px] text-gray-600 mt-3 pt-2 border-t border-gray-700">
                    💡 Clique em qualquer variável para copiar. Estas são substituídas automaticamente no momento do disparo.
                  </p>
                </div>

                {/* Aviso sobre texto simples */}
                {activeCfg.type === "text" && (
                  <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-3">
                    <p className="text-xs text-amber-400 font-bold mb-1">⚠️ Sobre mensagens de texto simples</p>
                    <p className="text-[11px] text-amber-400/70 leading-relaxed">
                      Texto simples só funciona se o cliente iniciou uma conversa com o número nas últimas 24h (janela de sessão ativa do WhatsApp). Para contatos frios, use um <strong>Template HSM aprovado</strong>.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Info sobre o fluxo de disparo */}
            <div className="bg-gray-900 border border-blue-500/20 rounded-xl p-5">
              <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">📡 Como funciona o disparo</h3>
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-emerald-600/20 text-emerald-400 flex items-center justify-center text-xs font-bold shrink-0">1</div>
                  <p className="text-xs text-gray-400">
                    <strong className="text-white">Cliente confirma reserva</strong> → sistema detecta o evento e prepara o disparo
                  </p>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-blue-600/20 text-blue-400 flex items-center justify-center text-xs font-bold shrink-0">2</div>
                  <p className="text-xs text-gray-400">
                    <strong className="text-white">Telefone do cliente</strong> recebe a mensagem de confirmação com o número da reserva
                  </p>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-purple-600/20 text-purple-400 flex items-center justify-center text-xs font-bold shrink-0">3</div>
                  <p className="text-xs text-gray-400">
                    Após <strong className="text-white">{intervalMs / 1000}s de intervalo</strong>, os números internos cadastrados acima recebem cópia do alerta
                  </p>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-yellow-600/20 text-yellow-400 flex items-center justify-center text-xs font-bold shrink-0">4</div>
                  <p className="text-xs text-gray-400">
                    Todo o processo roda em <strong className="text-white">background</strong> — não atrasa a resposta ao cliente
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
