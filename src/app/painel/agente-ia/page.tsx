'use client';

import { useState, useEffect } from 'react';

export default function AgenteIA() {
   const [config, setConfig] = useState<any>(null);
   const [loading, setLoading] = useState(true);
   const [saving, setSaving] = useState(false);
   const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

   const fetchConfig = async () => {
      try {
         const res = await fetch("/api/admin/ai-config");
         const data = await res.json();
         setConfig(data || { isActive: true, positivePrompt: "", negativePrompt: "" });
      } catch (e) {
         console.error(e);
      } finally {
         setLoading(false);
      }
   };

   useEffect(() => { fetchConfig(); }, []);

   const handleSave = async (e: React.FormEvent) => {
      e.preventDefault();
      setSaving(true);
      try {
         const res = await fetch("/api/admin/ai-config", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(config)
         });
         if (res.ok) {
            setToast({ message: "Configurações salvas!", type: "success" });
            fetchConfig();
         } else {
            setToast({ message: "Erro ao salvar", type: "error" });
         }
      } catch (e) {
         setToast({ message: "Erro de conexão", type: "error" });
      } finally {
         setSaving(false);
         setTimeout(() => setToast(null), 3000);
      }
   };

   if (loading) return <div className="p-10 text-white font-bold">Carregando...</div>;

   return (
      <div className="space-y-6 max-w-4xl">
         {toast && (
            <div className={`fixed top-4 right-4 z-50 px-5 py-3 rounded-lg shadow-2xl font-bold text-sm ${toast.type === "success" ? "bg-green-600 text-white" : "bg-red-600 text-white"}`}>
               {toast.message}
            </div>
         )}
         
         <div>
            <h1 className="text-2xl font-black text-white">Agente de IA (Assistente)</h1>
            <p className="text-gray-400 text-sm mt-1">Configure o comportamento do assistente virtual do site.</p>
         </div>

         <form onSubmit={handleSave} className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-6">
            <div className="flex items-center justify-between bg-gray-800/50 p-4 rounded-lg">
               <div>
                  <h3 className="text-white font-bold">Status do Agente no Site</h3>
                  <p className="text-sm text-gray-400">Ative ou desative o balão de chat para os clientes.</p>
               </div>
               <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" className="sr-only peer" checked={config?.isActive || false} onChange={e => setConfig({...config, isActive: e.target.checked})} />
                  <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
               </label>
            </div>

            <div>
               <label className="block text-white font-bold mb-2">Comportamento Positivo (Instruções Adicionais)</label>
               <p className="text-sm text-gray-400 mb-2">O que o agente DEVE fazer. Adicione regras de negócios, dicas de venda, etc.</p>
               <textarea 
                  rows={4}
                  value={config?.positivePrompt || ""}
                  onChange={e => setConfig({...config, positivePrompt: e.target.value})}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg p-3 text-white focus:border-green-500 outline-none"
                  placeholder="Ex: Ofereça sempre a proteção completa Premium. Seja super educado e chame o cliente pelo nome."
               />
            </div>

            <div>
               <label className="block text-white font-bold mb-2">Comportamento Negativo (Restrições)</label>
               <p className="text-sm text-gray-400 mb-2">O que o agente NUNCA deve fazer ou dizer.</p>
               <textarea 
                  rows={4}
                  value={config?.negativePrompt || ""}
                  onChange={e => setConfig({...config, negativePrompt: e.target.value})}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg p-3 text-white focus:border-red-500 outline-none"
                  placeholder="Ex: Nunca dê descontos não autorizados. Nunca prometa carros específicos, apenas categorias."
               />
            </div>

            <div className="pt-4 border-t border-gray-800 flex justify-end">
               <button type="submit" disabled={saving} className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-6 rounded-lg transition-colors">
                  {saving ? "Salvando..." : "Salvar Configurações"}
               </button>
            </div>
         </form>
      </div>
   );
}
