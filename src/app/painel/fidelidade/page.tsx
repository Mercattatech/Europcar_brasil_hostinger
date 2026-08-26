"use client";
import { useEffect, useState } from "react";

interface LoyaltyProgram {
  id: string;
  name: string;
  code: string;
  active: boolean;
}

export default function PainelFidelidadePage() {
  const [programs, setPrograms] = useState<LoyaltyProgram[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [newCode, setNewCode] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editCode, setEditCode] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchPrograms = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/loyalty-programs");
      const data = await res.json();
      setPrograms(data);
    } catch (err) {
      console.error("Error fetching programs:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchPrograms(); }, []);

  const handleAdd = async () => {
    if (!newName.trim()) return;
    setSaving(true);
    try {
      await fetch("/api/loyalty-programs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim(), code: newCode.trim() || undefined }),
      });
      setNewName("");
      setNewCode("");
      await fetchPrograms();
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async (id: string) => {
    setSaving(true);
    try {
      await fetch("/api/loyalty-programs", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, name: editName, code: editCode }),
      });
      setEditingId(null);
      await fetchPrograms();
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Excluir "${name}"?`)) return;
    try {
      await fetch(`/api/loyalty-programs?id=${id}`, { method: "DELETE" });
      await fetchPrograms();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-black text-white mb-1">Programas de Fidelidade</h1>
      <p className="text-gray-400 text-sm mb-6">Gerencie os programas de fidelidade disponíveis no checkout.</p>

      {/* Add new */}
      <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-5 mb-6">
        <h2 className="text-sm font-bold text-white mb-3">Adicionar Novo Programa</h2>
        <div className="flex gap-3 items-end">
          <div className="flex-1">
            <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Nome do Programa</label>
            <input
              value={newName}
              onChange={e => setNewName(e.target.value)}
              placeholder="Ex: LATAM PASS"
              className="w-full bg-gray-900 border border-gray-600 text-white rounded px-3 py-2.5 text-sm outline-none focus:border-[#008d36]"
            />
          </div>
          <div className="w-40">
            <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Código (opcional)</label>
            <input
              value={newCode}
              onChange={e => setNewCode(e.target.value.toUpperCase())}
              placeholder="Auto"
              className="w-full bg-gray-900 border border-gray-600 text-white rounded px-3 py-2.5 text-sm outline-none focus:border-[#008d36]"
            />
          </div>
          <button
            onClick={handleAdd}
            disabled={saving || !newName.trim()}
            className="bg-[#008d36] hover:bg-[#007a2d] disabled:opacity-50 text-white font-bold px-6 py-2.5 rounded text-sm transition-colors shrink-0"
          >
            {saving ? "..." : "Adicionar"}
          </button>
        </div>
      </div>

      {/* List */}
      <div className="bg-gray-800/50 border border-gray-700 rounded-lg overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-700 flex justify-between items-center">
          <h2 className="text-sm font-bold text-white">Lista de Programas ({programs.length})</h2>
        </div>
        {loading ? (
          <div className="p-8 text-center text-gray-400">
            <div className="w-6 h-6 border-2 border-[#008d36] border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
            Carregando...
          </div>
        ) : programs.length === 0 ? (
          <div className="p-8 text-center text-gray-500">Nenhum programa cadastrado.</div>
        ) : (
          <div className="divide-y divide-gray-700/50">
            {programs.map(p => (
              <div key={p.id} className="px-5 py-3 flex items-center gap-3 hover:bg-gray-700/20 transition-colors">
                {editingId === p.id ? (
                  <>
                    <input
                      value={editName}
                      onChange={e => setEditName(e.target.value)}
                      className="flex-1 bg-gray-900 border border-gray-600 text-white rounded px-3 py-1.5 text-sm outline-none focus:border-[#008d36]"
                    />
                    <input
                      value={editCode}
                      onChange={e => setEditCode(e.target.value.toUpperCase())}
                      className="w-32 bg-gray-900 border border-gray-600 text-white rounded px-3 py-1.5 text-sm outline-none focus:border-[#008d36]"
                    />
                    <button
                      onClick={() => handleUpdate(p.id)}
                      disabled={saving}
                      className="bg-[#008d36] text-white text-xs font-bold px-3 py-1.5 rounded transition-colors hover:bg-[#007a2d]"
                    >Salvar</button>
                    <button
                      onClick={() => setEditingId(null)}
                      className="bg-gray-600 text-white text-xs font-bold px-3 py-1.5 rounded transition-colors hover:bg-gray-500"
                    >Cancelar</button>
                  </>
                ) : (
                  <>
                    <div className="flex-1 min-w-0">
                      <span className="text-white text-sm font-medium">{p.name}</span>
                      <span className="text-gray-500 text-xs ml-2">({p.code})</span>
                    </div>
                    <button
                      onClick={() => { setEditingId(p.id); setEditName(p.name); setEditCode(p.code); }}
                      className="text-gray-400 hover:text-[#e67e00] text-xs font-bold transition-colors"
                    >✏️ Editar</button>
                    <button
                      onClick={() => handleDelete(p.id, p.name)}
                      className="text-gray-400 hover:text-red-400 text-xs font-bold transition-colors"
                    >🗑️ Excluir</button>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
