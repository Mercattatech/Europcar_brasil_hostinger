"use client";

import { useState, useEffect } from "react";

export default function PainelPromocoes() {
  const [promotions, setPromotions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  // Form fields
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [description, setDescription] = useState("");
  const [discountValue, setDiscountValue] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [contractID, setContractID] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [promoStatus, setPromoStatus] = useState("ACTIVE");
  
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ message: msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchPromotions = async () => {
    try {
      const res = await fetch("/api/admin/promotions");
      if (res.ok) setPromotions(await res.json());
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchPromotions(); }, []);

  const resetForm = () => {
    setEditingId(null); setTitle(""); setSubtitle(""); setDescription(""); setDiscountValue("");
    setImageUrl(""); setContractID(""); setStartDate(""); setEndDate(""); setIsActive(true); setPromoStatus("ACTIVE");
  };

  const handleOpenNew = () => { resetForm(); setShowModal(true); };

  const handleOpenEdit = (p: any) => {
    setEditingId(p.id);
    setTitle(p.title || "");
    setSubtitle(p.subtitle || "");
    setDescription(p.description || "");
    setDiscountValue(p.discountValue?.toString() || "");
    setImageUrl(p.imageUrl || "");
    setContractID(p.contractID || "");
    setStartDate(p.startDate ? new Date(p.startDate).toISOString().split("T")[0] : "");
    setEndDate(p.endDate ? new Date(p.endDate).toISOString().split("T")[0] : "");
    setIsActive(p.isActive !== undefined ? p.isActive : true);
    setPromoStatus(p.status || "ACTIVE");
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true);
    const payload = {
      title, subtitle, description,
      discountValue: discountValue ? parseFloat(discountValue) : null,
      imageUrl, contractID: contractID || null,
      startDate: startDate || null, endDate: endDate || null,
      isActive, status: promoStatus
    };
    try {
      const url = editingId ? `/api/admin/promotions/${editingId}` : "/api/admin/promotions";
      const res = await fetch(url, { method: editingId ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (res.ok) { setShowModal(false); fetchPromotions(); showToast("Promoção salva!"); }
      else showToast("Erro ao salvar", "error");
    } catch (e) { showToast("Erro de conexão", "error"); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Excluir esta promoção permanentemente?")) return;
    try {
      const res = await fetch(`/api/admin/promotions/${id}`, { method: "DELETE" });
      if (res.ok) { fetchPromotions(); showToast("Promoção excluída!"); }
    } catch (e) { console.error(e); }
  };

  const isPromoValid = (p: any) => {
    const now = new Date();
    if (p.startDate && new Date(p.startDate) > now) return false;
    if (p.endDate && new Date(p.endDate) < now) return false;
    return true;
  };

  return (
    <div className="space-y-6">
      {toast && <div className={`fixed top-4 right-4 z-50 px-5 py-3 rounded-lg shadow-2xl font-bold text-sm ${toast.type === "success" ? "bg-green-600 text-white" : "bg-red-600 text-white"}`}>{toast.message}</div>}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-white">Promoções & Ofertas</h1>
          <p className="text-gray-400 text-sm mt-1">Gerencie promoções com integração ao contractID da Europcar XRS</p>
        </div>
        <button onClick={handleOpenNew} className="bg-green-600 hover:bg-green-700 text-white px-5 py-2.5 rounded-lg font-bold text-sm transition-colors">+ Nova Promoção</button>
      </div>

      {/* Info box */}
      <div className="flex items-start gap-3 bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
        <span className="text-lg">💡</span>
        <p className="text-sm text-blue-300">O <strong>Contract ID</strong> é o código do contrato Europcar (ex: <code className="bg-blue-900/50 px-1.5 py-0.5 rounded text-xs">45944876</code>). Quando preenchido, será injetado automaticamente nas requisições XRS para aplicar o desconto negociado.</p>
      </div>

      {loading ? (
        <div className="flex justify-center py-10"><div className="w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin"></div></div>
      ) : promotions.length === 0 ? (
        <div className="bg-gray-900 border border-gray-800 p-10 rounded-xl text-center text-gray-500">Nenhuma promoção cadastrada.</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {promotions.map(p => {
            const valid = isPromoValid(p);
            return (
              <div key={p.id} className={`bg-gray-900 border rounded-xl overflow-hidden transition-colors ${p.isActive && valid ? "border-gray-800 hover:border-gray-700" : "border-gray-800/50 opacity-60"}`}>
                <div className="h-40 bg-gray-800 relative">
                  {p.imageUrl ? <img src={p.imageUrl} alt={p.title} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-gray-600 text-4xl">🏷️</div>}
                  <div className="absolute top-2 right-2 flex gap-1">
                    {p.isActive && valid && <span className="bg-green-500/90 text-white px-2 py-0.5 text-[10px] font-bold rounded">ATIVA</span>}
                    {!p.isActive && <span className="bg-red-500/90 text-white px-2 py-0.5 text-[10px] font-bold rounded">INATIVA</span>}
                    {p.isActive && !valid && <span className="bg-yellow-500/90 text-black px-2 py-0.5 text-[10px] font-bold rounded">EXPIRADA</span>}
                  </div>
                  {p.discountValue && (
                    <div className="absolute bottom-2 left-2 bg-red-600 text-white px-3 py-1 rounded-lg font-black text-lg shadow-lg">
                      {p.discountValue}% OFF
                    </div>
                  )}
                </div>
                <div className="p-4 space-y-2">
                  <h3 className="font-black text-white text-lg">{p.title}</h3>
                  {p.subtitle && <p className="text-sm text-green-400 font-medium">{p.subtitle}</p>}
                  <p className="text-xs text-gray-500 line-clamp-2">{p.description}</p>
                  
                  <div className="flex flex-wrap gap-2 pt-2">
                    {p.contractID && (
                      <span className="bg-purple-500/20 text-purple-400 px-2 py-0.5 text-[10px] font-bold rounded font-mono">ID: {p.contractID}</span>
                    )}
                    {p.startDate && (
                      <span className="bg-gray-800 text-gray-400 px-2 py-0.5 text-[10px] font-bold rounded">
                        {new Date(p.startDate).toLocaleDateString("pt-BR")} → {p.endDate ? new Date(p.endDate).toLocaleDateString("pt-BR") : "∞"}
                      </span>
                    )}
                  </div>

                  <div className="flex justify-end gap-2 border-t border-gray-800 pt-3 mt-3">
                    <button onClick={() => handleOpenEdit(p)} className="text-xs font-bold text-blue-400 hover:text-blue-300 px-3 py-1.5 bg-gray-800 rounded-lg hover:bg-gray-700 transition-colors">Editar</button>
                    <button onClick={() => handleDelete(p.id)} className="text-xs font-bold text-red-400 hover:text-red-300 px-3 py-1.5 bg-gray-800 rounded-lg hover:bg-red-900/50 transition-colors">Excluir</button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-gray-900 border border-gray-700 w-full max-w-2xl rounded-2xl shadow-2xl my-4">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
              <h2 className="text-lg font-black text-white">{editingId ? "Editar Promoção" : "Nova Promoção"}</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-500 hover:text-white">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
              </button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              {/* Title */}
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Título *</label>
                <input type="text" required value={title} onChange={e => setTitle(e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-sm text-white outline-none focus:border-green-600" placeholder="Ex: Descubra o Brasil!" />
              </div>
              {/* Subtitle */}
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Subtítulo / Chamada</label>
                <input type="text" value={subtitle} onChange={e => setSubtitle(e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-sm text-white outline-none focus:border-green-600" placeholder="Ex: Alugue por apenas R$99/dia" />
              </div>
              {/* Description */}
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Descrição / Regras</label>
                <textarea value={description} onChange={e => setDescription(e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-sm text-white outline-none focus:border-green-600" rows={3} placeholder="Regras e detalhes da oferta..."></textarea>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Discount */}
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Desconto (%)</label>
                  <input type="number" step="0.01" value={discountValue} onChange={e => setDiscountValue(e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-sm text-white outline-none focus:border-green-600" placeholder="20" />
                </div>
                {/* Contract ID */}
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Contract ID (XRS) ⭐</label>
                  <input type="text" value={contractID} onChange={e => setContractID(e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-sm text-white font-mono outline-none focus:border-purple-600 focus:ring-1 focus:ring-purple-500/30" placeholder="Ex: 45944876" />
                  <p className="text-[10px] text-purple-400/70 mt-1">Código oficial do contrato/desconto Europcar para injetar na API XRS</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Start Date */}
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Data Início</label>
                  <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-sm text-white outline-none focus:border-green-600" />
                </div>
                {/* End Date */}
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Data Fim</label>
                  <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-sm text-white outline-none focus:border-green-600" />
                </div>
              </div>

              {/* Image URL */}
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase mb-2">URL da Imagem de Destaque</label>
                <input type="text" value={imageUrl} onChange={e => setImageUrl(e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-sm text-white outline-none focus:border-green-600" placeholder="https://..." />
              </div>

              {/* Toggles row */}
              <div className="flex gap-4">
                <div className="flex-1 flex items-center gap-3 bg-gray-800/50 rounded-lg p-3">
                  <input type="checkbox" id="isActiveCb" checked={isActive} onChange={e => setIsActive(e.target.checked)} className="w-5 h-5 accent-green-600 rounded" />
                  <label htmlFor="isActiveCb" className="text-sm text-white font-bold cursor-pointer">Ativa no site</label>
                </div>
                <div className="flex-1">
                  <select value={promoStatus} onChange={e => setPromoStatus(e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-sm text-white outline-none focus:border-green-600 h-full">
                    <option value="ACTIVE">Status: Ativo</option>
                    <option value="ARCHIVED">Status: Arquivado</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-800">
                <button type="button" onClick={() => setShowModal(false)} className="px-5 py-2.5 bg-gray-800 text-gray-300 font-bold text-sm rounded-lg hover:bg-gray-700">Cancelar</button>
                <button type="submit" disabled={saving} className="px-5 py-2.5 bg-green-600 hover:bg-green-700 text-white font-bold text-sm rounded-lg disabled:opacity-50">{saving ? "Salvando..." : "Salvar Promoção"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
