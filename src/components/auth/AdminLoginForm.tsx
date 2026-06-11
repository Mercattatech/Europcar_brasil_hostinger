"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminLoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [debug, setDebug] = useState<string>("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setDebug("");
    
    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
         setError(`Erro: ${result.error}`);
         setLoading(false);
      } else {
         setDebug(JSON.stringify(result));
         // Let's force a hard browser navigate using assign, or full url
         window.location.assign(window.location.origin + "/painel");
      }
    } catch (err: any) {
      setError(`Crash: ${err.message}`);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-sm p-8">
         <div className="text-center mb-8">
            <h1 className="text-2xl font-black text-[#008d36] italic tracking-tight mb-2">Europcar <span className="text-gray-900 not-italic font-bold">Admin</span></h1>
            <p className="text-sm text-gray-500 font-bold">Faça login para acessar o painel</p>
         </div>

         {error && (
            <div className="bg-red-50 text-red-600 border border-red-200 p-3 rounded text-sm mb-4 font-bold text-center">
               {error}
            </div>
         )}

         {debug && (
            <div className="bg-blue-50 text-blue-800 border border-blue-200 p-3 rounded text-xs mb-4 text-left overflow-hidden break-all">
               DEBUG NEXTAUTH:<br/>
               {debug}
            </div>
         )}

        <form onSubmit={handleLogin}>
          <div className="mb-4">
            <label className="block text-sm font-bold text-gray-700 mb-1">E-mail</label>
            <input 
              type="email" 
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border border-gray-300 rounded px-4 py-3 outline-none focus:border-[#008d36]" 
              placeholder="admin@email.com" 
            />
          </div>
          <div className="mb-6">
            <label className="block text-sm font-bold text-gray-700 mb-1">Senha</label>
            <input 
              type="password" 
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border border-gray-300 rounded px-4 py-3 outline-none focus:border-[#008d36]" 
              placeholder="••••••••" 
            />
          </div>
          <button 
             type="submit" 
             disabled={loading}
             className="w-full bg-[#008d36] hover:bg-[#007a2d] text-white font-bold py-4 rounded transition-colors text-lg disabled:opacity-50"
          >
             {loading ? 'Validando...' : 'Acessar Painel'}
          </button>
        </form>
        <div className="mt-4 text-center">
           <a href="/" className="text-sm font-bold text-gray-500 hover:text-gray-800">← Voltar ao site principal</a>
        </div>
      </div>
    </div>
  );
}
