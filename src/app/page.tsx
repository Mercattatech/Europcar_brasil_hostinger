"use client";

import { useSession, signOut } from "next-auth/react";
import { useState, useEffect } from "react";
import HeroSearchForm from "@/components/home/HeroSearchForm";
import LoginModal from "@/components/auth/LoginModal";

// Car image overrides
const carImageOverrides: Record<string,string> = {};

export default function HomePage() {
  const { data: session, status } = useSession();
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [carImages, setCarImages] = useState<Record<string,string>>({});

  useEffect(() => {
    fetch("/api/admin/fleet-images")
      .then(r => r.json())
      .then(d => { if (d && typeof d === "object") setCarImages(d); })
      .catch(() => {});
  }, []);

  return (
    <main className="min-h-screen bg-white">
      {/* Login Modal */}
      {showLoginModal && (
        <LoginModal onClose={() => setShowLoginModal(false)} />
      )}

      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="backdrop-overlay" onClick={() => setMobileMenuOpen(false)} />
          <div className="fixed top-0 right-0 w-[280px] h-full bg-[#1a1a1a] z-50 shadow-2xl flex flex-col animate-slide-in-right">
            {/* Close button */}
            <div className="flex items-center justify-between p-4 border-b border-gray-800">
              <span className="text-white font-bold text-lg">Menu</span>
              <button onClick={() => setMobileMenuOpen(false)} className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-gray-800 text-gray-400">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            {/* User area */}
            <div className="p-4 border-b border-gray-800">
              {session?.user ? (
                <div>
                  <p className="text-[#008d36] font-bold">Olá, {session.user.name || session.user.email?.split('@')[0]}</p>
                  <div className="flex gap-4 mt-2">
                    <a href="/reservas" className="text-sm text-gray-300 hover:text-white">Meu Perfil</a>
                    <button onClick={() => signOut()} className="text-sm text-gray-400 hover:text-red-400">Sair</button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => { setMobileMenuOpen(false); setShowLoginModal(true); }}
                  className="flex items-center gap-3 text-white font-bold w-full py-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  Fazer login
                </button>
              )}
            </div>
            {/* Links */}
            <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
              {[
                { href: "/reservation/searchbooking", label: "Sobre suas Reservas", icon: "📋" },
                { href: "/reservas", label: "Minhas Reservas", icon: "🚗" },
                { href: "/promocoes", label: "Promoções", icon: "🏷️" },
                { href: "/filiais", label: "Filiais", icon: "📍" },
                { href: "/frota", label: "Nossa Frota", icon: "🚙" },
                { href: "https://www.europcar.com/en-us/loyalty-program", label: "Programa de Fidelidade", icon: "⭐", external: true },
                { href: "https://www.europcar.com/pt-br/contact-us", label: "Ajuda", icon: "❓", external: true },
              ].map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  {...(link.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                  className="flex items-center gap-3 px-3 py-3 rounded-xl text-gray-300 hover:bg-gray-800 hover:text-white transition-colors"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <span className="text-lg">{link.icon}</span>
                  <span className="text-sm font-medium">{link.label}</span>
                </a>
              ))}
            </nav>
          </div>
        </div>
      )}

      {/* Top Header & Main Navigation */}
      <div className="bg-[#1a1a1a] w-full pt-4 pb-12 md:pb-24 relative overflow-hidden">
        {/* Background Car Image — hidden on mobile */}
        <div className="absolute top-0 right-0 w-2/3 h-full z-0 opacity-80 pointer-events-none hidden md:block">
          <img
            src="https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?q=80&w=2070&auto=format&fit=crop"
            className="w-full h-full object-cover object-left"
            alt="Car presentation"
            style={{
              maskImage: "linear-gradient(to right, transparent, black 40%)",
              WebkitMaskImage: "-webkit-linear-gradient(left, transparent, black 40%)",
            }}
          />
        </div>

        {/* Header Navbar */}
        <div className="relative z-10 max-w-7xl mx-auto px-4 lg:px-6 flex justify-between items-center">
          {/* Logo */}
          <a href="/" className="rounded-b-md overflow-hidden flex items-center justify-center">
            <img src="/logo.jpg" alt="Europcar" className="h-[40px] md:h-[58px] object-contain" />
          </a>

          {/* Desktop Menu */}
          <div className="hidden md:flex text-white text-sm font-bold items-center gap-6 mt-4">
            {status === "loading" ? (
               <span className="text-gray-400">Carregando...</span>
            ) : session?.user ? (
               <div className="flex items-center gap-4">
                  <span className="text-[#008d36]">Olá, {session.user.name || session.user.email?.split('@')[0]}</span>
                  <a href="/reservas" className="text-xs text-white hover:text-[#008d36] font-normal">Meu Perfil</a>
                  <button onClick={() => signOut()} className="text-xs text-gray-300 hover:text-red-500 font-normal">Sair</button>
               </div>
            ) : (
               <button onClick={() => setShowLoginModal(true)} className="flex items-center gap-2 cursor-pointer hover:text-gray-300">
                 <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                 </svg>
                 Fazer login
               </button>
            )}
            <span className="flex items-center gap-2 cursor-pointer hover:text-gray-300">
              <span className="bg-yellow-400 w-4 h-3 rounded-sm inline-block"></span>
              BR
            </span>
            <a href="https://www.europcar.com/pt-br/contact-us" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 cursor-pointer hover:text-gray-300">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Ajuda
            </a>
            <span className="flex items-center gap-2 cursor-pointer hover:text-gray-300 ml-2">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
              Menu
            </span>
          </div>

          {/* Mobile Menu Button */}
          <div className="flex md:hidden items-center gap-3">
            {!session?.user && (
              <button onClick={() => setShowLoginModal(true)} className="text-white p-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </button>
            )}
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="text-white p-2 touch-target flex items-center justify-center"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
        </div>

        {/* IOF-free International Banner */}
        <div className="relative z-10 max-w-6xl mx-auto px-4 mt-6 md:mt-8 flex justify-center">
          <div className="w-full md:w-[95%] bg-white/10 backdrop-blur-sm border border-white/20 rounded pl-0 flex items-center shadow-lg cursor-pointer hover:bg-white/20 transition-colors">
            <div className="bg-[#008d36] text-white font-black text-[9px] md:text-xs py-2 px-2 md:px-4 shadow-sm flex-shrink-0">
              ✈️ INTERNACIONAL
            </div>
            <div className="flex-1 px-2 md:px-4 text-white font-bold text-xs md:text-sm truncate">
              Reservas Internacionais livre de IOF
              <span className="font-normal text-gray-300 hidden sm:inline">, com pagamentos on-line.</span>
            </div>
            <div className="pr-2 md:pr-4 text-white text-xs md:text-sm font-bold flex items-center gap-1 shrink-0">
              <span className="hidden sm:inline">Saiba mais</span>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Hero Search Background Wrapper */}
      <div className="bg-[#1a1a1a] w-full pb-8 md:pb-16 relative">
        <div className="w-[95%] max-w-6xl mx-auto relative -top-8 md:-top-16 z-20">
          <HeroSearchForm />
        </div>

        {/* Bottom internal dark nav links — horizontal scroll on mobile */}
        <div className="max-w-6xl mx-auto px-4 mt-2 pb-8 border-b border-gray-800">
          <div className="flex md:grid md:grid-cols-4 gap-4 md:gap-0 text-center overflow-x-auto scroll-x-mobile pb-2 md:pb-0">
            <a href="/reservation/searchbooking" className="text-white text-xs md:text-sm font-bold hover:text-europcar-green flex items-center justify-center gap-1 md:gap-2 whitespace-nowrap px-3 md:px-0">
              Suas Reservas <span>→</span>
            </a>
            <a href="https://www.europcar.com/en-us/loyalty-program" target="_blank" rel="noopener noreferrer" className="text-white text-xs md:text-sm font-bold hover:text-europcar-green flex items-center justify-center gap-1 md:gap-2 whitespace-nowrap px-3 md:px-0">
              Member&apos;s Discount <span>→</span>
            </a>
            <a href="/promocoes" className="text-white text-xs md:text-sm font-bold hover:text-europcar-green flex items-center justify-center gap-1 md:gap-2 whitespace-nowrap px-3 md:px-0">
              Promoções <span>→</span>
            </a>
            <a href="#" className="text-white text-xs md:text-sm font-bold hover:text-europcar-green flex items-center justify-center gap-1 md:gap-2 whitespace-nowrap px-3 md:px-0">
              Para sua empresa <span>→</span>
            </a>
          </div>
        </div>
      </div>

      {/* Frota Section */}
      <div className="bg-gray-50 py-10 md:py-16">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex items-center gap-3 mb-6 md:mb-10">
            <div className="w-1 h-8 bg-[#008d36] rounded-full"></div>
            <div>
              <h2 className="text-xl md:text-2xl font-black text-gray-900">Nossa Frota</h2>
              <p className="text-xs md:text-sm text-gray-500 font-medium">Conheça os veículos disponíveis para aluguel</p>
            </div>
          </div>

          {/* Mobile: horizontal scroll, Desktop: grid */}
          <div className="flex md:grid md:grid-cols-3 gap-4 md:gap-6 overflow-x-auto scroll-x-mobile pb-4 md:pb-0 -mx-4 px-4 md:mx-0 md:px-0">
            {[
              { nome: "Renault Kwid", categoria: "Econômico", acriss: "EDMR", assentos: 5, portas: 4, cambio: "Manual", ar: true, img: "https://static.europcar.com/carvisuals/partners/835x557/EDMR_BR.png" },
              { nome: "Fiat Cronos", categoria: "Compacto", acriss: "CDMR", assentos: 5, portas: 4, cambio: "Manual", ar: true, img: "https://static.europcar.com/carvisuals/partners/835x557/CDMR_BR.png" },
              { nome: "Volkswagen Virtus", categoria: "Intermediário", acriss: "IDMR", assentos: 5, portas: 4, cambio: "Manual", ar: true, img: "https://static.europcar.com/carvisuals/partners/835x557/IDMR_BR.png" },
              { nome: "Volkswagen T-Cross", categoria: "SUV Compacto", acriss: "IFAR", assentos: 5, portas: 4, cambio: "Automático", ar: true, img: "https://static.europcar.com/carvisuals/partners/835x557/IFAR_BR.png" },
              { nome: "Jeep Compass", categoria: "SUV Premium", acriss: "SFAR", assentos: 5, portas: 4, cambio: "Automático", ar: true, img: "https://static.europcar.com/carvisuals/partners/835x557/SFAR_BR.png" },
              { nome: "Citroen C4 Cactus", categoria: "Minivan", acriss: "SVAR", assentos: 7, portas: 4, cambio: "Automático", ar: true, img: "https://static.europcar.com/carvisuals/partners/835x557/SVAR_BR.png" },
            ].map((car, idx) => (
              <div key={idx} className="group bg-white rounded-xl border border-gray-100 overflow-hidden hover:shadow-lg hover:border-[#008d36]/30 transition-all duration-300 min-w-[260px] md:min-w-0 flex-shrink-0 md:flex-shrink">
                <div className="h-32 md:h-40 bg-gradient-to-b from-gray-50 to-white flex items-center justify-center p-4">
                  <img
                    src={carImages[car.acriss] || car.img}
                    alt={car.nome}
                    className="max-h-full max-w-full object-contain group-hover:scale-105 transition-transform duration-500"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = `https://cdn.imagin.studio/getImage?customer=europcar&make=${car.nome.split(' ')[0]}&modelFamily=${car.nome.split(' ').slice(1).join('-')}&paintId=pspc0001&angle=01&width=400`;
                    }}
                  />
                </div>
                <div className="p-4 md:p-5 border-t border-gray-100">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-black text-gray-900 text-sm md:text-base">{car.nome}</h3>
                    <span className="text-[9px] md:text-[10px] bg-[#008d36]/10 text-[#008d36] font-bold px-2 py-0.5 rounded-full">{car.categoria}</span>
                  </div>
                  <span className="text-[10px] bg-gray-100 text-gray-500 font-bold px-2 py-0.5 rounded-full">{car.acriss}</span>
                  <div className="flex items-center gap-2 md:gap-3 mt-3 text-[10px] md:text-xs text-gray-500 font-medium">
                    <span>👤 {car.assentos}</span>
                    <span>🚪 {car.portas}</span>
                    <span>⚙️ {car.cambio}</span>
                    {car.ar && <span>❄️ A/C</span>}
                  </div>
                  <div className="mt-3 md:mt-4 text-[10px] md:text-xs text-gray-400">
                    {car.nome} ou similar
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Vantagens Section */}
      <div className="max-w-4xl mx-auto px-4 py-10 md:py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12 text-center">
          <div className="flex flex-col items-center">
            <div className="w-12 h-12 mb-4 bg-gray-100 rounded-full flex items-center justify-center">⭐</div>
            <h3 className="font-black text-gray-900 mb-2">Vantagens e benefícios</h3>
            <p className="text-sm text-gray-500 mb-6">Aproveite as vantagens Exclusivas (programa de fidelidade)</p>
            <a href="https://www.europcar.com/en-us/loyalty-program" target="_blank" rel="noopener noreferrer" className="bg-[#ffcc00] hover:bg-yellow-500 text-gray-900 font-bold py-3 px-6 rounded w-full block text-center text-sm">
              Privilege-Programa de fidelidade
            </a>
          </div>
          <div className="flex flex-col items-center">
            <div className="w-12 h-12 mb-4 bg-gray-100 rounded-full flex items-center justify-center">🏠</div>
            <h3 className="font-black text-gray-900 mb-2">Aluguel Flexível</h3>
            <p className="text-sm text-gray-500 mb-6">Ajuste a escolha e período adequado às suas necessidades.</p>
            <button className="bg-[#ffcc00] hover:bg-yellow-500 text-gray-900 font-bold py-3 px-6 rounded w-full text-sm">
              Descobrir
            </button>
          </div>
        </div>
      </div>

      {/* Presente no mundo */}
      <div className="bg-[#f2f2f2] border-t border-gray-200">
        <div className="max-w-6xl mx-auto px-4 py-10 md:py-16 flex flex-col md:flex-row">
          <div className="md:w-1/3 md:pr-8 mb-6 md:mb-0 text-center md:text-left">
            <div className="w-12 h-12 mb-4 bg-[#008d36] rounded text-white flex items-center justify-center font-bold mx-auto md:mx-0">🗺️</div>
            <h3 className="font-black text-gray-900 text-lg md:text-xl mb-2">Presente em todo o mundo</h3>
            <p className="text-sm text-gray-500">
              <span className="font-bold text-[#008d36]">3 835</span> Localidades Europcar em <span className="font-bold text-[#008d36]">+140</span> países.
            </p>
            <a href="#" className="text-sm text-[#008d36] font-bold mt-4 inline-block">Ver tudo</a>
          </div>

          <div className="md:w-2/3 grid grid-cols-2 md:grid-cols-4 gap-4 text-xs font-semibold text-gray-700">
            <div>
              <h4 className="font-black text-black mb-2 md:mb-3 text-sm">No Brasil</h4>
              <ul className="space-y-1.5 md:space-y-2">
                <li>São Paulo</li><li>Guarulhos</li><li>Campinas</li><li>João Pessoa</li>
              </ul>
            </div>
            <div>
              <h4 className="font-black text-black mb-2 md:mb-3 text-sm">Nas Américas</h4>
              <ul className="space-y-1.5 md:space-y-2">
                <li>Uruguai</li><li>Argentina</li><li>Estados Unidos</li><li>Costa Rica</li>
              </ul>
            </div>
            <div>
              <h4 className="font-black text-black mb-2 md:mb-3 text-sm">Na Europa</h4>
              <ul className="space-y-1.5 md:space-y-2">
                <li>Portugal</li><li>Itália</li><li>Espanha</li><li>França</li>
              </ul>
            </div>
            <div>
              <h4 className="font-black text-black mb-2 md:mb-3 text-sm">Outros Continentes</h4>
              <ul className="space-y-1.5 md:space-y-2">
                <li>Austrália</li><li>Nova Zelândia</li><li>África do Sul</li><li>Turquia</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
