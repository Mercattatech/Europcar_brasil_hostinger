"use client";

import { useState, useEffect } from "react";

const OP_STATUS_CONFIG: Record<string, { label: string; description: string; color: string }> = {
   R:  { label: "R",  description: "On Request",       color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/40" },
   S:  { label: "S",  description: "Sold",             color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/40" },
   CF: { label: "CF", description: "Confirmed",        color: "bg-blue-500/20 text-blue-400 border-blue-500/40" },
   CC: { label: "CC", description: "Cancelled",        color: "bg-red-500/20 text-red-400 border-red-500/40" },
   CP: { label: "CP", description: "Cancelled Prepaid", color: "bg-orange-500/20 text-orange-400 border-orange-500/40" },
   CO: { label: "CO", description: "Checked Out",      color: "bg-purple-500/20 text-purple-400 border-purple-500/40" },
   TD: { label: "TD", description: "Turn Down",        color: "bg-gray-600/30 text-gray-400 border-gray-500/40" },
   NS: { label: "NS", description: "No Show",          color: "bg-gray-500/20 text-gray-500 border-gray-500/40" },
};

const STATUS_LABELS: Record<string, string> = {
   CONFIRMED_PREPAID: "Pago Online",
   PENDING_PIX: "PIX Pendente",
   CONFIRMED_NON_PREPAID: "Pagar no Balcão",
   CANCELLED: "Cancelada",
};

function formatDateBR(dateStr?: string): string {
   if (!dateStr || dateStr.length < 8) return "—";
   return `${dateStr.slice(6, 8)}/${dateStr.slice(4, 6)}/${dateStr.slice(0, 4)}`;
}

function formatTimeBR(timeStr?: string): string {
   if (!timeStr || timeStr.length < 4) return "";
   return `${timeStr.slice(0, 2)}:${timeStr.slice(2)}`;
}

type ReportTab = "operational" | "financial";

export default function PainelRelatorios() {
   const [activeTab, setActiveTab] = useState<ReportTab>("operational");
   const [reservations, setReservations] = useState<any[]>([]);
   const [loading, setLoading] = useState(true);
   const [exporting, setExporting] = useState(false);

   // Filters
   const [startDate, setStartDate] = useState("");
   const [endDate, setEndDate] = useState("");
   const [opStatusFilter, setOpStatusFilter] = useState("ALL");
   const [paymentStatusFilter, setPaymentStatusFilter] = useState("ALL");

   const fetchReservations = async () => {
      setLoading(true);
      try {
         const params = new URLSearchParams();
         if (opStatusFilter !== "ALL") params.set("operationalStatus", opStatusFilter);
         if (paymentStatusFilter !== "ALL") params.set("status", paymentStatusFilter);
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

   useEffect(() => {
      fetchReservations();
   }, [opStatusFilter, paymentStatusFilter, startDate, endDate]);

   const handleExportCSV = async () => {
      setExporting(true);
      try {
         const params = new URLSearchParams();
         params.set("type", activeTab);
         if (opStatusFilter !== "ALL") params.set("operationalStatus", opStatusFilter);
         if (paymentStatusFilter !== "ALL") params.set("status", paymentStatusFilter);
         if (startDate) params.set("startDate", startDate);
         if (endDate) params.set("endDate", endDate);

         const res = await fetch(`/api/admin/reservations/export?${params}`);
         if (!res.ok) throw new Error("Export failed");

         const blob = await res.blob();
         const url = URL.createObjectURL(blob);
         const a = document.createElement("a");
         a.href = url;
         a.download = activeTab === "financial"
            ? `relatorio_financeiro_${new Date().toISOString().slice(0, 10)}.csv`
            : `relatorio_operacional_${new Date().toISOString().slice(0, 10)}.csv`;
         document.body.appendChild(a);
         a.click();
         a.remove();
         URL.revokeObjectURL(url);
      } catch (e) {
         console.error(e);
         alert("Erro ao exportar CSV");
      } finally {
         setExporting(false);
      }
   };

   // Parsed data for preview
   const parsedReservations = reservations.map(res => {
      let parsed: any = {};
      try {
         parsed = typeof res.customerData === "string" ? JSON.parse(res.customerData) : res.customerData;
      } catch (e) {}
      return { ...res, parsed };
   });

   return (
      <div className="space-y-6">
         {/* Header */}
         <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
               <h1 className="text-2xl font-black text-white">Relatórios</h1>
               <p className="text-gray-400 text-sm mt-1">Exporte dados operacionais e financeiros das reservas</p>
            </div>
            <button
               onClick={handleExportCSV}
               disabled={exporting || loading || reservations.length === 0}
               className="bg-green-600 hover:bg-green-700 disabled:bg-gray-700 disabled:text-gray-500 text-white font-bold px-6 py-3 rounded-xl text-sm transition-all flex items-center gap-2 shadow-lg shadow-green-900/30 hover:shadow-green-900/50"
            >
               {exporting ? (
                  <>
                     <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                     Exportando...
                  </>
               ) : (
                  <>
                     <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                     </svg>
                     Exportar CSV ({reservations.length} registros)
                  </>
               )}
            </button>
         </div>

         {/* Tab Switcher */}
         <div className="flex gap-1 bg-gray-900 rounded-xl p-1 border border-gray-800 w-fit">
            <button
               onClick={() => setActiveTab("operational")}
               className={`px-5 py-2.5 rounded-lg text-sm font-bold transition-all ${
                  activeTab === "operational"
                     ? "bg-green-600 text-white shadow-lg"
                     : "text-gray-400 hover:text-white hover:bg-gray-800"
               }`}
            >
               📋 Relatório Operacional
            </button>
            <button
               onClick={() => setActiveTab("financial")}
               className={`px-5 py-2.5 rounded-lg text-sm font-bold transition-all ${
                  activeTab === "financial"
                     ? "bg-green-600 text-white shadow-lg"
                     : "text-gray-400 hover:text-white hover:bg-gray-800"
               }`}
            >
               💰 Relatório Financeiro
            </button>
         </div>

         {/* Filters */}
         <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-4">
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Filtros</p>
            <div className="flex flex-wrap gap-4">
               {/* Date range */}
               <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Data Início</label>
                  <input
                     type="date"
                     value={startDate}
                     onChange={e => setStartDate(e.target.value)}
                     className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-green-600 transition-colors [color-scheme:dark]"
                  />
               </div>
               <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Data Fim</label>
                  <input
                     type="date"
                     value={endDate}
                     onChange={e => setEndDate(e.target.value)}
                     className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-green-600 transition-colors [color-scheme:dark]"
                  />
               </div>
               {/* Operational Status */}
               <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Status Operacional</label>
                  <select
                     value={opStatusFilter}
                     onChange={e => setOpStatusFilter(e.target.value)}
                     className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-green-600 transition-colors appearance-none min-w-[180px]"
                  >
                     <option value="ALL">Todos</option>
                     <optgroup label="Momentâneos">
                        <option value="R">R — On Request</option>
                        <option value="S">S — Sold</option>
                        <option value="CF">CF — Confirmed</option>
                     </optgroup>
                     <optgroup label="Concluídos">
                        <option value="CC">CC — Cancelled</option>
                        <option value="CP">CP — Cancelled Prepaid</option>
                        <option value="CO">CO — Checked Out</option>
                        <option value="TD">TD — Turn Down</option>
                        <option value="NS">NS — No Show</option>
                     </optgroup>
                  </select>
               </div>
               {/* Payment Status */}
               <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Status Pagamento</label>
                  <select
                     value={paymentStatusFilter}
                     onChange={e => setPaymentStatusFilter(e.target.value)}
                     className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-green-600 transition-colors appearance-none min-w-[180px]"
                  >
                     <option value="ALL">Todos</option>
                     <option value="CONFIRMED_PREPAID">Pago Online</option>
                     <option value="PENDING_PIX">PIX Pendente</option>
                     <option value="CONFIRMED_NON_PREPAID">Pagar no Balcão</option>
                     <option value="CANCELLED">Cancelada</option>
                  </select>
               </div>
               {/* Clear */}
               {(startDate || endDate || opStatusFilter !== "ALL" || paymentStatusFilter !== "ALL") && (
                  <div className="flex items-end">
                     <button
                        onClick={() => { setStartDate(""); setEndDate(""); setOpStatusFilter("ALL"); setPaymentStatusFilter("ALL"); }}
                        className="bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white px-4 py-2 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5"
                     >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                        Limpar Filtros
                     </button>
                  </div>
               )}
            </div>
         </div>

         {/* Stats Summary */}
         <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
               <p className="text-[10px] font-bold text-gray-500 uppercase">Total Reservas</p>
               <p className="text-2xl font-black text-white mt-1">{reservations.length}</p>
            </div>
            <div className="bg-gray-900 border border-green-900/30 rounded-xl p-4">
               <p className="text-[10px] font-bold text-green-500 uppercase">Valor Total (BRL)</p>
               <p className="text-2xl font-black text-green-400 mt-1">
                  R$ {(reservations.reduce((sum, r) => sum + (r.amountInCents || 0), 0) / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
               </p>
            </div>
            <div className="bg-gray-900 border border-emerald-900/30 rounded-xl p-4">
               <p className="text-[10px] font-bold text-emerald-500 uppercase">Ativas (R/S/CF)</p>
               <p className="text-2xl font-black text-emerald-400 mt-1">
                  {reservations.filter(r => ["R", "S", "CF"].includes(r.operationalStatus || "R")).length}
               </p>
            </div>
            <div className="bg-gray-900 border border-purple-900/30 rounded-xl p-4">
               <p className="text-[10px] font-bold text-purple-500 uppercase">Checked Out (CO)</p>
               <p className="text-2xl font-black text-purple-400 mt-1">
                  {reservations.filter(r => r.operationalStatus === "CO").length}
               </p>
            </div>
         </div>

         {/* Data Preview Table */}
         <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-800 flex items-center justify-between">
               <p className="text-xs font-bold text-gray-400">
                  {activeTab === "operational" ? "📋 Preview — Relatório Operacional" : "💰 Preview — Relatório Financeiro"}
               </p>
               <p className="text-[10px] text-gray-600">{reservations.length} registros</p>
            </div>
            <div className="overflow-x-auto">
               {activeTab === "operational" ? (
                  /* OPERATIONAL TABLE */
                  <table className="w-full text-sm text-left min-w-[900px]">
                     <thead className="bg-gray-800/50 border-b border-gray-700">
                        <tr>
                           <th className="px-4 py-3 text-[10px] font-bold text-gray-400 uppercase">Código</th>
                           <th className="px-4 py-3 text-[10px] font-bold text-gray-400 uppercase">Status Op.</th>
                           <th className="px-4 py-3 text-[10px] font-bold text-gray-400 uppercase">Pagamento</th>
                           <th className="px-4 py-3 text-[10px] font-bold text-gray-400 uppercase">Data Criação</th>
                           <th className="px-4 py-3 text-[10px] font-bold text-gray-400 uppercase">Retirada</th>
                           <th className="px-4 py-3 text-[10px] font-bold text-gray-400 uppercase">Devolução</th>
                           <th className="px-4 py-3 text-[10px] font-bold text-gray-400 uppercase">Cliente</th>
                           <th className="px-4 py-3 text-[10px] font-bold text-gray-400 uppercase">Veículo</th>
                           <th className="px-4 py-3 text-[10px] font-bold text-gray-400 uppercase">Valor</th>
                        </tr>
                     </thead>
                     <tbody className="divide-y divide-gray-800/50">
                        {loading && (
                           <tr><td colSpan={9} className="text-center py-10">
                              <div className="w-6 h-6 border-3 border-green-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
                           </td></tr>
                        )}
                        {!loading && parsedReservations.length === 0 && (
                           <tr><td colSpan={9} className="text-center py-10 text-gray-500">Nenhum registro encontrado.</td></tr>
                        )}
                        {!loading && parsedReservations.map(({ parsed, ...res }) => {
                           const opStatus = res.operationalStatus || "R";
                           const opConfig = OP_STATUS_CONFIG[opStatus] || OP_STATUS_CONFIG.R;
                           const booking = parsed?.booking || {};
                           return (
                              <tr key={res.id} className="hover:bg-gray-800/30 transition-colors">
                                 <td className="px-4 py-3 font-mono font-bold text-white text-xs">{res.resNumber || "—"}</td>
                                 <td className="px-4 py-3">
                                    <span className={`text-[10px] font-bold px-2 py-1 rounded border ${opConfig.color}`}>
                                       {opConfig.label} — {opConfig.description}
                                    </span>
                                 </td>
                                 <td className="px-4 py-3 text-[10px] font-bold text-gray-400">{STATUS_LABELS[res.status] || res.status}</td>
                                 <td className="px-4 py-3 text-xs text-gray-400">
                                    {new Date(res.createdAt).toLocaleDateString("pt-BR")}{" "}
                                    <span className="text-gray-600">{new Date(res.createdAt).toLocaleTimeString("pt-BR")}</span>
                                 </td>
                                 <td className="px-4 py-3 text-xs text-gray-400">
                                    {formatDateBR(booking?.pickupDate)} {formatTimeBR(booking?.pickupTime)}
                                 </td>
                                 <td className="px-4 py-3 text-xs text-gray-400">
                                    {formatDateBR(booking?.returnDate)} {formatTimeBR(booking?.returnTime)}
                                 </td>
                                 <td className="px-4 py-3">
                                    <div className="text-xs text-white font-bold">{parsed?.nome || "—"} {parsed?.sobrenome || ""}</div>
                                    <div className="text-[10px] text-gray-600">{parsed?.email || ""}</div>
                                 </td>
                                 <td className="px-4 py-3 text-xs text-gray-400">
                                    {booking?.car?.carCategorySample || booking?.car?.carCategoryName || "—"}
                                 </td>
                                 <td className="px-4 py-3 text-xs font-bold text-green-400">
                                    {res.amountInCents
                                       ? `R$ ${(res.amountInCents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
                                       : "—"}
                                 </td>
                              </tr>
                           );
                        })}
                     </tbody>
                  </table>
               ) : (
                  /* FINANCIAL TABLE */
                  <table className="w-full text-sm text-left min-w-[1400px]">
                     <thead className="bg-gray-800/50 border-b border-gray-700">
                        <tr>
                           <th className="px-3 py-3 text-[10px] font-bold text-gray-400 uppercase">Código</th>
                           <th className="px-3 py-3 text-[10px] font-bold text-gray-400 uppercase">Reserva</th>
                           <th className="px-3 py-3 text-[10px] font-bold text-gray-400 uppercase">Retirada</th>
                           <th className="px-3 py-3 text-[10px] font-bold text-gray-400 uppercase">Devolução</th>
                           <th className="px-3 py-3 text-[10px] font-bold text-gray-400 uppercase">Net (EUR)</th>
                           <th className="px-3 py-3 text-[10px] font-bold text-gray-400 uppercase">Total (BRL)</th>
                           <th className="px-3 py-3 text-[10px] font-bold text-gray-400 uppercase">Pagamento</th>
                           <th className="px-3 py-3 text-[10px] font-bold text-gray-400 uppercase">Câmbio</th>
                           <th className="px-3 py-3 text-[10px] font-bold text-gray-400 uppercase">Estação Ret.</th>
                           <th className="px-3 py-3 text-[10px] font-bold text-gray-400 uppercase">Estação Dev.</th>
                           <th className="px-3 py-3 text-[10px] font-bold text-gray-400 uppercase">Veículo</th>
                           <th className="px-3 py-3 text-[10px] font-bold text-gray-400 uppercase">Cliente</th>
                           <th className="px-3 py-3 text-[10px] font-bold text-gray-400 uppercase">Desconto/CID</th>
                           <th className="px-3 py-3 text-[10px] font-bold text-gray-400 uppercase">Status Op.</th>
                        </tr>
                     </thead>
                     <tbody className="divide-y divide-gray-800/50">
                        {loading && (
                           <tr><td colSpan={14} className="text-center py-10">
                              <div className="w-6 h-6 border-3 border-green-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
                           </td></tr>
                        )}
                        {!loading && parsedReservations.length === 0 && (
                           <tr><td colSpan={14} className="text-center py-10 text-gray-500">Nenhum registro encontrado.</td></tr>
                        )}
                        {!loading && parsedReservations.map(({ parsed, ...res }) => {
                           const opStatus = res.operationalStatus || "R";
                           const opConfig = OP_STATUS_CONFIG[opStatus] || OP_STATUS_CONFIG.R;
                           const booking = parsed?.booking || {};
                           const car = booking?.car || {};
                           return (
                              <tr key={res.id} className="hover:bg-gray-800/30 transition-colors">
                                 <td className="px-3 py-3 font-mono font-bold text-white text-[11px]">{res.resNumber || "—"}</td>
                                 <td className="px-3 py-3 text-[10px] text-gray-400">
                                    {new Date(res.createdAt).toLocaleDateString("pt-BR")}{" "}
                                    <span className="text-gray-600">{new Date(res.createdAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>
                                 </td>
                                 <td className="px-3 py-3 text-[10px] text-gray-400">
                                    {formatDateBR(booking?.pickupDate)} {formatTimeBR(booking?.pickupTime)}
                                 </td>
                                 <td className="px-3 py-3 text-[10px] text-gray-400">
                                    {formatDateBR(booking?.returnDate)} {formatTimeBR(booking?.returnTime)}
                                 </td>
                                 <td className="px-3 py-3 text-[10px] font-bold text-blue-400">
                                    {car?.totalRateEstimate ? `€ ${parseFloat(car.totalRateEstimate).toFixed(2)}` : "—"}
                                 </td>
                                 <td className="px-3 py-3 text-[10px] font-bold text-green-400">
                                    {res.amountInCents
                                       ? `R$ ${(res.amountInCents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
                                       : car?.totalRateInBookingCurrency
                                       ? `R$ ${parseFloat(car.totalRateInBookingCurrency).toFixed(2)}`
                                       : "—"}
                                 </td>
                                 <td className="px-3 py-3 text-[10px] font-bold text-gray-400">{STATUS_LABELS[res.status] || res.status}</td>
                                 <td className="px-3 py-3 text-[10px] text-gray-500 font-mono">
                                    {car?.exchangeRate ? parseFloat(car.exchangeRate).toFixed(4) : "—"}
                                 </td>
                                 <td className="px-3 py-3 text-[10px] text-gray-400">{booking?.pickupStation || "—"}</td>
                                 <td className="px-3 py-3 text-[10px] text-gray-400">{booking?.returnStation || booking?.pickupStation || "—"}</td>
                                 <td className="px-3 py-3 text-[10px] text-gray-400">
                                    {car?.carCategorySample || car?.carCategoryName || "—"}
                                    <br /><span className="text-gray-600">{car?.carCategoryCode || ""}</span>
                                 </td>
                                 <td className="px-3 py-3">
                                    <div className="text-[10px] text-white font-bold">{parsed?.nome || "—"} {parsed?.sobrenome || ""}</div>
                                    <div className="text-[9px] text-gray-600">{parsed?.email || ""}</div>
                                    <div className="text-[9px] text-gray-600">{parsed?.cpf || ""}</div>
                                 </td>
                                 <td className="px-3 py-3 text-[10px] text-orange-400 font-mono">
                                    {parsed?.contractID || booking?.contractID || "—"}
                                 </td>
                                 <td className="px-3 py-3">
                                    <span className={`text-[9px] font-bold px-1.5 py-1 rounded border ${opConfig.color}`}>
                                       {opConfig.label}
                                    </span>
                                 </td>
                              </tr>
                           );
                        })}
                     </tbody>
                  </table>
               )}
            </div>
         </div>
      </div>
   );
}
