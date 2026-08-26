"use client";

import { useState, useEffect } from "react";
import { useSession, signOut } from "next-auth/react";
import Link from "next/link";
import LoginModal from "@/components/auth/LoginModal";

export default function PromocoesPage() {
  const { data: session, status } = useSession();
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [promotions, setPromotions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/promotions")
      .then(res => res.json())
      .then(data => { setPromotions(Array.isArray(data) ? data : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const handleReserve = (contractID: string) => {
    // Store contractID in sessionStorage for XRS injection
    if (contractID) {
      sessionStorage.setItem("europcar_contractID", contractID);
    }
    // Redirect to homepage search
    window.location.href = `/?contractID=${contractID}`;
  };

  return (
    <main className="min-h-screen bg-white">
      {showLoginModal && <LoginModal onClose={() => setShowLoginModal(false)} />}

      {/* Header - same style as main page */}
      <div className="bg-[#1a1a1a] w-full">
        <div className="max-w-7xl mx-auto px-4 lg:px-6 flex justify-between items-center py-3">
          <a href="/" className="rounded-b-md shadow-lg overflow-hidden flex items-center justify-center">
            <img src="/logo.jpg" alt="Europcar" className="h-[48px] md:h-[58px] object-contain" />
          </a>
          <div className="flex text-white text-sm font-bold items-center gap-6">
            {status === "loading" ? (
              <span className="text-gray-400">...</span>
            ) : session?.user ? (
              <div className="flex items-center gap-4">
                <span className="text-[#008d36]">Olá, {session.user.name || session.user.email?.split("@")[0]}</span>
                <button onClick={() => signOut()} className="text-xs text-gray-300 hover:text-red-500">Sair</button>
              </div>
            ) : (
              <button onClick={() => setShowLoginModal(true)} className="flex items-center gap-2 hover:text-gray-300">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg>
                Fazer login
              </button>
            )}
            <a href="https://www.europcar.com/pt-br/contact-us" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 hover:text-gray-300">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
              Ajuda
            </a>
          </div>
        </div>
      </div>

      {/* Hero Banner */}
      <div className="relative bg-gradient-to-r from-[#008d36] to-[#005c24] py-16 overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-white/10 rounded-full -translate-y-1/2 translate-x-1/4"></div>
          <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-white/5 rounded-full translate-y-1/2 -translate-x-1/4"></div>
        </div>
        <div className="relative max-w-7xl mx-auto px-4 lg:px-6 text-center">
          <h1 className="text-4xl md:text-5xl font-black text-white mb-4">Promoções de Aluguel de Carros</h1>
          <p className="text-white/80 text-lg max-w-2xl mx-auto">Desfrute de ofertas exclusivas e condições especiais para sua próxima viagem. Reserve agora e economize!</p>
        </div>
      </div>

      {/* Breadcrumb */}
      <div className="bg-gray-50 border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 lg:px-6 py-3 text-sm text-gray-500">
          <Link href="/" className="hover:text-[#008d36]">Home</Link>
          <span className="mx-2">›</span>
          <span className="text-gray-900 font-bold">Promoções</span>
        </div>
      </div>

      {/* Promotions Grid */}
      <div className="max-w-7xl mx-auto px-4 lg:px-6 py-12">
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-10 h-10 border-4 border-[#008d36] border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : promotions.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-6xl mb-4">🏷️</div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Nenhuma promoção disponível no momento</h2>
            <p className="text-gray-500 mb-6">Volte em breve para conferir nossas ofertas exclusivas!</p>
            <Link href="/" className="inline-block bg-[#008d36] hover:bg-[#007a2d] text-white font-bold px-6 py-3 rounded-lg transition-colors">
              Reservar agora →
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {promotions.map(promo => (
              <div key={promo.id} className="group bg-white rounded-2xl shadow-md border border-gray-100 overflow-hidden hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
                {/* Image */}
                <div className="relative h-52 bg-gray-200 overflow-hidden">
                  {promo.imageUrl ? (
                    <img src={promo.imageUrl} alt={promo.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-[#008d36] to-[#005c24] flex items-center justify-center">
                      <span className="text-white/40 text-6xl">🚗</span>
                    </div>
                  )}
                  {/* Discount Badge */}
                  {promo.discountValue && (
                    <div className="absolute top-4 left-4 bg-[#e41b23] text-white rounded-xl px-4 py-2 shadow-lg">
                      <div className="text-2xl font-black leading-none">{promo.discountValue}%</div>
                      <div className="text-[10px] font-bold uppercase tracking-wider">desconto</div>
                    </div>
                  )}
                  {/* Validity badge */}
                  {promo.endDate && (
                    <div className="absolute top-4 right-4 bg-black/60 backdrop-blur-sm text-white rounded-lg px-3 py-1.5 text-[10px] font-bold">
                      Até {new Date(promo.endDate).toLocaleDateString("pt-BR")}
                    </div>
                  )}
                </div>

                {/* Content */}
                <div className="p-6">
                  <h3 className="text-xl font-black text-gray-900 mb-1 group-hover:text-[#008d36] transition-colors">{promo.title}</h3>
                  {promo.subtitle && <p className="text-sm font-semibold text-[#008d36] mb-3">{promo.subtitle}</p>}
                  {promo.description && <p className="text-sm text-gray-600 line-clamp-3 mb-5">{promo.description}</p>}

                  <button
                    onClick={() => handleReserve(promo.contractID || "")}
                    className="w-full bg-[#008d36] hover:bg-[#007a2d] text-white font-bold py-3.5 px-6 rounded-xl text-sm transition-all duration-200 hover:shadow-lg hover:shadow-green-500/20 flex items-center justify-center gap-2"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                    Reservar com esta oferta
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="bg-[#1a1a1a] text-white py-10">
        <div className="max-w-7xl mx-auto px-4 lg:px-6">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex items-center gap-3">
              <div className="bg-[#008d36] px-3 py-1.5 rounded">
                <img src="/logo.jpg" alt="Europcar" className="h-6 object-contain" />
              </div>
              <span className="text-gray-400 text-sm">Brasil</span>
            </div>
            <div className="flex gap-6 text-sm text-gray-400">
              <Link href="/" className="hover:text-white">Home</Link>
              <Link href="/promocoes" className="hover:text-white text-[#008d36] font-bold">Promoções</Link>
              <a href="https://www.europcar.com/pt-br/contact-us" target="_blank" className="hover:text-white">Ajuda</a>
            </div>
            <p className="text-gray-600 text-xs">© {new Date().getFullYear()} Europcar Brasil. Todos os direitos reservados.</p>
          </div>
        </div>
      </footer>
    </main>
  );
}
