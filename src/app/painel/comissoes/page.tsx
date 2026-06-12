"use client";

import { useState, useEffect, useCallback } from "react";

export default function PainelComissoes() {
   const [data, setData] = useState<any>(null);
   const [loading, setLoading] = useState(true);
   const [error, setError] = useState("");
   
   const [startDate, setStartDate] = useState("");
   const [endDate, setEndDate] = useState("");
   
   const [rateInput, setRateInput] = useState("");
   const [savingRate, setSavingRate] = useState(false);

   const fetchReport = useCallback(() => {
      setLoading(true);
      setError("");
      const params = new URLSearchParams();
      if (startDate) params.set("startDate", startDate);
      if (endDate) params.set("endDate", endDate);
      
      fetch(`/api/admin/comissoes?${params}`)
         .then(res => res.json())
         .then(d => {
            if (d.error) {
               setError(d.error);
            } else {
               setData(d);
               setRateInput(d.rate.toString());
            }
            setLoading(false);
         })
         .catch((e) => { setError("Erro de conexão com o servidor"); setLoading(false); });
   }, [startDate, endDate]);

   useEffect(() => {
      fetchReport();
   }, [fetchReport]);

   const handleSaveRate = async (e: React.FormEvent) => {
      e.preventDefault();
      setSavingRate(true);
      try {
         const res = await fetch('/api/admin/config', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ key: 'COMMISSION_RATE', value: rateInput })
         });
         if (res.ok) {
            fetchReport(); // recarregar com a nova taxa
         } else {
            alert("Erro ao salvar taxa");
         }
      } catch (error) {
         alert("Erro de conexão");
      } finally {
         setSavingRate(false);
      }
   };

   return (
      <div className="space-y-8">
         {/* Header */}
         <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
            <div>
               <h1 className="text-2xl font-black text-white flex items-center gap-2">💰 Relatório de Comissões</h1>
               <p className="text-gray-400 text-sm mt-1">Acompanhe as vendas e comissões geradas (reservas canceladas não são contabilizadas)</p>
            </div>
         </div>

         {/* Controles: Taxa e Filtros */}
         <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
               <h2 className="text-sm font-bold text-white mb-3">Configuração de Taxa (%)</h2>
               <form onSubmit={handleSaveRate} className="flex gap-3">
                  <input
                     type="number"
                     step="0.01"
                     value={rateInput}
                     onChange={e => setRateInput(e.target.value)}
                     placeholder="Ex: 10.5"
                     className="bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white text-sm focus:outline-none focus:border-green-600 flex-1"
                  />
                  <button type="submit" disabled={savingRate} className="bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white font-bold px-5 py-2 rounded-lg text-sm transition-colors">
                     {savingRate ? "Salvando..." : "Salvar Taxa"}
                  </button>
               </form>
            </div>

            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
               <h2 className="text-sm font-bold text-white mb-3">Período de Vendas</h2>
               <div className="flex gap-3">
                  <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white text-sm focus:outline-none focus:border-green-600 flex-1" />
                  <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white text-sm focus:outline-none focus:border-green-600 flex-1" />
               </div>
            </div>
         </div>

         {error && (
            <div className="bg-red-500/20 border border-red-500/50 p-4 rounded-xl text-red-400">
               {error}
            </div>
         )}

         {loading && !data ? (
            <div className="flex items-center justify-center h-64">
               <div className="w-10 h-10 border-4 border-green-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
         ) : data && (
            <>
               {/* Resumo */}
               <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-gradient-to-br from-indigo-600 to-indigo-800 rounded-xl p-5 shadow-lg relative overflow-hidden">
                     <div className="absolute top-3 right-3 text-2xl opacity-30">💵</div>
                     <p className="text-white/70 text-xs font-bold uppercase tracking-wide">Total em Vendas</p>
                     <p className="text-3xl font-black text-white mt-2">
                        {data.totalVendas.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                     </p>
                  </div>
                  <div className="bg-gradient-to-br from-emerald-600 to-emerald-800 rounded-xl p-5 shadow-lg relative overflow-hidden">
                     <div className="absolute top-3 right-3 text-2xl opacity-30">🤑</div>
                     <p className="text-white/70 text-xs font-bold uppercase tracking-wide">Total de Comissões</p>
                     <p className="text-3xl font-black text-white mt-2">
                        {data.totalComissao.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                     </p>
                  </div>
                  <div className="bg-gradient-to-br from-gray-700 to-gray-900 rounded-xl p-5 shadow-lg relative overflow-hidden">
                     <div className="absolute top-3 right-3 text-2xl opacity-30">💳</div>
                     <p className="text-white/70 text-xs font-bold uppercase tracking-wide">Comissão: Cartão ({data.grouped.CREDIT_CARD.count})</p>
                     <p className="text-xl font-black text-emerald-400 mt-2">
                        {data.grouped.CREDIT_CARD.comissao.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                     </p>
                  </div>
                  <div className="bg-gradient-to-br from-gray-700 to-gray-900 rounded-xl p-5 shadow-lg relative overflow-hidden">
                     <div className="absolute top-3 right-3 text-2xl opacity-30">🏢</div>
                     <p className="text-white/70 text-xs font-bold uppercase tracking-wide">Comissão: PIX/Balcão ({data.grouped.PIX.count + data.grouped.BALCAO.count})</p>
                     <p className="text-xl font-black text-blue-400 mt-2">
                        {(data.grouped.PIX.comissao + data.grouped.BALCAO.comissao).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                     </p>
                  </div>
               </div>

               {/* Table */}
               <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
                  <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
                     <h3 className="font-bold text-white text-sm">Detalhamento de Reservas Válidas</h3>
                     <span className="text-xs text-gray-400">{data.reservations.length} reservas encontradas</span>
                  </div>
                  <div className="overflow-x-auto">
                     <table className="w-full text-sm text-left">
                        <thead className="bg-gray-800/50 border-b border-gray-700">
                           <tr>
                              <th className="px-5 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Reserva / Data</th>
                              <th className="px-5 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Cliente</th>
                              <th className="px-5 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider text-right">Valor Venda</th>
                              <th className="px-5 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Tipo Pagamento</th>
                              <th className="px-5 py-4 text-[10px] font-bold text-emerald-400 uppercase tracking-wider text-right">Comissão ({data.rate}%)</th>
                           </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-800/50">
                           {data.reservations.length === 0 ? (
                              <tr><td colSpan={5} className="text-center py-10 text-gray-500">Nenhuma reserva encontrada para o período.</td></tr>
                           ) : (
                              data.reservations.map((res: any) => {
                                 let parsed: any = {};
                                 try { parsed = JSON.parse(res.customerData); } catch(e){}
                                 return (
                                    <tr key={res.id} className="hover:bg-gray-800/30 transition-colors group">
                                       <td className="px-5 py-4">
                                          <div className="font-black text-white text-sm">{res.resNumber || "—"}</div>
                                          <div className="text-[10px] text-gray-500">{new Date(res.createdAt).toLocaleDateString("pt-BR")}</div>
                                       </td>
                                       <td className="px-5 py-4">
                                          <div className="font-bold text-white">{parsed?.nome} {parsed?.sobrenome}</div>
                                          <div className="text-[10px] text-gray-500">{parsed?.cpf}</div>
                                       </td>
                                       <td className="px-5 py-4 text-right">
                                          <div className="font-bold text-gray-300">
                                             {res.valorCalculado.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                          </div>
                                       </td>
                                       <td className="px-5 py-4">
                                          <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded ${
                                             res.tipoPagamento === 'CREDIT_CARD' ? 'bg-emerald-500/20 text-emerald-400' :
                                             res.tipoPagamento === 'PIX' ? 'bg-yellow-500/20 text-yellow-400' :
                                             'bg-blue-500/20 text-blue-400'
                                          }`}>
                                             {res.tipoPagamento === 'CREDIT_CARD' ? 'Cartão' : res.tipoPagamento === 'PIX' ? 'PIX' : 'Balcão'}
                                          </span>
                                       </td>
                                       <td className="px-5 py-4 text-right">
                                          <div className="font-bold text-emerald-400">
                                             {res.comissaoCalculada.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                          </div>
                                       </td>
                                    </tr>
                                 );
                              })
                           )}
                        </tbody>
                     </table>
                  </div>
               </div>
            </>
         )}
      </div>
   );
}
