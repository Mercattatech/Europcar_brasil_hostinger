"use client";

import { useState, useEffect } from "react";

interface MaintenanceData {
   id?: string;
   redirectUrl: string;
   isActive: boolean;
   returnDate: string | null;
   reason: string;
}

export default function PainelManutencao() {
   const [data, setData] = useState<MaintenanceData>({
      redirectUrl: "",
      isActive: false,
      returnDate: null,
      reason: "",
   });
   const [loading, setLoading] = useState(true);
   const [saving, setSaving] = useState(false);
   const [toggling, setToggling] = useState(false);
   const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

   const showToast = (msg: string, t: "success" | "error" = "success") => {
      setToast({ message: msg, type: t });
      setTimeout(() => setToast(null), 4000);
   };

   // Carregar dados atuais
   useEffect(() => {
      fetch("/api/admin/maintenance")
         .then((res) => res.json())
         .then((config) => {
            setData({
               id: config.id || undefined,
               redirectUrl: config.redirectUrl || "",
               isActive: config.isActive || false,
               returnDate: config.returnDate
                  ? new Date(config.returnDate).toISOString().slice(0, 16)
                  : "",
               reason: config.reason || "",
            });
            setLoading(false);
         })
         .catch(() => setLoading(false));
   }, []);

   // Salvar configuração
   const handleSave = async (e: React.FormEvent) => {
      e.preventDefault();
      setSaving(true);

      try {
         const res = await fetch("/api/admin/maintenance", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
               redirectUrl: data.redirectUrl,
               isActive: data.isActive,
               returnDate: data.returnDate || null,
               reason: data.reason || null,
            }),
         });

         const result = await res.json();

         if (res.ok) {
            showToast("Configuração salva com sucesso!");
            if (result.config) {
               setData((prev) => ({ ...prev, id: result.config.id }));
            }
         } else {
            showToast(result.error || "Erro ao salvar", "error");
         }
      } catch {
         showToast("Erro de conexão", "error");
      } finally {
         setSaving(false);
      }
   };

   // Toggle ativar/desativar
   const handleToggle = async () => {
      if (!data.id && !data.redirectUrl) {
         showToast("Cadastre uma URL de redirecionamento antes de ativar.", "error");
         return;
      }

      setToggling(true);
      const newStatus = !data.isActive;

      try {
         // Se não tem ID (nunca salvou), salva primeiro
         if (!data.id) {
            const saveRes = await fetch("/api/admin/maintenance", {
               method: "POST",
               headers: { "Content-Type": "application/json" },
               body: JSON.stringify({
                  redirectUrl: data.redirectUrl,
                  isActive: newStatus,
                  returnDate: data.returnDate || null,
                  reason: data.reason || null,
               }),
            });
            const saveResult = await saveRes.json();
            if (saveRes.ok) {
               setData((prev) => ({ ...prev, isActive: newStatus, id: saveResult.config?.id }));
               showToast(newStatus ? "🚧 Modo manutenção ATIVADO!" : "✅ Site de volta ao ar!");
            } else {
               showToast(saveResult.error || "Erro ao ativar", "error");
            }
         } else {
            const res = await fetch("/api/admin/maintenance", {
               method: "PATCH",
               headers: { "Content-Type": "application/json" },
               body: JSON.stringify({ isActive: newStatus }),
            });

            if (res.ok) {
               setData((prev) => ({ ...prev, isActive: newStatus }));
               showToast(newStatus ? "🚧 Modo manutenção ATIVADO!" : "✅ Site de volta ao ar!");
            } else {
               const result = await res.json();
               showToast(result.error || "Erro ao alterar status", "error");
            }
         }
      } catch {
         showToast("Erro de conexão", "error");
      } finally {
         setToggling(false);
      }
   };

   // Formatar data para exibição
   const formatDate = (dateStr: string | null) => {
      if (!dateStr) return null;
      try {
         return new Date(dateStr).toLocaleString("pt-BR", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
         });
      } catch {
         return null;
      }
   };

   if (loading) {
      return (
         <div className="flex justify-center py-10">
            <div className="w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin"></div>
         </div>
      );
   }

   return (
      <div className="max-w-3xl space-y-6">
         {/* Toast */}
         {toast && (
            <div
               className={`fixed top-4 right-4 z-50 px-5 py-3 rounded-lg shadow-2xl font-bold text-sm transition-all ${
                  toast.type === "success"
                     ? "bg-green-600 text-white"
                     : "bg-red-600 text-white"
               }`}
            >
               {toast.message}
            </div>
         )}

         {/* Header */}
         <div className="flex items-center justify-between">
            <div>
               <h1 className="text-2xl font-black text-white flex items-center gap-3">
                  🚧 Modo Manutenção
               </h1>
               <p className="text-gray-400 text-sm mt-1">
                  Redirecione os visitantes para outra URL durante a manutenção do site
               </p>
            </div>
         </div>

         {/* Status Card */}
         <div
            className={`rounded-xl border p-5 transition-all ${
               data.isActive
                  ? "bg-red-500/10 border-red-500/30"
                  : "bg-green-500/10 border-green-500/30"
            }`}
         >
            <div className="flex items-center justify-between">
               <div className="flex items-center gap-4">
                  <div
                     className={`w-4 h-4 rounded-full ${
                        data.isActive ? "bg-red-500 animate-pulse" : "bg-green-500"
                     }`}
                  ></div>
                  <div>
                     <p className="font-bold text-white text-lg">
                        {data.isActive ? "Site em Manutenção" : "Site Online"}
                     </p>
                     <p className="text-sm text-gray-400">
                        {data.isActive
                           ? "Visitantes estão sendo redirecionados"
                           : "O site está funcionando normalmente"}
                     </p>
                  </div>
               </div>
               <button
                  onClick={handleToggle}
                  disabled={toggling}
                  className={`relative inline-flex h-8 w-16 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 disabled:opacity-50 ${
                     data.isActive
                        ? "bg-red-600 focus:ring-red-500"
                        : "bg-gray-600 focus:ring-green-500"
                  }`}
               >
                  <span
                     className={`inline-block h-6 w-6 transform rounded-full bg-white shadow-lg transition-transform ${
                        data.isActive ? "translate-x-9" : "translate-x-1"
                     }`}
                  />
               </button>
            </div>

            {/* Info de redirecionamento ativo */}
            {data.isActive && data.redirectUrl && (
               <div className="mt-4 pt-4 border-t border-red-500/20">
                  <div className="flex items-center gap-2 text-sm">
                     <span className="text-gray-400">Redirecionando para:</span>
                     <a
                        href={data.redirectUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-red-400 hover:text-red-300 font-mono text-xs underline truncate max-w-md"
                     >
                        {data.redirectUrl}
                     </a>
                  </div>
                  {data.returnDate && (
                     <div className="flex items-center gap-2 text-sm mt-2">
                        <span className="text-gray-400">Retorno programado:</span>
                        <span className="text-yellow-400 font-bold">
                           {formatDate(data.returnDate)}
                        </span>
                     </div>
                  )}
                  {data.reason && (
                     <div className="flex items-center gap-2 text-sm mt-2">
                        <span className="text-gray-400">Motivo:</span>
                        <span className="text-gray-300">{data.reason}</span>
                     </div>
                  )}
               </div>
            )}
         </div>

         {/* Formulário de Configuração */}
         <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            <h2 className="text-lg font-bold text-white mb-1">Configuração de Redirecionamento</h2>
            <p className="text-gray-500 text-xs mb-6">
               Defina a URL para onde os visitantes serão redirecionados e opcionalmente uma data de retorno
            </p>

            <form onSubmit={handleSave} className="space-y-5">
               {/* URL de redirecionamento */}
               <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase mb-2">
                     URL de Redirecionamento *
                  </label>
                  <input
                     type="url"
                     required
                     value={data.redirectUrl}
                     onChange={(e) =>
                        setData((prev) => ({ ...prev, redirectUrl: e.target.value }))
                     }
                     className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-sm text-white font-mono outline-none focus:border-green-600 transition-colors"
                     placeholder="https://exemplo.com/manutencao"
                  />
                  <p className="text-[11px] text-gray-500 mt-1.5">
                     Cole a URL completa para onde os visitantes serão redirecionados durante a manutenção
                  </p>
               </div>

               {/* Data de retorno */}
               <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase mb-2">
                     Data de Retorno Automático
                  </label>
                  <input
                     type="datetime-local"
                     value={data.returnDate || ""}
                     onChange={(e) =>
                        setData((prev) => ({ ...prev, returnDate: e.target.value || null }))
                     }
                     className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-sm text-white outline-none focus:border-green-600 transition-colors [color-scheme:dark]"
                  />
                  <p className="text-[11px] text-gray-500 mt-1.5">
                     Opcional — O site voltará ao ar automaticamente nesta data e hora
                  </p>
               </div>

               {/* Motivo */}
               <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase mb-2">
                     Motivo da Manutenção
                  </label>
                  <textarea
                     value={data.reason}
                     onChange={(e) =>
                        setData((prev) => ({ ...prev, reason: e.target.value }))
                     }
                     rows={2}
                     className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-sm text-white outline-none focus:border-green-600 transition-colors resize-none"
                     placeholder="Ex: Atualização de sistema, manutenção programada..."
                  />
                  <p className="text-[11px] text-gray-500 mt-1.5">
                     Opcional — Para documentação interna
                  </p>
               </div>

               {/* Alertas */}
               {data.isActive && (
                  <div className="flex items-start gap-3 bg-red-500/10 border border-red-500/20 rounded-lg p-4">
                     <svg
                        className="w-5 h-5 text-red-400 shrink-0 mt-0.5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                     >
                        <path
                           strokeLinecap="round"
                           strokeLinejoin="round"
                           strokeWidth="2"
                           d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
                        ></path>
                     </svg>
                     <div>
                        <p className="text-sm font-bold text-red-300">Modo manutenção está ATIVO</p>
                        <p className="text-xs text-red-400/80 mt-0.5">
                           Os visitantes do site estão sendo redirecionados. As alterações abaixo serão
                           aplicadas ao salvar.
                        </p>
                     </div>
                  </div>
               )}

               {!data.isActive && data.redirectUrl && (
                  <div className="flex items-start gap-3 bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
                     <svg
                        className="w-5 h-5 text-blue-400 shrink-0 mt-0.5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                     >
                        <path
                           strokeLinecap="round"
                           strokeLinejoin="round"
                           strokeWidth="2"
                           d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                        ></path>
                     </svg>
                     <p className="text-sm text-blue-300">
                        A configuração está salva mas o modo manutenção está{" "}
                        <strong>desativado</strong>. Use o toggle acima para ativar.
                     </p>
                  </div>
               )}

               {/* Botão Salvar */}
               <div className="pt-4 flex items-center justify-between border-t border-gray-800">
                  <p className="text-[11px] text-gray-600">
                     {data.id ? "Última config salva encontrada" : "Nenhuma configuração salva"}
                  </p>
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

         {/* Informações Adicionais */}
         <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-5">
            <h3 className="text-sm font-bold text-gray-300 mb-3">ℹ️ Como funciona</h3>
            <ul className="text-xs text-gray-500 space-y-2">
               <li className="flex items-start gap-2">
                  <span className="text-green-500 mt-0.5">•</span>
                  <span>
                     Quando ativado, todos os visitantes que acessarem o site serão automaticamente
                     redirecionados para a URL cadastrada.
                  </span>
               </li>
               <li className="flex items-start gap-2">
                  <span className="text-green-500 mt-0.5">•</span>
                  <span>
                     O <strong className="text-gray-300">painel administrativo</strong> (/painel)
                     continua acessível mesmo durante a manutenção.
                  </span>
               </li>
               <li className="flex items-start gap-2">
                  <span className="text-green-500 mt-0.5">•</span>
                  <span>
                     Se uma <strong className="text-gray-300">data de retorno</strong> for definida,
                     o site voltará ao ar automaticamente nessa data.
                  </span>
               </li>
               <li className="flex items-start gap-2">
                  <span className="text-green-500 mt-0.5">•</span>
                  <span>
                     Você pode <strong className="text-gray-300">desativar manualmente</strong> a
                     qualquer momento usando o toggle acima.
                  </span>
               </li>
            </ul>
         </div>
      </div>
   );
}
