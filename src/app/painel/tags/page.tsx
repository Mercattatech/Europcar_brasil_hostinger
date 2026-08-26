"use client";

import { useState, useEffect } from "react";

export default function PainelTags() {
   const [gaId, setGaId] = useState("");
   const [gtmId, setGtmId] = useState("");
   const [customHead, setCustomHead] = useState("");
   const [customBody, setCustomBody] = useState("");
   const [loading, setLoading] = useState(true);
   const [saving, setSaving] = useState(false);
   const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

   const showToast = (msg: string, t: "success" | "error" = "success") => {
      setToast({ message: msg, type: t });
      setTimeout(() => setToast(null), 4000);
   };

   useEffect(() => {
      fetch("/api/admin/tags")
         .then((res) => res.json())
         .then((data) => {
            setGaId(data.google_analytics_id || "");
            setGtmId(data.google_tag_manager_id || "");
            setCustomHead(data.custom_head_scripts || "");
            setCustomBody(data.custom_body_scripts || "");
            setLoading(false);
         })
         .catch(() => setLoading(false));
   }, []);

   const handleSave = async (e: React.FormEvent) => {
      e.preventDefault();
      setSaving(true);
      try {
         const res = await fetch("/api/admin/tags", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
               google_analytics_id: gaId,
               google_tag_manager_id: gtmId,
               custom_head_scripts: customHead,
               custom_body_scripts: customBody,
            }),
         });

         if (res.ok) {
            showToast("Tags salvas com sucesso! As mudanças serão aplicadas no próximo carregamento.");
         } else {
            showToast("Erro ao salvar", "error");
         }
      } catch {
         showToast("Erro de conexão", "error");
      } finally {
         setSaving(false);
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
               className={`fixed top-4 right-4 z-50 px-5 py-3 rounded-lg shadow-2xl font-bold text-sm ${
                  toast.type === "success" ? "bg-green-600 text-white" : "bg-red-600 text-white"
               }`}
            >
               {toast.message}
            </div>
         )}

         {/* Header */}
         <div>
            <h1 className="text-2xl font-black text-white flex items-center gap-3">
               📊 Tags & Rastreamento
            </h1>
            <p className="text-gray-400 text-sm mt-1">
               Configure Google Analytics, Google Tag Manager e scripts de rastreamento personalizados
            </p>
         </div>

         {/* Info */}
         <div className="flex items-start gap-3 bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
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
               Os scripts configurados aqui serão injetados automaticamente em todas as páginas do
               site. Após salvar, as mudanças serão aplicadas no próximo carregamento de página.
            </p>
         </div>

         <form onSubmit={handleSave} className="space-y-6">
            {/* Google Analytics */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
               <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-yellow-500/15 rounded-lg flex items-center justify-center">
                     <svg className="w-5 h-5 text-yellow-400" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M22.84 2.998c-.643-.372-1.466-.15-1.838.493l-6.862 11.87c-.372.643-.15 1.466.493 1.838.643.372 1.466.15 1.838-.493l6.862-11.87c.372-.643.15-1.466-.493-1.838z" />
                        <path d="M17.545 17.545a3.273 3.273 0 11-6.545 0 3.273 3.273 0 016.545 0z" />
                        <path d="M6.545 20.182a2.727 2.727 0 100-5.455 2.727 2.727 0 000 5.455z" />
                        <path d="M2.727 9.273a2.727 2.727 0 100-5.455 2.727 2.727 0 000 5.455z" />
                     </svg>
                  </div>
                  <div>
                     <h2 className="text-white font-bold">Google Analytics (GA4)</h2>
                     <p className="text-gray-500 text-xs">Métricas de acesso e comportamento dos usuários</p>
                  </div>
               </div>

               <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase mb-2">
                     Measurement ID
                  </label>
                  <input
                     type="text"
                     value={gaId}
                     onChange={(e) => setGaId(e.target.value)}
                     className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-sm text-white font-mono outline-none focus:border-green-600 transition-colors"
                     placeholder="G-XXXXXXXXXX"
                  />
                  <p className="text-[11px] text-gray-500 mt-1.5">
                     Encontre em: Google Analytics → Admin → Data Streams → Measurement ID
                  </p>
               </div>
            </div>

            {/* Google Tag Manager */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
               <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-blue-500/15 rounded-lg flex items-center justify-center">
                     <svg className="w-5 h-5 text-blue-400" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12.003 2L5.002 9l3.5 3.5-3.5 3.5 7.001 7 7.001-7-3.5-3.5 3.5-3.5-7.001-7z" />
                     </svg>
                  </div>
                  <div>
                     <h2 className="text-white font-bold">Google Tag Manager (GTM)</h2>
                     <p className="text-gray-500 text-xs">Gerenciador de tags para pixel, conversões e eventos</p>
                  </div>
               </div>

               <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase mb-2">
                     Container ID
                  </label>
                  <input
                     type="text"
                     value={gtmId}
                     onChange={(e) => setGtmId(e.target.value)}
                     className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-sm text-white font-mono outline-none focus:border-green-600 transition-colors"
                     placeholder="GTM-XXXXXXX"
                  />
                  <p className="text-[11px] text-gray-500 mt-1.5">
                     Encontre em: Google Tag Manager → Container ID (formato: GTM-XXXXXXX)
                  </p>
               </div>
            </div>

            {/* Scripts Customizados */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
               <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-purple-500/15 rounded-lg flex items-center justify-center">
                     <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                     </svg>
                  </div>
                  <div>
                     <h2 className="text-white font-bold">Scripts Personalizados</h2>
                     <p className="text-gray-500 text-xs">Pixels do Facebook, Hotjar, Clarity, ou qualquer outro script</p>
                  </div>
               </div>

               <div className="space-y-5">
                  <div>
                     <label className="block text-xs font-bold text-gray-400 uppercase mb-2">
                        Scripts no {"<head>"} do site
                     </label>
                     <textarea
                        value={customHead}
                        onChange={(e) => setCustomHead(e.target.value)}
                        rows={5}
                        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-sm text-white font-mono outline-none focus:border-green-600 transition-colors resize-y"
                        placeholder={'<script>\n  // Seu código aqui...\n</script>'}
                     />
                     <p className="text-[11px] text-gray-500 mt-1.5">
                        Cole o código completo incluindo as tags {"<script>"}. Será injetado no {"<head>"} de todas as páginas.
                     </p>
                  </div>

                  <div>
                     <label className="block text-xs font-bold text-gray-400 uppercase mb-2">
                        Scripts no {"<body>"} do site
                     </label>
                     <textarea
                        value={customBody}
                        onChange={(e) => setCustomBody(e.target.value)}
                        rows={5}
                        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-sm text-white font-mono outline-none focus:border-green-600 transition-colors resize-y"
                        placeholder={'<script>\n  // Seu código aqui...\n</script>'}
                     />
                     <p className="text-[11px] text-gray-500 mt-1.5">
                        Cole o código que deve ser inserido no {"<body>"}. Ideal para noscript tags e scripts de tracking.
                     </p>
                  </div>
               </div>
            </div>

            {/* Aviso */}
            <div className="flex items-start gap-3 bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4">
               <svg
                  className="w-5 h-5 text-yellow-400 shrink-0 mt-0.5"
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
                  <p className="text-sm font-bold text-yellow-300">Atenção com scripts customizados</p>
                  <p className="text-xs text-yellow-400/80 mt-0.5">
                     Scripts incorretos podem afetar o funcionamento do site. Sempre verifique o código antes de salvar.
                  </p>
               </div>
            </div>

            {/* Botão Salvar */}
            <div className="flex justify-end">
               <button
                  type="submit"
                  disabled={saving}
                  className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-bold text-sm transition-colors disabled:opacity-50"
               >
                  {saving ? "Salvando..." : "Salvar Tags"}
               </button>
            </div>
         </form>

         {/* Status dos IDs */}
         <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-5">
            <h3 className="text-sm font-bold text-gray-300 mb-3">📋 Status das Tags</h3>
            <div className="space-y-2">
               <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-400">Google Analytics (GA4)</span>
                  {gaId ? (
                     <span className="text-green-400 font-mono bg-green-500/10 px-2 py-1 rounded">
                        ✓ {gaId}
                     </span>
                  ) : (
                     <span className="text-gray-600">Não configurado</span>
                  )}
               </div>
               <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-400">Google Tag Manager</span>
                  {gtmId ? (
                     <span className="text-green-400 font-mono bg-green-500/10 px-2 py-1 rounded">
                        ✓ {gtmId}
                     </span>
                  ) : (
                     <span className="text-gray-600">Não configurado</span>
                  )}
               </div>
               <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-400">Scripts {"<head>"} customizados</span>
                  {customHead ? (
                     <span className="text-green-400 bg-green-500/10 px-2 py-1 rounded">
                        ✓ {customHead.length} caracteres
                     </span>
                  ) : (
                     <span className="text-gray-600">Nenhum</span>
                  )}
               </div>
               <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-400">Scripts {"<body>"} customizados</span>
                  {customBody ? (
                     <span className="text-green-400 bg-green-500/10 px-2 py-1 rounded">
                        ✓ {customBody.length} caracteres
                     </span>
                  ) : (
                     <span className="text-gray-600">Nenhum</span>
                  )}
               </div>
            </div>
         </div>
      </div>
   );
}
