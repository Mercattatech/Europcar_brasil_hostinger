"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import LoginModal from "@/components/auth/LoginModal";

export default function SearchBookingPage() {
  const [email, setEmail] = useState("");
  const [resNumber, setResNumber] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<any>(null);
  const { data: session, status } = useSession();
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [userReservations, setUserReservations] = useState<any[]>([]);
  const [loadingUserRes, setLoadingUserRes] = useState(false);

  useEffect(() => {
     if (session?.user?.email) {
        setLoadingUserRes(true);
        fetch('/api/reservas/user')
          .then(res => res.json())
          .then(data => setUserReservations(data))
          .finally(() => setLoadingUserRes(false));
     }
  }, [session]);

  const getDaysLeft = (pickupDateStr: string) => {
     if (!pickupDateStr) return "-";
     const y = pickupDateStr.substring(0, 4);
     const m = pickupDateStr.substring(4, 6);
     const d = pickupDateStr.substring(6, 8);
     const puDate = new Date(`${y}-${m}-${d}T12:00:00`);
     const diffTime = puDate.getTime() - new Date().getTime();
     const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
     if (diffDays < 0) return "Já passou";
     if (diffDays === 0) return "Hoje";
     return `Faltam ${diffDays} dias`;
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setResult(null);

    try {
      const res = await fetch("/api/reservas/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, resNumber }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Erro desconhecido");
      }
      setResult(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white font-sans flex flex-col">
      {showLoginModal && (
        <LoginModal onClose={() => setShowLoginModal(false)} />
      )}

      {/* Header Branco Simples */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 h-20 flex justify-between items-center">
          <Link href="/">
             <img src="/logo.jpg" alt="Europcar" className="h-[48px] md:h-[58px] object-contain rounded-b-md shadow-lg" />
          </Link>
          <div className="flex items-center gap-6 text-sm font-bold text-gray-900">
            {status === "loading" ? (
               <span className="text-gray-400">Carregando...</span>
            ) : session?.user ? (
               <div className="flex items-center gap-4">
                  <span className="text-[#008d36]">Olá, {session.user.name || session.user.email?.split('@')[0]}</span>
                  <button onClick={() => signOut()} className="text-xs text-gray-500 hover:text-red-500 font-normal">Sair</button>
               </div>
            ) : (
               <button onClick={() => setShowLoginModal(true)} className="flex items-center gap-2 hover:text-[#008d36]">
                 <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg>
                 Fazer login
               </button>
            )}
            <button className="flex items-center gap-2 hover:text-[#008d36]">
              <span className="text-xl">🇧🇷</span> BR
            </button>
            <a href="https://www.europcar.com/pt-br/contact-us" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 hover:text-[#008d36]">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
              Ajuda
            </a>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex flex-col items-center pt-8 px-4 pb-20">
        <div className="w-full max-w-2xl mb-8 flex items-center">
           <Link href="/" className="flex items-center text-sm font-bold text-gray-900 hover:text-[#008d36]">
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>
              Voltar
           </Link>
        </div>

        <div className="w-full max-w-[800px]">
          <h1 className="text-3xl font-black text-center text-gray-900 mb-8">Administrar suas reservas</h1>
          
          <div className="bg-white">
            {session?.user ? (
               <div className="border border-green-200 bg-white rounded-lg shadow-sm overflow-hidden">
                  <div className="bg-[#008d36] text-white p-4">
                     <h2 className="text-lg font-black">Minhas Reservas Ativas ({userReservations.length})</h2>
                  </div>
                  {loadingUserRes ? (
                     <div className="p-8 text-center text-gray-500 font-bold">Buscando reservas...</div>
                  ) : userReservations.length === 0 ? (
                     <div className="p-8 text-center text-gray-500">Você ainda não possui reservas.</div>
                  ) : (
                     <div className="overflow-x-auto scroll-x-mobile">
                     <table className="w-full text-left text-sm min-w-[600px]">
                        <thead className="bg-gray-50 border-b border-gray-200 text-gray-600 font-bold uppercase text-xs">
                           <tr>
                              <th className="px-6 py-4">Código / Status</th>
                              <th className="px-6 py-4">Período Selecionado</th>
                              <th className="px-6 py-4">Veículo</th>
                              <th className="px-6 py-4 text-right">Quando retirar?</th>
                           </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                           {userReservations.map(res => (
                              <tr key={res.id} className="hover:bg-gray-50">
                                 <td className="px-6 py-4">
                                    <div className="font-black text-green-700 text-lg leading-none">{res.resNumber || '-'}</div>
                                    <div className="text-[10px] mt-1 uppercase font-bold text-gray-500">{res.status}</div>
                                 </td>
                                 <td className="px-6 py-4 font-medium text-gray-900">
                                    {res.pickupDate?.replace(/(\d{4})(\d{2})(\d{2})/, '$3/$2/$1')} a {res.returnDate?.replace(/(\d{4})(\d{2})(\d{2})/, '$3/$2/$1')}
                                 </td>
                                 <td className="px-6 py-4 font-bold text-gray-900 uppercase text-xs border-l border-r border-gray-100 bg-gray-50 block text-center mt-2 mx-2 mb-2 rounded-sm shadow-sm py-2">
                                    {res.car || 'Padrão'}
                                 </td>
                                 <td className="px-6 py-4 text-right">
                                    <span className={`px-3 py-1 rounded text-xs font-bold ${getDaysLeft(res.pickupDate).includes('Já passou') ? 'bg-red-100 text-red-700' : 'bg-[#ffcc00] text-gray-900 inline-block shadow-sm'}`}>
                                       {getDaysLeft(res.pickupDate)}
                                    </span>
                                 </td>
                              </tr>
                           ))}
                        </tbody>
                     </table>
                     </div>
                  )}
               </div>
            ) : result ? (
               <div className="border border-green-200 bg-green-50 p-6 rounded-lg shadow-sm max-w-[500px] mx-auto">
                  <h2 className="text-xl font-black text-green-900 mb-4 border-b border-green-200 pb-2">Detalhes da Reserva</h2>
                  <div className="space-y-3 text-sm text-gray-800">
                     <div className="flex justify-between">
                        <span className="font-bold">Número da Reserva:</span>
                        <span className="font-black text-lg">{result.resNumber}</span>
                     </div>
                     <div className="flex justify-between">
                        <span className="font-bold">Data da Compra:</span>
                        <span>{new Date(result.createdAt).toLocaleString('pt-BR')}</span>
                     </div>
                     <div className="flex justify-between">
                        <span className="font-bold">Status:</span>
                        <span className="uppercase font-bold text-xs bg-green-200 text-green-800 px-2 py-1 rounded">{result.status}</span>
                     </div>
                     <div className="border-t border-green-200 my-4 py-2 space-y-2">
                        <div className="flex justify-between">
                           <span className="font-bold">Período Selecionado:</span>
                           <span className="font-medium text-xs">{result.pickupDate?.replace(/(\d{4})(\d{2})(\d{2})/, '$3/$2/$1')} até {result.returnDate?.replace(/(\d{4})(\d{2})(\d{2})/, '$3/$2/$1')}</span>
                        </div>
                        <div className="flex justify-between">
                           <span className="font-bold">Veículo:</span>
                           <span className="text-xs uppercase font-bold">{result.car || 'Veículo Padrão'}</span>
                        </div>
                     </div>
                  </div>
                  <button onClick={() => setResult(null)} className="mt-6 w-full text-center text-green-800 font-bold hover:underline text-sm">Fazer nova busca</button>
               </div>
            ) : (
               <form onSubmit={handleSearch} className="max-w-[500px] mx-auto">
                  <p className="text-sm text-gray-700 font-medium mb-4 text-center">Preencha com os dados para localizar sua reserva</p>
                  
                  {/* Tabs */}
                  <div className="flex border border-gray-300 rounded overflow-hidden mb-6">
                     <div className="flex-1 bg-[#008d36] text-white font-bold text-sm py-3 text-center cursor-pointer">Seu e-mail</div>
                     <div className="flex-1 bg-white text-gray-500 font-bold text-sm py-3 text-center cursor-not-allowed opacity-50">Sobrenome</div>
                  </div>

                  {error && <div className="bg-red-50 text-red-600 p-3 rounded text-sm mb-4 font-bold border border-red-200 text-center">{error}</div>}

                  <div className="mb-4">
                     <label className="block text-sm font-bold text-gray-900 mb-2">E-mail</label>
                     <input 
                        type="email" 
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        placeholder="Seu e-mail" 
                        className="w-full border border-gray-300 rounded px-4 py-3 text-sm focus:ring-[#008d36] focus:border-[#008d36] outline-none"
                        required
                     />
                  </div>
                  
                  <div className="mb-6">
                     <label className="block text-sm font-bold text-gray-900 mb-2 flex items-center justify-between">
                        Número de reserva
                        <div className="w-4 h-4 bg-gray-400 text-white rounded-full flex items-center justify-center text-[10px] cursor-help">i</div>
                     </label>
                     <input 
                        type="text" 
                        value={resNumber}
                        onChange={e => setResNumber(e.target.value)}
                        placeholder="Referência da reserva" 
                        className="w-full border border-gray-300 rounded px-4 py-3 text-sm focus:ring-[#008d36] focus:border-[#008d36] outline-none"
                        required
                     />
                  </div>

                  <button 
                     type="submit" 
                     disabled={loading || !email || !resNumber}
                     className={`w-full py-4 text-center rounded font-bold transition-colors ${loading || !email || !resNumber ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'bg-[#e2e2e2] hover:bg-[#d4d4d4] text-gray-900'}`}
                  >
                     {loading ? 'Pesquisando...' : 'Pesquisar'}
                  </button>

                  <div className="text-center mt-6 text-sm text-gray-600 font-medium">
                     Já tem uma conta? <button type="button" onClick={() => setShowLoginModal(true)} className="font-bold text-[#008d36] hover:underline">Entrar</button> para acessar todas as suas reservas.
                  </div>
               </form>
            )}
          </div>
        </div>
      </div>

      {/* Awards Footer */}
      <div className="border-t border-gray-200 bg-white py-10 mt-auto">
         <div className="max-w-6xl mx-auto px-4 flex flex-col md:flex-row items-center justify-center gap-8 md:gap-16">
            <div className="bg-[#008d36] flex items-center justify-center w-12 h-14 shrink-0">
               <span className="text-white font-black italic text-3xl leading-none">E</span>
            </div>
            <div className="flex items-center gap-4 max-w-[220px]">
               <div className="w-12 h-12 rounded-full border border-green-500 overflow-hidden shrink-0 bg-white shadow-sm flex items-center justify-center flex-col leading-none">
                  <span className="text-[10px] text-green-700 font-bold uppercase mt-1">Trip</span>
                  <span className="text-[10px] text-green-700 font-bold">Advisor</span>
               </div>
               <p className="text-[11px] font-bold text-gray-800 leading-tight">TripAdvisor Travelers&apos; Favourites 2019 (for Germany, France and Spain)</p>
            </div>
            <div className="flex items-center gap-4 max-w-[220px]">
               <div className="w-12 h-12 rounded-full border border-yellow-500 overflow-hidden shrink-0 bg-yellow-50 flex items-center justify-center shadow-sm">
                  <span className="text-yellow-600 text-xs font-black italic">WTA</span>
               </div>
               <p className="text-[11px] font-bold text-gray-800 leading-tight">World&apos;s Leading Car Rental Company Website</p>
            </div>
            <div className="flex items-center gap-4 max-w-[200px]">
               <div className="w-12 h-12 rounded-full overflow-hidden shrink-0 bg-[#ff690f] flex items-center justify-center shadow-sm">
                  <span className="text-white font-black text-xs">KAYAK</span>
               </div>
               <p className="text-[11px] font-bold text-gray-800 leading-tight">KAYAK 2020 Best Cleanliness</p>
            </div>
         </div>
      </div>

      {/* Final Black Footer */}
      <footer className="bg-black py-6 mt-auto">
         <div className="max-w-7xl mx-auto px-4 flex flex-col md:flex-row justify-between items-center text-xs font-bold text-white">
            <div className="flex items-center flex-wrap gap-4 mb-4 md:mb-0 text-gray-400">
               <span>©Europcar 2026</span>
               <a href="#" className="hover:underline text-white relative">
                  <span className="absolute -left-2 top-0 text-gray-600">|</span> Mapa do site 
               </a>
               <a href="#" className="hover:underline text-white relative">
                  <span className="absolute -left-2 top-0 text-gray-600">|</span> Termos e Condições 
               </a>
               <a href="#" className="hover:underline text-white relative">
                  <span className="absolute -left-2 top-0 text-gray-600">|</span> Contato 
               </a>
            </div>
            <div className="flex items-center gap-6">
               <a href="#" className="hover:text-gray-300">
                  <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24"><path d="M12 2C6.477 2 2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.879V14.89h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.989C18.343 21.129 22 16.99 22 12c0-5.523-4.477-10-10-10z"/></svg>
               </a>
               <a href="#" className="hover:text-gray-300">
                  <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>
               </a>
            </div>
         </div>
      </footer>
    </div>
  );
}
