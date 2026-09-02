"use client";

import { useState, useEffect } from "react";

export default function PainelConfig() {
  const [activeTab, setActiveTab] = useState<"cielo" | "xrs">("cielo");

  // Cielo State
  const [merchantId, setMerchantId] = useState("");
  const [merchantKey, setMerchantKey] = useState("");
  const [clientId3ds, setClientId3ds] = useState("");
  const [clientSecret3ds, setClientSecret3ds] = useState("");
  const [establishmentCode, setEstablishmentCode] = useState("");
  const [merchantName, setMerchantName] = useState("Europcar Brasil");
  const [mcc, setMcc] = useState("7512");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isSandbox, setIsSandbox] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);

  // XRS Contracts State
  const [poaCid, setPoaCid] = useState("57269673");
  const [etoZeroExcessCid, setEtoZeroExcessCid] = useState("56935495");
  const [etoZeroExcessBa, setEtoZeroExcessBa] = useState("73804373");
  const [etoExcessCid, setEtoExcessCid] = useState("56935466");
  const [etoExcessBa, setEtoExcessBa] = useState("73675595");
  const [exoCid, setExoCid] = useState("57269673");
  const [exoIata, setExoIata] = useState("02170722");
  const [savingXrs, setSavingXrs] = useState(false);

  const showToast = (msg: string, t: "success" | "error" = "success") => {
    setToast({ message: msg, type: t });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    Promise.all([
      fetch("/api/admin/config/cielo").then(res => res.json()).catch(() => ({})),
      fetch("/api/admin/config/xrs").then(res => res.json()).catch(() => ({}))
    ]).then(([cieloData, xrsData]) => {
      if (cieloData.merchantId) setMerchantId(cieloData.merchantId);
      if (cieloData.merchantKey) setMerchantKey(cieloData.merchantKey);
      if (cieloData.isSandbox !== undefined) setIsSandbox(cieloData.isSandbox);
      if (cieloData.clientId3ds) setClientId3ds(cieloData.clientId3ds);
      if (cieloData.clientSecret3ds) setClientSecret3ds(cieloData.clientSecret3ds);
      if (cieloData.establishmentCode) setEstablishmentCode(cieloData.establishmentCode);
      if (cieloData.merchantName) setMerchantName(cieloData.merchantName);
      if (cieloData.mcc) setMcc(cieloData.mcc);

      if (xrsData.poaCid) setPoaCid(xrsData.poaCid);
      if (xrsData.etoZeroExcessCid) setEtoZeroExcessCid(xrsData.etoZeroExcessCid);
      if (xrsData.etoZeroExcessBa) setEtoZeroExcessBa(xrsData.etoZeroExcessBa);
      if (xrsData.etoExcessCid) setEtoExcessCid(xrsData.etoExcessCid);
      if (xrsData.etoExcessBa) setEtoExcessBa(xrsData.etoExcessBa);
      if (xrsData.exoCid) setExoCid(xrsData.exoCid);
      if (xrsData.exoIata) setExoIata(xrsData.exoIata);

      setLoading(false);
    }).catch(() => setLoading(false));
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

  const handleSaveCielo = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/admin/config/cielo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ merchantId, merchantKey, isSandbox, clientId3ds, clientSecret3ds, establishmentCode, merchantName, mcc })
      });
      if (res.ok) showToast("Configurações Cielo salvas com sucesso!");
      else showToast("Erro ao salvar Cielo", "error");
    } catch {
      showToast("Erro de conexão", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveXrs = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingXrs(true);
    try {
      const res = await fetch("/api/admin/config/xrs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          poaCid,
          etoZeroExcessCid,
          etoZeroExcessBa,
          etoExcessCid,
          etoExcessBa,
          exoCid,
          exoIata,
        })
      });
      if (res.ok) showToast("Contratos Europcar (XRS) salvos com sucesso!");
      else showToast("Erro ao salvar contratos XRS", "error");
    } catch {
      showToast("Erro de conexão ao salvar XRS", "error");
    } finally {
      setSavingXrs(false);
    }
  };

  const handleResetDefaults = () => {
    setPoaCid("57269673");
    setEtoZeroExcessCid("56935495");
    setEtoZeroExcessBa("73804373");
    setEtoExcessCid("56935466");
    setEtoExcessBa("73675595");
    setExoCid("57269673");
    setExoIata("02170722");
    showToast("Valores padrão restaurados! Clique em salvar para aplicar.");
  };

  if (loading) return (
    <div className="flex justify-center py-10">
      <div className="w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin"></div>
    </div>
  );

  return (
    <div className="max-w-3xl space-y-6">
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-5 py-3 rounded-lg shadow-2xl font-bold text-sm ${toast.type === "success" ? "bg-green-600 text-white" : "bg-red-600 text-white"}`}>
          {toast.message}
        </div>
      )}

      <div>
        <h1 className="text-2xl font-black text-white">Configurações do Sistema</h1>
        <p className="text-gray-400 text-sm mt-1">Gerenciamento de credenciais de pagamento e contratos Europcar XRS</p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-800 gap-4">
        <button
          onClick={() => setActiveTab("cielo")}
          className={`pb-3 px-2 font-bold text-sm border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === "cielo"
              ? "border-green-500 text-green-400"
              : "border-transparent text-gray-400 hover:text-gray-200"
          }`}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          Cielo & Pagamentos
        </button>

        <button
          onClick={() => setActiveTab("xrs")}
          className={`pb-3 px-2 font-bold text-sm border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === "xrs"
              ? "border-green-500 text-green-400"
              : "border-transparent text-gray-400 hover:text-gray-200"
          }`}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Contratos & Vouchers Europcar (XRS)
        </button>
      </div>

      {/* TAB 1: CIELO */}
      {activeTab === "cielo" && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <div className="flex items-start gap-3 bg-blue-500/10 border border-blue-500/20 rounded-lg p-4 mb-6">
            <svg className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm text-blue-300">Insira as credenciais fornecidas pela Cielo E-commerce (API 3.0) para ativar pagamentos com PIX e Cartão de Crédito.</p>
          </div>

          <form onSubmit={handleSaveCielo} className="space-y-5">
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

            <div className="border-t border-gray-700 pt-5">
              <div className="flex items-start gap-3 bg-orange-500/10 border border-orange-500/20 rounded-lg p-4 mb-4">
                <svg className="w-5 h-5 text-orange-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                </svg>
                <div>
                  <p className="text-sm text-orange-300 font-bold mb-1">Identificação do Lojista (3DS 2.2)</p>
                  <p className="text-xs text-orange-400">
                    Campos obrigatórios para evitar os erros <strong>605</strong> (EstablishmentCode), <strong>606</strong> (MerchantName) e <strong>607</strong> (MCC).
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Establishment Code <span className="text-orange-400">(Afiliação Cielo)</span></label>
                  <input
                    type="text"
                    value={establishmentCode}
                    onChange={e => setEstablishmentCode(e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-sm text-white font-mono outline-none focus:border-orange-600"
                    placeholder="Ex: 1234567890"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Nome do Lojista (MerchantName)</label>
                  <input
                    type="text"
                    value={merchantName}
                    onChange={e => setMerchantName(e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-sm text-white outline-none focus:border-orange-600"
                    placeholder="Europcar Brasil"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase mb-2">MCC — Merchant Category Code</label>
                  <input
                    type="text"
                    value={mcc}
                    onChange={e => setMcc(e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-sm text-white font-mono outline-none focus:border-orange-600"
                    placeholder="7512"
                  />
                </div>
              </div>
            </div>

            <div className="border-t border-gray-700 pt-5">
              <div className="flex items-start gap-3 bg-purple-500/10 border border-purple-500/20 rounded-lg p-4 mb-4">
                <svg className="w-5 h-5 text-purple-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                <div>
                  <p className="text-sm text-purple-300 font-bold mb-1">Autenticação 3DS 2.2 (Braspag MPI)</p>
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
              </div>
            </div>

            <div className="pt-4 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={handleTest}
                disabled={testing || saving}
                className="flex items-center gap-2 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/30 text-blue-300 px-5 py-3 rounded-lg font-bold text-sm transition-colors disabled:opacity-50"
              >
                {testing ? "Testando..." : "Testar Conexão"}
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
      )}

      {/* TAB 2: CONTRATOS EUROPCAR XRS */}
      {activeTab === "xrs" && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-6">
          <div className="flex items-start gap-3 bg-green-500/10 border border-green-500/20 rounded-lg p-4">
            <svg className="w-5 h-5 text-green-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <p className="text-sm text-green-300 font-bold mb-1">Contratos & Vouchers Europcar (XRS)</p>
              <p className="text-xs text-gray-400">
                Altere facilmente os <strong>Contract IDs (CID)</strong> e <strong>Billing Accounts (BA)</strong> utilizados nas cotações e reservas XRS sem precisar alterar o código-fonte.
              </p>
            </div>
          </div>

          <form onSubmit={handleSaveXrs} className="space-y-6">
            {/* Seção POA */}
            <div className="bg-gray-800/50 border border-gray-700/60 rounded-lg p-4 space-y-3">
              <div className="flex items-center gap-2">
                <span className="bg-green-500/20 text-green-400 text-xs font-bold px-2 py-0.5 rounded">POA</span>
                <h3 className="text-sm font-bold text-white">Pay On Arrival (Balcão / Tarifa Pública)</h3>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Contract ID (CID)</label>
                <input
                  type="text"
                  required
                  value={poaCid}
                  onChange={e => setPoaCid(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-sm text-white font-mono outline-none focus:border-green-600"
                  placeholder="57269673"
                />
                <p className="text-[11px] text-gray-500 mt-1">Usado para reservas com pagamento direto no balcão.</p>
              </div>
            </div>

            {/* Seção ETO Zero Excess */}
            <div className="bg-gray-800/50 border border-gray-700/60 rounded-lg p-4 space-y-4">
              <div className="flex items-center gap-2">
                <span className="bg-blue-500/20 text-blue-400 text-xs font-bold px-2 py-0.5 rounded">ETO</span>
                <h3 className="text-sm font-bold text-white">Net International — Zero Excess (Isenção Total de Franquia)</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Contract ID (CID)</label>
                  <input
                    type="text"
                    required
                    value={etoZeroExcessCid}
                    onChange={e => setEtoZeroExcessCid(e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-sm text-white font-mono outline-none focus:border-green-600"
                    placeholder="56935495"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Billing Account (BA)</label>
                  <input
                    type="text"
                    required
                    value={etoZeroExcessBa}
                    onChange={e => setEtoZeroExcessBa(e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-sm text-white font-mono outline-none focus:border-green-600"
                    placeholder="73804373"
                  />
                </div>
              </div>
            </div>

            {/* Seção ETO Excess */}
            <div className="bg-gray-800/50 border border-gray-700/60 rounded-lg p-4 space-y-4">
              <div className="flex items-center gap-2">
                <span className="bg-purple-500/20 text-purple-400 text-xs font-bold px-2 py-0.5 rounded">ETO</span>
                <h3 className="text-sm font-bold text-white">Net — Excess (Com Excesso / Franquia Padrão)</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Contract ID (CID)</label>
                  <input
                    type="text"
                    required
                    value={etoExcessCid}
                    onChange={e => setEtoExcessCid(e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-sm text-white font-mono outline-none focus:border-green-600"
                    placeholder="56935466"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Billing Account (BA)</label>
                  <input
                    type="text"
                    required
                    value={etoExcessBa}
                    onChange={e => setEtoExcessBa(e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-sm text-white font-mono outline-none focus:border-green-600"
                    placeholder="73675595"
                  />
                </div>
              </div>
            </div>

            {/* Seção EXO Agência */}
            <div className="bg-gray-800/50 border border-gray-700/60 rounded-lg p-4 space-y-4">
              <div className="flex items-center gap-2">
                <span className="bg-yellow-500/20 text-yellow-400 text-xs font-bold px-2 py-0.5 rounded">EXO</span>
                <h3 className="text-sm font-bold text-white">Voucher Agência (EXO / Europcar Brasil)</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Contract ID (CID)</label>
                  <input
                    type="text"
                    required
                    value={exoCid}
                    onChange={e => setExoCid(e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-sm text-white font-mono outline-none focus:border-green-600"
                    placeholder="57269673"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Número IATA Agência</label>
                  <input
                    type="text"
                    required
                    value={exoIata}
                    onChange={e => setExoIata(e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-sm text-white font-mono outline-none focus:border-green-600"
                    placeholder="02170722"
                  />
                </div>
              </div>
            </div>

            <div className="pt-2 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={handleResetDefaults}
                className="text-xs text-gray-400 hover:text-white underline transition-colors"
              >
                Restaurar Padrões Europcar
              </button>

              <button
                type="submit"
                disabled={savingXrs}
                className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-bold text-sm transition-colors disabled:opacity-50"
              >
                {savingXrs ? "Salvando..." : "Salvar Configuração de Contratos"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
