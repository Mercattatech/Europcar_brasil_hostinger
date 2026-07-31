"use client";

import { useState, useEffect } from "react";

export default function PainelConfig() {
  const [merchantId, setMerchantId] = useState("");
  const [merchantKey, setMerchantKey] = useState("");
  const [clientId3ds, setClientId3ds] = useState("");
  const [clientSecret3ds, setClientSecret3ds] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isSandbox, setIsSandbox] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);

  const showToast = (msg: string, t: "success" | "error" = "success") => {
    setToast({ message: msg, type: t });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    fetch("/api/admin/config/cielo")
      .then(res => res.json())
      .then(data => {
        if (data.merchantId) setMerchantId(data.merchantId);
        if (data.merchantKey) setMerchantKey(data.merchantKey);
        if (data.isSandbox !== undefined) setIsSandbox(data.isSandbox);
        if (data.clientId3ds) setClientId3ds(data.clientId3ds);
        if (data.clientSecret3ds) setClientSecret3ds(data.clientSecret3ds);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/admin/config/cielo/test", { method: "POST" });
      const data = await res.json();
      setTestResult(data);
    } catch {
      setTestResult({ error: "Erro de conexão ao testar. Verifique se as configurações foram salvas." });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/admin/config/cielo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ merchantId, merchantKey, isSandbox, clientId3ds, clientSecret3ds })
      });
      if (res.ok) showToast("Configurações salvas com sucesso!");
      else showToast("Erro ao salvar", "error");
    } catch {
      showToast("Erro de conexão", "error");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return (
    <div className="flex justify-center py-10">
      <div className="w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin"></div>
    </div>
  );

  return (
    <div className="max-w-2xl space-y-6">
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-5 py-3 rounded-lg shadow-2xl font-bold text-sm ${toast.type === "success" ? "bg-green-600 text-white" : "bg-red-600 text-white"}`}>
          {toast.message}
        </div>
      )}

      <div>
        <h1 className="text-2xl font-black text-white">Configuração de Pagamento</h1>
        <p className="text-gray-400 text-sm mt-1">Credenciais da API Cielo E-commerce 3.0</p>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
        <div className="flex items-start gap-3 bg-blue-500/10 border border-blue-500/20 rounded-lg p-4 mb-6">
          <svg className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-sm text-blue-300">Insira as credenciais fornecidas pela Cielo E-commerce (API 3.0) para ativar pagamentos com PIX e Cartão de Crédito.</p>
        </div>

        <form onSubmit={handleSave} className="space-y-5">
          {/* Credenciais de Autorização */}
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Merchant ID</label>
            <input
              type="text"
              required
              value={merchantId}
              onChange={e => setMerchantId(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-sm text-white font-mono outline-none focus:border-green-600"
              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Merchant Key</label>
            <input
              type="password"
              required
              value={merchantKey}
              onChange={e => setMerchantKey(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-sm text-white font-mono outline-none focus:border-green-600"
              placeholder="Sua chave secreta..."
            />
          </div>

          {/* Credenciais 3DS 2.2 */}
          <div className="border-t border-gray-700 pt-5">
            <div className="flex items-start gap-3 bg-purple-500/10 border border-purple-500/20 rounded-lg p-4 mb-4">
              <svg className="w-5 h-5 text-purple-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              <div>
                <p className="text-sm text-purple-300 font-bold mb-1">Autenticação 3DS 2.2 (Braspag MPI)</p>
                <p className="text-xs text-purple-400">
                  Credenciais exclusivas para autenticação 3DS — diferentes do MerchantId acima.
                  Habilite em: <strong>Portal Cielo → Produtos → 3DS 2.2</strong> para obter o ClientId e ClientSecret.
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Client ID 3DS (Braspag)</label>
                <input
                  type="text"
                  value={clientId3ds}
                  onChange={e => setClientId3ds(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-sm text-white font-mono outline-none focus:border-purple-600"
                  placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Client Secret 3DS (Braspag)</label>
                <input
                  type="password"
                  value={clientSecret3ds}
                  onChange={e => setClientSecret3ds(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-sm text-white font-mono outline-none focus:border-purple-600"
                  placeholder="Seu client secret Braspag..."
                />
              </div>
            </div>
          </div>

          <div className={`flex items-center gap-3 p-4 rounded-lg border transition-colors ${isSandbox ? "bg-yellow-500/10 border-yellow-500/20" : "bg-green-500/10 border-green-500/20"}`}>
            <input
              type="checkbox"
              id="sandbox"
              checked={isSandbox}
              onChange={e => setIsSandbox(e.target.checked)}
              className="w-5 h-5 accent-green-600 rounded"
            />
            <div>
              <label htmlFor="sandbox" className="block font-bold text-white text-sm cursor-pointer">
                {isSandbox ? "🧪 Modo Sandbox (Testes)" : "🚀 Modo Produção (Real)"}
              </label>
              <span className="text-[11px] text-gray-400">
                {isSandbox ? "Transações simuladas — nenhuma cobrança real será feita." : "ATENÇÃO: Cobranças reais serão processadas!"}
              </span>
            </div>
          </div>

          <div className="pt-4 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={handleTest}
              disabled={testing || saving}
              className="flex items-center gap-2 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/30 text-blue-300 px-5 py-3 rounded-lg font-bold text-sm transition-colors disabled:opacity-50"
            >
              {testing ? (
                <>
                  <span className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin inline-block" />
                  Testando...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Testar Conexão
                </>
              )}
            </button>

            <button
              type="submit"
              disabled={saving}
              className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-bold text-sm transition-colors disabled:opacity-50"
            >
              {saving ? "Salvando..." : "Salvar Configuração"}
            </button>
          </div>
        </form>
      </div>

      {/* Test Results */}
      {testResult && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-white">Resultado do Teste</h2>
            <span className={`text-xs font-bold px-3 py-1 rounded-full ${
              testResult.environment === "production"
                ? "bg-green-500/20 text-green-400"
                : "bg-yellow-500/20 text-yellow-400"
            }`}>
              {testResult.environment === "production" ? "🚀 Produção" : "🧪 Sandbox"}
            </span>
          </div>

          {testResult.error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
              <p className="text-sm text-red-400 font-bold">{testResult.error}</p>
            </div>
          )}

          {testResult.results && (
            <div className="space-y-3">
              {/* Cielo Result */}
              {testResult.results.cielo && (
                <div className={`rounded-lg p-4 border ${
                  testResult.results.cielo.ok
                    ? "bg-green-500/10 border-green-500/20"
                    : "bg-red-500/10 border-red-500/20"
                }`}>
                  <p className={`text-sm font-bold mb-1 ${
                    testResult.results.cielo.ok ? "text-green-400" : "text-red-400"
                  }`}>
                    Cielo E-commerce — {testResult.results.cielo.label}
                  </p>
                  <p className="text-xs text-gray-400">{testResult.results.cielo.detail}</p>
                  {testResult.results.cielo.cardToken && (
                    <p className="text-xs text-gray-500 mt-1 font-mono">Token gerado: {testResult.results.cielo.cardToken}</p>
                  )}
                </div>
              )}

              {/* 3DS Result */}
              {testResult.results.threeds && (
                <div className={`rounded-lg p-4 border ${
                  testResult.results.threeds.ok === true
                    ? "bg-green-500/10 border-green-500/20"
                    : testResult.results.threeds.ok === false
                    ? "bg-red-500/10 border-red-500/20"
                    : "bg-yellow-500/10 border-yellow-500/20"
                }`}>
                  <p className={`text-sm font-bold mb-1 ${
                    testResult.results.threeds.ok === true
                      ? "text-green-400"
                      : testResult.results.threeds.ok === false
                      ? "text-red-400"
                      : "text-yellow-400"
                  }`}>
                    Braspag 3DS 2.2 — {testResult.results.threeds.label}
                  </p>
                  <p className="text-xs text-gray-400">{testResult.results.threeds.detail}</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
