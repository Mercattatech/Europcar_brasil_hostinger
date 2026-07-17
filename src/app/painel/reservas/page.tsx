"use client";

import { useState, useEffect, Fragment } from "react";

const STATUS_OPTIONS = [
   { value: "ALL", label: "Todos", color: "bg-gray-700 text-gray-300" },
   { value: "CONFIRMED_PREPAID", label: "Pago Online", color: "bg-green-500/20 text-green-400" },
   { value: "PENDING_PIX", label: "PIX Pendente", color: "bg-yellow-500/20 text-yellow-400" },
   { value: "CONFIRMED_NON_PREPAID", label: "Pagar no Balcão", color: "bg-blue-500/20 text-blue-400" },
   { value: "CANCELLED", label: "Cancelada", color: "bg-red-500/20 text-red-400" },
];

const STATUS_COLORS: Record<string, string> = {
   "CONFIRMED_PREPAID": "bg-green-500/20 text-green-400 border-green-600/30",
   "PENDING_PIX": "bg-yellow-500/20 text-yellow-400 border-yellow-600/30",
   "CONFIRMED_NON_PREPAID": "bg-blue-500/20 text-blue-300 border-blue-600/30",
   "CANCELLED": "bg-red-500/20 text-red-400 border-red-600/30",
};
const STATUS_LABELS: Record<string, string> = {
   "CONFIRMED_PREPAID": "Pago Online (Cielo)",
   "PENDING_PIX": "PIX Aguardando",
   "CONFIRMED_NON_PREPAID": "Pagar no Balcão",
   "CANCELLED": "Cancelada / Erro",
};

export default function PainelReservas() {
   const [reservations, setReservations] = useState<any[]>([]);
   const [loading, setLoading] = useState(true);
   const [statusFilter, setStatusFilter] = useState("ALL");
   const [search, setSearch] = useState("");
   const [startDate, setStartDate] = useState("");
   const [endDate, setEndDate] = useState("");
   const [expandedRow, setExpandedRow] = useState<string | null>(null);
   const [changingStatus, setChangingStatus] = useState<string | null>(null);
   const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
   // ✅ Modal de cancelamento com políticas Europcar (requisito de homologação XRS)
   const [cancelModal, setCancelModal] = useState<{ id: string; resNumber: string } | null>(null);

   const showToast = (message: string, type: "success" | "error" = "success") => {
      setToast({ message, type });
      setTimeout(() => setToast(null), 3000);
   };

   const fetchReservations = async () => {
      setLoading(true);
      try {
         const params = new URLSearchParams();
         if (statusFilter !== "ALL") params.set("status", statusFilter);
         if (search) params.set("search", search);
         if (startDate) params.set("startDate", startDate);
         if (endDate) params.set("endDate", endDate);
         const res = await fetch(`/api/admin/reservations?${params}`);
         const data = await res.json();
         setReservations(Array.isArray(data) ? data : []);
      } catch (e) {
         console.error(e);
      } finally {
         setLoading(false);
      }
   };

   useEffect(() => { fetchReservations(); }, [statusFilter, startDate, endDate]);

   const handleSearch = (e: React.FormEvent) => {
      e.preventDefault();
      fetchReservations();
   };

   const handleChangeStatus = async (id: string, newStatus: string) => {
      if (!confirm(`Deseja alterar o status desta reserva para "${STATUS_LABELS[newStatus] || newStatus}"?`)) return;
      
      try {
         const res = await fetch(`/api/admin/reservations/${id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: newStatus }),
         });
         if (res.ok) {
            showToast("Status atualizado!");
            fetchReservations();
            setChangingStatus(null);
         } else {
            showToast("Erro ao atualizar", "error");
         }
      } catch (e) {
         showToast("Erro de conexão", "error");
      }
   };

   const handleDelete = async (id: string) => {
      // Chamado após confirmação no modal — não usa confirm() nativo
      try {
         const res = await fetch(`/api/admin/reservations/${id}`, { method: "DELETE" });
         const data = await res.json();
         if (res.ok) {
            if (data.xrsCancelled) {
               showToast("Reserva cancelada na Europcar e no sistema local!");
            } else {
               showToast("Reserva cancelada localmente. Verifique o portal Europcar se necessário.", "success");
            }
            fetchReservations();
         } else {
            showToast(data.error || "Erro ao cancelar", "error");
         }
      } catch (e) {
         showToast("Erro de conexão", "error");
      } finally {
         setCancelModal(null);
      }
   };

   // Count by status
   const counts: Record<string, number> = { ALL: reservations.length };
   reservations.forEach(r => { counts[r.status] = (counts[r.status] || 0) + 1; });

   return (
      <div className="space-y-6">

         {/* ✅ Modal de Cancelamento com Políticas Europcar */}
         {cancelModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
               <div className="bg-gray-900 border border-red-800/40 rounded-2xl p-8 max-w-md w-full mx-4 shadow-2xl">
                  <div className="flex items-center gap-3 mb-4">
                     <div className="w-10 h-10 rounded-full bg-red-900/40 flex items-center justify-center shrink-0">
                        <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                           <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
                        </svg>
                     </div>
                     <div>
                        <h3 className="text-lg font-black text-white">Confirmar Cancelamento</h3>
                        <p className="text-xs text-gray-500">Reserva: <span className="text-white font-mono">{cancelModal.resNumber}</span></p>
                     </div>
                  </div>

                  <div className="bg-yellow-950/40 border border-yellow-700/30 rounded-xl p-4 mb-6 space-y-1.5">
                     <p className="text-xs font-bold text-yellow-300 mb-2 flex items-center gap-1.5">
                        <span>📋</span> Política de Cancelamento Europcar
                     </p>
                     <p className="text-xs text-yellow-200/80">• Mais de 48h de antecedência: <strong className="text-yellow-200">sem cobrança.</strong></p>
                     <p className="text-xs text-yellow-200/80">• Entre 24h e 48h antes: <strong className="text-yellow-200">50% do valor da primeira diária.</strong></p>
                     <p className="text-xs text-yellow-200/80">• Menos de 24h ou no-show: <strong className="text-yellow-200">100% da primeira diária.</strong></p>
                     <p className="text-xs text-yellow-200/80">• Modalidade &quot;Pagar no Balcão&quot; (NP): <strong className="text-yellow-200">cancelamento gratuito.</strong></p>
                  </div>

                  <div className="flex gap-3">
                     <button
                        onClick={() => setCancelModal(null)}
                        className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-300 font-bold py-2.5 rounded-xl text-sm transition-colors"
                     >
                        Manter Reserva
                     </button>
                     <button
                        onClick={() => handleDelete(cancelModal.id)}
                        className="flex-1 bg-red-700 hover:bg-red-600 text-white font-bold py-2.5 rounded-xl text-sm transition-colors"
                     >
                        Confirmar Cancelamento
                     </button>
                  </div>
               </div>
            </div>
         )}
         {/* Toast */}
         {toast && (
            <div className={`fixed top-4 right-4 z-50 px-5 py-3 rounded-lg shadow-2xl font-bold text-sm animate-pulse ${
               toast.type === "success" ? "bg-green-600 text-white" : "bg-red-600 text-white"
            }`}>
               {toast.message}
            </div>
         )}

         {/* Header */}
         <div>
            <h1 className="text-2xl font-black text-white">Gestão de Reservas</h1>
            <p className="text-gray-400 text-sm mt-1">Todas as reservas do sistema — pagas, pendentes e canceladas</p>
         </div>

         {/* Status Filter Tabs */}
         <div className="flex flex-wrap gap-2">
            {STATUS_OPTIONS.map(opt => (
               <button
                  key={opt.value}
                  onClick={() => setStatusFilter(opt.value)}
                  className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                     statusFilter === opt.value
                        ? `${opt.color} ring-1 ring-current scale-105`
                        : "bg-gray-800 text-gray-500 hover:text-gray-300"
                  }`}
               >
                  {opt.label} {counts[opt.value] !== undefined ? `(${counts[opt.value]})` : ""}
               </button>
            ))}
         </div>

         {/* Date Filter */}
         <div className="flex flex-wrap items-end gap-3">
            <div>
               <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Data Início</label>
               <input
                  type="date"
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                  className="bg-gray-900 border border-gray-800 rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-green-600 transition-colors [color-scheme:dark]"
               />
            </div>
            <div>
               <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Data Fim</label>
               <input
                  type="date"
                  value={endDate}
                  onChange={e => setEndDate(e.target.value)}
                  className="bg-gray-900 border border-gray-800 rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-green-600 transition-colors [color-scheme:dark]"
               />
            </div>
            {(startDate || endDate) && (
               <button
                  onClick={() => { setStartDate(""); setEndDate(""); }}
                  className="bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white px-3 py-2.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5"
               >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                  Limpar datas
               </button>
            )}
         </div>

         {/* Search */}
         <form onSubmit={handleSearch} className="flex gap-3">
            <div className="relative flex-1">
               <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
               </svg>
               <input
                  type="text"
                  placeholder="Buscar por reserva, nome, email ou CPF..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full bg-gray-900 border border-gray-800 rounded-lg pl-10 pr-4 py-2.5 text-sm text-white placeholder-gray-500 outline-none focus:border-green-600 transition-colors"
               />
            </div>
            <button type="submit" className="bg-green-600 hover:bg-green-700 text-white font-bold px-5 py-2.5 rounded-lg text-sm transition-colors">
               Buscar
            </button>
         </form>

         {/* Reservations Table */}
         <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
               <table className="w-full text-sm text-left">
                  <thead className="bg-gray-800/50 border-b border-gray-700">
                     <tr>
                        <th className="px-5 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Reserva</th>
                        <th className="px-5 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Cliente</th>
                        <th className="px-5 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Veículo</th>
                        <th className="px-5 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Valor</th>
                        <th className="px-5 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Status</th>
                        <th className="px-5 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Data</th>
                        <th className="px-5 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider text-right">Ações</th>
                     </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800/50">
                     {loading && (
                        <tr><td colSpan={7} className="text-center py-10">
                           <div className="w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
                        </td></tr>
                     )}
                     {!loading && reservations.length === 0 && (
                        <tr><td colSpan={7} className="text-center py-10 text-gray-500">Nenhuma reserva encontrada.</td></tr>
                     )}
                     {!loading && reservations.map(res => {
                        let parsed: any = {};
                        try { parsed = typeof res.customerData === "string" ? JSON.parse(res.customerData) : res.customerData; } catch(e){}
                        const isExpanded = expandedRow === res.id;

                        return (
                           <Fragment key={res.id}>
                              <tr className="hover:bg-gray-800/30 transition-colors group">
                              <td className="px-5 py-4">
                                 <div className="font-black text-white text-base">{res.resNumber || "—"}</div>
                                 <div className="text-[10px] text-gray-600 font-mono">{res.merchantOrderId?.slice(0, 12)}...</div>
                              </td>
                              <td className="px-5 py-4">
                                 <div className="font-bold text-white">{parsed?.nome || "—"} {parsed?.sobrenome || ""}</div>
                                 <div className="text-xs text-gray-500">{parsed?.email || "—"}</div>
                                 <div className="text-[10px] text-gray-600">{parsed?.cpf} • {parsed?.telefone}</div>
                              </td>
                               <td className="px-5 py-4">
                                  <div className="font-bold text-white text-xs uppercase">{parsed?.booking?.car?.carCategorySample || parsed?.booking?.car?.carCategoryName || "—"}</div>
                                  <div className="text-[10px] text-gray-500">{parsed?.booking?.car?.carCategoryCode || ""}</div>
                               </td>
                               <td className="px-5 py-4">
                                  <div className="font-bold text-green-400">
                                    {res.amountInCents 
                                      ? `R$ ${(res.amountInCents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` 
                                      : <span className="text-gray-600 text-xs">—</span>}
                                  </div>
                                  <div className="text-[10px] text-gray-600">
                                    {parsed?.booking?.days ? `${parsed.booking.days} dias` : ''}
                                  </div>
                               </td>
                              <td className="px-5 py-4">
                                 {changingStatus === res.id ? (
                                    <div className="space-y-1">
                                       {["CONFIRMED_PREPAID", "CONFIRMED_NON_PREPAID", "PENDING_PIX", "CANCELLED"].map(s => (
                                          <button key={s} onClick={() => handleChangeStatus(res.id, s)} className={`block w-full text-left px-2 py-1 rounded text-[10px] font-bold ${STATUS_COLORS[s] || "bg-gray-700 text-gray-300"} hover:opacity-80`}>
                                             {STATUS_LABELS[s]}
                                          </button>
                                       ))}
                                       <button onClick={() => setChangingStatus(null)} className="text-[10px] text-gray-500 hover:text-gray-300 w-full text-left px-2">Cancelar</button>
                                    </div>
                                 ) : (
                                    <button onClick={() => setChangingStatus(res.id)} className={`text-[10px] font-bold uppercase px-2.5 py-1.5 rounded border ${STATUS_COLORS[res.status] || "bg-gray-700 text-gray-300 border-gray-600"} hover:opacity-80 transition-opacity cursor-pointer`}>
                                       {STATUS_LABELS[res.status] || res.status}
                                    </button>
                                 )}
                              </td>
                              <td className="px-5 py-4 text-xs text-gray-500">
                                 {new Date(res.createdAt).toLocaleDateString("pt-BR")}
                                 <br />
                                 <span className="text-[10px]">{new Date(res.createdAt).toLocaleTimeString("pt-BR")}</span>
                              </td>
                              <td className="px-5 py-4 text-right">
                               <div className="flex justify-end gap-2">
                                  <button onClick={() => setExpandedRow(isExpanded ? null : res.id)} className="p-1.5 rounded-lg bg-gray-800 hover:bg-blue-900/50 text-gray-400 hover:text-blue-400 transition-colors" title="Detalhes do Cliente">
                                     <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                                  </button>
                                  <button onClick={() => setCancelModal({ id: res.id, resNumber: res.resNumber || res.id })} className="p-1.5 rounded-lg bg-gray-800 hover:bg-red-900/50 text-gray-400 hover:text-red-400 transition-colors" title="Cancelar reserva">
                                     <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                                  </button>
                               </div>
                              </td>
                              </tr>
                              {isExpanded && (
                               <tr className="bg-gray-800/40 border-b border-gray-800">
                                  <td colSpan={7} className="px-5 py-4">
                                     <div className="flex flex-wrap gap-4 text-sm">
                                        {/* Dados do Cliente */}
                                        <div className="bg-gray-900 rounded-lg p-4 border border-gray-700/50 flex-1 min-w-[200px]">
                                           <p className="text-[10px] text-gray-500 font-bold uppercase mb-2">Dados do Cliente</p>
                                           <p className="text-gray-300"><strong>Nome:</strong> {parsed?.nome || "—"} {parsed?.sobrenome || ""}</p>
                                           <p className="text-gray-300"><strong>E-mail:</strong> {parsed?.email || "—"}</p>
                                           <p className="text-gray-300"><strong>CPF:</strong> {parsed?.cpf || "—"}</p>
                                           <p className="text-gray-300"><strong>Telefone:</strong> {parsed?.telefone || "—"}</p>
                                        </div>
                                        {/* Veículo e Período */}
                                        <div className="bg-gray-900 rounded-lg p-4 border border-gray-700/50 flex-1 min-w-[200px]">
                                           <p className="text-[10px] text-gray-500 font-bold uppercase mb-2">Veículo e Período</p>
                                           <p className="text-gray-300"><strong>Categoria:</strong> {parsed?.booking?.car?.carCategoryCode || parsed?.carCategory || "—"}</p>
                                           <p className="text-gray-300"><strong>Veículo:</strong> {parsed?.booking?.car?.carCategorySample || parsed?.booking?.car?.carCategoryName || "—"}</p>
                                           <p className="text-gray-300"><strong>Rate ID:</strong> <span className="font-mono text-xs text-gray-500">{parsed?.booking?.car?.rateId || "—"}</span></p>
                                           <div className="border-t border-gray-700/50 my-2"></div>
                                           <p className="text-gray-300"><strong>Retirada:</strong> {parsed?.booking?.pickupStation || "—"} — {parsed?.booking?.pickupDate ? `${parsed.booking.pickupDate.slice(6,8)}/${parsed.booking.pickupDate.slice(4,6)}/${parsed.booking.pickupDate.slice(0,4)}` : "—"} {parsed?.booking?.pickupTime ? `${parsed.booking.pickupTime.slice(0,2)}:${parsed.booking.pickupTime.slice(2)}` : ""}</p>
                                           <p className="text-gray-300"><strong>Devolução:</strong> {parsed?.booking?.returnStation || parsed?.booking?.pickupStation || "—"} — {parsed?.booking?.returnDate ? `${parsed.booking.returnDate.slice(6,8)}/${parsed.booking.returnDate.slice(4,6)}/${parsed.booking.returnDate.slice(0,4)}` : "—"} {parsed?.booking?.returnTime ? `${parsed.booking.returnTime.slice(0,2)}:${parsed.booking.returnTime.slice(2)}` : ""}</p>
                                           <p className="text-gray-300"><strong>Dias:</strong> {parsed?.booking?.days || "—"}</p>
                                           <p className="text-gray-300"><strong>País:</strong> {parsed?.booking?.country || "BR"}</p>
                                        </div>
                                        {/* Valores */}
                                        <div className="bg-gray-900 rounded-lg p-4 border border-gray-700/50 flex-1 min-w-[200px]">
                                           <p className="text-[10px] text-gray-500 font-bold uppercase mb-2">Valores e Pagamento</p>
                                           <p className="text-gray-300"><strong>Total EUR:</strong> {parsed?.booking?.car?.totalRateEstimate ? `€ ${parseFloat(parsed.booking.car.totalRateEstimate).toFixed(2)}` : "—"}</p>
                                           <p className="text-gray-300"><strong>Total BRL:</strong> {res.amountInCents ? `R$ ${(res.amountInCents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : parsed?.booking?.car?.totalRateInBookingCurrency ? `R$ ${parseFloat(parsed.booking.car.totalRateInBookingCurrency).toFixed(2)}` : "—"}</p>
                                           <p className="text-gray-300"><strong>Câmbio:</strong> {parsed?.booking?.car?.exchangeRate ? `1 EUR = ${parseFloat(parsed.booking.car.exchangeRate).toFixed(4)} BRL` : "—"}</p>
                                           <div className="border-t border-gray-700/50 my-2"></div>
                                           <p className="text-gray-300"><strong>Método:</strong> <span className={`text-xs font-bold px-2 py-0.5 rounded ${res.status === 'CONFIRMED_PREPAID' ? 'bg-green-500/20 text-green-400' : res.status === 'PENDING_PIX' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-blue-500/20 text-blue-300'}`}>{STATUS_LABELS[res.status] || res.status}</span></p>
                                           {parsed?.contractID && <p className="text-gray-300 mt-1"><strong>ContractID:</strong> <span className="font-mono text-xs text-orange-400">{parsed.contractID}</span></p>}
                                           <p className="text-gray-300"><strong>Merchant Order:</strong> <span className="font-mono text-[10px] text-gray-500">{res.merchantOrderId || "—"}</span></p>
                                        </div>
                                        {/* Fidelidade, Voo e Extras */}
                                        <div className="bg-gray-900 rounded-lg p-4 border border-gray-700/50 flex-1 min-w-[200px]">
                                           <p className="text-[10px] text-gray-500 font-bold uppercase mb-2">Fidelidade, Voo e Extras</p>
                                           <p className="text-gray-300">
                                              <strong>Programa:</strong> {parsed?.loyaltyProgramId || "N/A"} 
                                              {parsed?.loyaltyId && ` - ${parsed?.loyaltyId}`}
                                           </p>
                                           <p className="text-gray-300 flex items-center gap-2">
                                              <strong>Voo:</strong> {parsed?.flightNumber || "N/A"}
                                              {parsed?.flightNumber && (
                                                 <a href={`https://www.google.com/search?q=voo+${parsed.flightNumber}`} target="_blank" rel="noreferrer" className="text-xs bg-blue-600 hover:bg-blue-500 text-white px-2 py-0.5 rounded inline-flex items-center gap-1 transition-colors">
                                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                                                    Consultar
                                                 </a>
                                              )}
                                           </p>
                                           <div className="border-t border-gray-700/50 my-2"></div>
                                           <p className="text-[10px] text-gray-500 font-bold uppercase mb-1">Extras Selecionados</p>
                                           {parsed?.booking?.extras && Object.keys(parsed.booking.extras).filter((k: string) => parsed.booking.extras[k] > 0).length > 0 ? (
                                              <div className="flex flex-wrap gap-1">
                                                 {Object.entries(parsed.booking.extras).filter(([, v]: any) => v > 0).map(([code, qty]: any) => (
                                                    <span key={code} className="bg-gray-800 text-gray-300 text-[10px] font-bold px-2 py-1 rounded">{code} x{qty}</span>
                                                 ))}
                                              </div>
                                           ) : (
                                              <p className="text-gray-500 text-xs italic">Nenhum extra selecionado</p>
                                           )}

                                           {/* Acessórios / Equipment */}
                                           {parsed?.booking?.xrsEquipment && parsed.booking.xrsEquipment.length > 0 && (
                                              <>
                                                 <div className="border-t border-gray-700/50 my-2"></div>
                                                 <p className="text-[10px] text-[#e67e00] font-bold uppercase mb-1">Acessórios</p>
                                                 <div className="flex flex-wrap gap-1">
                                                    {parsed.booking.xrsEquipment.map((eq: any) => (
                                                       <span key={eq.code} className="bg-orange-900/40 text-orange-300 text-[10px] font-bold px-2 py-1 rounded">
                                                          {eq.icon || '📦'} {eq.name || eq.code} x{eq.qty}
                                                          {eq.priceBRL > 0 && ` (R$${parseFloat(eq.priceBRL).toFixed(2)}/dia)`}
                                                       </span>
                                                    ))}
                                                 </div>
                                              </>
                                           )}
                                        </div>
                                     </div>
                                  </td>
                               </tr>
                              )}
                           </Fragment>
                        );
                     })}
                  </tbody>
               </table>
            </div>
         </div>
      </div>
   );
}
