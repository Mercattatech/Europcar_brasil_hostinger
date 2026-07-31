"use client";

import { useState, useEffect } from "react";

interface ErrorEntry {
  code: string;
  message: string;
}

export default function ErrosReservaPage() {
  const [entries, setEntries] = useState<ErrorEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [code, setCode] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const showToast = (msg: string, t: "success" | "error" = "success") => {
    setToast({ message: msg, type: t });
    setTimeout(() => setToast(null), 3000);
  };

  const load = () => {
    setLoading(true);
    fetch("/api/admin/reservation-errors")
      .then(res => res.json())
      .then(data => setEntries(Array.isArray(data) ? data : []))
      .catch(() => setEntries([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim() || !message.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/admin/reservation-errors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: code.trim(), message: message.trim() }),
      });
      if (res.ok) {
        showToast("Mensagem salva com sucesso!");
        setCode("");
        setMessage("");
        load();
      } else {
        showToast("Erro ao salvar", "error");
      }
    } catch {
      showToast("Erro de conexão", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (entryCode: string) => {
    if (!confirm(`Remover a mensagem do código "${entryCode}"?`)) return;
    try {
      await fetch(`/api/admin/reservation-errors?code=${encodeURIComponent(entryCode)}`, { method: "DELETE" });
      load();
    } catch {
      showToast("Erro ao remover", "error");
    }
  };

  const handleEdit = (entry: ErrorEntry) => {
    setCode(entry.code);
    setMessage(entry.message);
  };

  return (
    <div className="max-w-3xl space-y-6">
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-5 py-3 rounded-lg shadow-2xl font-bold text-sm ${toast.type === "success" ? "bg-green-600 text-white" : "bg-red-600 text-white"}`}>
          {toast.message}
        </div>
      )}

      <div>
        <h1 className="text-2xl font-black text-white">Erros de Reserva (CMS)</h1>
        <p className="text-gray-400 text-sm mt-1">
          Mensagens amigáveis para códigos de erro da Cielo (ReturnCode) e da Europcar (XRS), exibidas ao cliente no lugar do texto técnico.
          Ex: código <span className="font-mono text-orange-400">129</span> para "Affiliation not found", ou <span className="font-mono text-orange-400">ZERO_AUTH</span> para recusa na validação prévia do cartão.
          Se um código não tiver mensagem cadastrada aqui, o sistema usa a mensagem técnica padrão.
        </p>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-1">
              <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Código</label>
              <input
                type="text"
                required
                value={code}
                onChange={e => setCode(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-sm text-white font-mono outline-none focus:border-green-600"
                placeholder="Ex: 129"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Mensagem amigável</label>
              <input
                type="text"
                required
                value={message}
                onChange={e => setMessage(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-sm text-white outline-none focus:border-green-600"
                placeholder="Ex: Sua afiliação com a Cielo não foi encontrada. Contate o suporte."
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={saving}
            className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-bold text-sm transition-colors disabled:opacity-50"
          >
            {saving ? "Salvando..." : "Salvar"}
          </button>
        </form>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
        <h2 className="text-base font-bold text-white mb-4">Códigos cadastrados</h2>
        {loading ? (
          <div className="flex justify-center py-6">
            <div className="w-6 h-6 border-4 border-green-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : entries.length === 0 ? (
          <p className="text-sm text-gray-500">Nenhuma mensagem cadastrada ainda — os erros usam o texto técnico padrão do sistema.</p>
        ) : (
          <div className="space-y-2">
            {entries.map(entry => (
              <div key={entry.code} className="flex items-start justify-between gap-3 bg-gray-800 border border-gray-700 rounded-lg p-4">
                <div className="min-w-0">
                  <span className="font-mono text-xs text-orange-400">{entry.code}</span>
                  <p className="text-sm text-gray-200 mt-1">{entry.message}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button onClick={() => handleEdit(entry)} className="text-xs text-blue-400 hover:text-blue-300 font-bold px-2 py-1">Editar</button>
                  <button onClick={() => handleDelete(entry.code)} className="text-xs text-red-400 hover:text-red-300 font-bold px-2 py-1">Remover</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
