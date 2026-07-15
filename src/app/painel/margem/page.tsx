"use client";

import { useState, useEffect } from "react";

export default function MargemPage() {
  const [margin, setMargin] = useState(0);
  const [savedMargin, setSavedMargin] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState("");

  useEffect(() => {
    fetch("/api/admin/margin")
      .then(r => r.json())
      .then(d => {
        setMargin(d.percent || 0);
        setSavedMargin(d.percent || 0);
      })
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/margin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ percent: margin }),
      });
      const data = await res.json();
      if (data.success) {
        setSavedMargin(data.percent);
        setToast("✅ Margem salva com sucesso!");
        setTimeout(() => setToast(""), 3000);
      } else {
        setToast("❌ Erro ao salvar: " + (data.error || ""));
        setTimeout(() => setToast(""), 5000);
      }
    } catch (e: any) {
      setToast("❌ Erro: " + e.message);
      setTimeout(() => setToast(""), 5000);
    } finally {
      setSaving(false);
    }
  };

  const hasChanges = margin !== savedMargin;

  // Example prices for preview
  const exampleEUR = 88.26;
  const exampleBRL = 531.26;
  const examplePOA = exampleBRL; // POA = same as public
  const exampleETO = exampleBRL * 0.75; // ETO = ~25% discount
  const exampleETOWithMargin = exampleETO * (1 + margin / 100);
  const profitPerRental = exampleETOWithMargin - exampleETO;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="w-10 h-10 border-4 border-green-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-20 right-6 z-50 px-6 py-3 rounded-xl shadow-2xl font-bold text-sm animate-pulse ${toast.startsWith("✅") ? "bg-green-600 text-white" : "bg-red-600 text-white"}`}>
          {toast}
        </div>
      )}

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-black text-white flex items-center gap-3">
          💹 Controlador de Margem ETO
        </h1>
        <p className="text-gray-400 mt-2">
          Defina a margem de lucro aplicada sobre a tarifa corporativa ETO. Essa porcentagem é adicionada ao preço ETO exibido no site.
        </p>
      </div>

      {/* Main Card */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 mb-6">
        <div className="flex items-start gap-8">
          {/* Left: Slider */}
          <div className="flex-1">
            <label className="block text-sm font-bold text-gray-300 mb-4">
              Margem de lucro (%)
            </label>

            {/* Slider */}
            <div className="mb-6">
              <input
                type="range"
                min="0"
                max="50"
                step="0.5"
                value={margin}
                onChange={(e) => setMargin(parseFloat(e.target.value))}
                className="w-full h-3 rounded-full appearance-none cursor-pointer"
                style={{
                  background: `linear-gradient(to right, #e67e00 0%, #e67e00 ${margin * 2}%, #374151 ${margin * 2}%, #374151 100%)`,
                }}
              />
              <div className="flex justify-between text-[10px] text-gray-500 font-bold mt-1">
                <span>0%</span>
                <span>10%</span>
                <span>20%</span>
                <span>30%</span>
                <span>40%</span>
                <span>50%</span>
              </div>
            </div>

            {/* Numeric input */}
            <div className="flex items-center gap-4">
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.5"
                  value={margin}
                  onChange={(e) => setMargin(Math.max(0, Math.min(100, parseFloat(e.target.value) || 0)))}
                  className="w-28 bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-2xl font-black text-white text-center outline-none focus:border-[#e67e00] transition-colors"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 font-bold">%</span>
              </div>
              <button
                onClick={handleSave}
                disabled={saving || !hasChanges}
                className={`px-8 py-3 rounded-lg font-bold text-sm transition-all ${
                  hasChanges
                    ? "bg-[#e67e00] hover:bg-[#cc6f00] text-white shadow-lg shadow-[#e67e00]/25"
                    : "bg-gray-800 text-gray-600 cursor-not-allowed"
                }`}
              >
                {saving ? "Salvando..." : hasChanges ? "Salvar Margem" : "Salvo ✓"}
              </button>
            </div>

            {/* Current saved value */}
            <div className="mt-4 flex items-center gap-2">
              <span className="text-xs text-gray-500">Margem atual salva:</span>
              <span className="text-sm font-black text-[#e67e00]">{savedMargin}%</span>
            </div>
          </div>

          {/* Right: Preview */}
          <div className="w-72 shrink-0">
            <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-5">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">📊 Simulação de preço</h3>

              {/* POA price */}
              <div className="border border-gray-700 rounded-lg p-3 mb-3">
                <div className="text-[10px] text-gray-500 font-bold uppercase">Tarifa POA (Pública)</div>
                <div className="text-lg font-black text-white">R$ {examplePOA.toFixed(2).replace(".", ",")}</div>
                <div className="text-[10px] text-gray-500">Base: EUR {exampleEUR.toFixed(2)}</div>
              </div>

              {/* ETO price */}
              <div className="border-2 border-[#e67e00] rounded-lg p-3 bg-[#e67e00]/5 relative">
                <span className="absolute -top-2 right-2 text-[9px] bg-[#e67e00] text-white px-2 py-0.5 rounded-full font-black">
                  -{Math.round((1 - exampleETOWithMargin / examplePOA) * 100)}%
                </span>
                <div className="text-[10px] text-[#e67e00] font-bold uppercase">Tarifa ETO + Margem</div>
                <div className="text-lg font-black text-white">R$ {exampleETOWithMargin.toFixed(2).replace(".", ",")}</div>
                <div className="text-[10px] text-gray-500">
                  Base ETO: R$ {exampleETO.toFixed(2).replace(".", ",")}
                  <span className="text-[#e67e00] ml-1">+ {margin}% = R$ {(exampleETOWithMargin - exampleETO).toFixed(2).replace(".", ",")}</span>
                </div>
              </div>

              {/* Profit */}
              <div className="mt-4 bg-green-900/20 border border-green-800/30 rounded-lg p-3">
                <div className="text-[10px] text-green-400 font-bold uppercase">Seu lucro por reserva ETO</div>
                <div className="text-xl font-black text-green-400">
                  R$ {profitPerRental.toFixed(2).replace(".", ",")}
                </div>
                <div className="text-[10px] text-green-600">
                  Sobre exemplo de R$ {exampleETO.toFixed(2).replace(".", ",")} (EDMR)
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Info cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <div className="text-2xl mb-2">🏷️</div>
          <h3 className="font-bold text-white text-sm mb-1">Tarifa POA</h3>
          <p className="text-xs text-gray-400">Tarifa pública. Mesmo preço que o site oficial. Aceita PIX, Cartão e Balcão.</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <div className="text-2xl mb-2">📊</div>
          <h3 className="font-bold text-white text-sm mb-1">Tarifa ETO</h3>
          <p className="text-xs text-gray-400">Tarifa corporativa com desconto. Margem aplicada sobre o preço base. Aceita PIX e Cartão.</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <div className="text-2xl mb-2">💰</div>
          <h3 className="font-bold text-white text-sm mb-1">Sua Margem</h3>
          <p className="text-xs text-gray-400">A porcentagem definida aqui é adicionada ao preço ETO. Você ganha a diferença em cada reserva.</p>
        </div>
      </div>
    </div>
  );
}
