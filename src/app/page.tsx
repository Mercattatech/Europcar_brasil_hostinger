"use client";

import HeroSearchForm from "@/components/home/HeroSearchForm";
import Image from "next/image";
import { useState, useEffect } from "react";
import { useSession, signOut } from "next-auth/react";
import LoginModal from "@/components/auth/LoginModal";

export default function Home() {
  const { data: session, status } = useSession();
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [carImages, setCarImages] = useState<Record<string, string>>({});

  useEffect(() => {
    fetch("/api/cars/images")
      .then(res => res.json())
      .then((data: any[]) => {
        const map: Record<string, string> = {};
        data.forEach(img => map[img.carCode] = img.imageUrl);
        setCarImages(map);
      })
      .catch(console.error);
  }, []);
  return (
    <main className="min-h-screen bg-white">
      {/* Login Modal */}
      {showLoginModal && (
        <LoginModal onClose={() => setShowLoginModal(false)} />
      )}

      {/* Top Header & Main Navigation (Dark Theme) */}
      <div className="bg-[#1a1a1a] w-full pt-4 pb-24 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-2/3 h-full z-0 opacity-80 pointer-events-none">
          {/* Background Car Image overlaying the dark header */}
          <img
            src="https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?q=80&w=2070&auto=format&fit=crop"
            className="w-full h-full object-cover object-left mask-image-gradient"
            alt="Car presentation"
            style={{
              maskImage: "linear-gradient(to right, transparent, black 40%)",
              WebkitMaskImage:
                "-webkit-linear-gradient(left, transparent, black 40%)",
            }}
          />
        </div>

        {/* Header Navbar */}
        <div className="relative z-10 max-w-7xl mx-auto px-4 lg:px-6 flex justify-between items-start">
          {/* Logo Block */}
          <a href="/" className="bg-[#008d36] px-4 py-2 rounded-b-md shadow-lg flex items-center justify-center">
            <img src="/logo.jpg" alt="Europcar" className="h-[40px] md:h-[50px] object-contain" />
          </a>

          {/* Right Menu Items */}
          <div className="flex text-white text-sm font-bold items-center gap-6 mt-4">
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
                 <svg
                   className="w-5 h-5"
                   fill="none"
                   stroke="currentColor"
                   viewBox="0 0 24 24"
                 >
                   <path
                     strokeLinecap="round"
                     strokeLinejoin="round"
                     strokeWidth="2"
                     d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                   ></path>
                 </svg>{" "}
                 Fazer login
               </button>
            )}
            <span className="flex items-center gap-2 cursor-pointer hover:text-gray-300">
              <span className="bg-yellow-400 w-4 h-3 rounded-sm inline-block"></span>{" "}
              BR {/* Simplificado */}
            </span>
            <a href="https://www.europcar.com/pt-br/contact-us" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 cursor-pointer hover:text-gray-300">
              <svg
                className="w-5 h-5"
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
              </svg>{" "}
              Ajuda
            </a>
            <span className="flex items-center gap-2 cursor-pointer hover:text-gray-300 ml-2">
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M4 6h16M4 12h16M4 18h16"
                ></path>
              </svg>{" "}
              Menu
            </span>
          </div>
        </div>

        {/* IOF-free International Banner */}
        <div className="relative z-10 max-w-6xl mx-auto px-4 mt-8 flex justify-center">
          <div className="w-[95%] bg-white/10 backdrop-blur-sm border border-white/20 rounded pl-0 flex items-center shadow-lg cursor-pointer hover:bg-white/20 transition-colors">
            <div className="bg-[#008d36] text-white font-black text-[10px] md:text-xs py-2 px-4 shadow-sm flex-shrink-0">
              ✈️ INTERNACIONAL
            </div>
            <div className="flex-1 px-4 text-white font-bold text-sm">
              Reservas Internacionais livre de IOF,{" "}
              <span className="font-normal text-gray-300">
                com pagamentos on-line.
              </span>
            </div>
            <div className="pr-4 text-white text-sm font-bold flex items-center gap-1">
              Saiba mais{" "}
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M9 5l7 7-7 7"
                ></path>
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Hero Search Background Wrapper */}
      <div className="bg-[#1a1a1a] w-full pb-16 relative">
        <div className="w-[95%] max-w-6xl mx-auto relative -top-16 z-20">
          <HeroSearchForm />
        </div>

        {/* Bottom internal dark nav links */}
        <div className="max-w-6xl mx-auto px-4 mt-2 grid grid-cols-2 md:grid-cols-4 text-center pb-8 border-b border-gray-800">
          <a
            href="/reservation/searchbooking"
            className="text-white text-sm font-bold hover:text-europcar-green flex items-center justify-center gap-2"
          >
            Sobre suas Reservas <span>→</span>
          </a>
          <a
            href="https://www.europcar.com/en-us/loyalty-program" target="_blank" rel="noopener noreferrer"
            className="text-white text-sm font-bold hover:text-europcar-green flex items-center justify-center gap-2"
          >
            Member&apos;s Discount <span>→</span>
          </a>
          <a
            href="#"
            className="text-white text-sm font-bold hover:text-europcar-green flex items-center justify-center gap-2"
          >
            Promoções <span>→</span>
          </a>
          <a
            href="#"
            className="text-white text-sm font-bold hover:text-europcar-green flex items-center justify-center gap-2"
          >
            Para sua empresa <span>→</span>
          </a>
        </div>
      </div>


      {/* Frota Section — 6 carros nacionais */}
      <div className="bg-gray-50 py-16">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex items-center gap-3 mb-10">
            <div className="w-1 h-8 bg-[#008d36] rounded-full"></div>
            <div>
              <h2 className="text-2xl font-black text-gray-900">Nossa Frota</h2>
              <p className="text-sm text-gray-500 font-medium">Conheça os veículos disponíveis para aluguel</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                nome: "Fiat Mobi",
                categoria: "Mini",
                acriss: "MBMR",
                assentos: 4,
                portas: 4,
                cambio: "Manual",
                ar: true,
                img: "https://images.europcar.com/Fleet/EU/MBMR--MOBI.png",
              },
              {
                nome: "Fiat Argo",
                categoria: "Econômico",
                acriss: "EDMR",
                assentos: 5,
                portas: 4,
                cambio: "Manual",
                ar: true,
                img: "https://images.europcar.com/Fleet/EU/EDMR--ARGO.png",
              },
              {
                nome: "Volkswagen Polo",
                categoria: "Compacto",
                acriss: "CDMR",
                assentos: 5,
                portas: 4,
                cambio: "Manual",
                ar: true,
                img: "https://images.europcar.com/Fleet/EU/CDMR--POLO.png",
              },
              {
                nome: "Chevrolet Onix Plus",
                categoria: "Intermediário",
                acriss: "IDMR",
                assentos: 5,
                portas: 4,
                cambio: "Manual",
                ar: true,
                img: "https://images.europcar.com/Fleet/EU/IDMR--ONIX-PLUS.png",
              },
              {
                nome: "Jeep Renegade",
                categoria: "SUV Compacto",
                acriss: "CFAR",
                assentos: 5,
                portas: 4,
                cambio: "Automático",
                ar: true,
                img: "https://images.europcar.com/Fleet/EU/CFAR--RENEGADE.png",
              },
              {
                nome: "Toyota Corolla",
                categoria: "Sedan Premium",
                acriss: "FDAR",
                assentos: 5,
                portas: 4,
                cambio: "Automático",
                ar: true,
                img: "https://images.europcar.com/Fleet/EU/FDAR--COROLLA.png",
              },
            ].map((car, idx) => (
              <div key={idx} className="group bg-white rounded-xl border border-gray-100 overflow-hidden hover:shadow-lg hover:border-[#008d36]/30 transition-all duration-300">
                {/* Image */}
                <div className="h-40 bg-gradient-to-b from-gray-50 to-white flex items-center justify-center p-4">
                  <img
                    src={carImages[car.acriss] || car.img}
                    alt={car.nome}
                    className="max-h-full max-w-full object-contain group-hover:scale-105 transition-transform duration-500"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = `https://cdn.imagin.studio/getImage?customer=europcar&make=${car.nome.split(' ')[0]}&modelFamily=${car.nome.split(' ').slice(1).join('-')}&paintId=pspc0001&angle=01&width=400`;
                    }}
                  />
                </div>

                {/* Info */}
                <div className="p-5 border-t border-gray-100">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-black text-gray-900">{car.nome}</h3>
                    <span className="text-[10px] bg-[#008d36]/10 text-[#008d36] font-bold px-2 py-0.5 rounded-full">{car.categoria}</span>
                  </div>
                  <span className="text-[10px] bg-gray-100 text-gray-500 font-bold px-2 py-0.5 rounded-full">{car.acriss}</span>

                  <div className="flex items-center gap-3 mt-3 text-xs text-gray-500 font-medium">
                    <span>👤 {car.assentos}</span>
                    <span>🚪 {car.portas}</span>
                    <span>⚙️ {car.cambio}</span>
                    {car.ar && <span>❄️ A/C</span>}
                  </div>

                  <div className="mt-4 text-xs text-gray-400">
                    {car.nome} ou similar
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Vantagens Section */}
      <div className="max-w-4xl mx-auto px-4 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 text-center">
          <div className="flex flex-col items-center">
            <div className="w-12 h-12 mb-4 bg-gray-100 rounded-full flex items-center justify-center">
              ⭐
            </div>
            <h3 className="font-black text-gray-900 mb-2">
              Vantagens e benefícios
            </h3>
            <p className="text-sm text-gray-500 mb-6">
              Aproveite as vantagens Exclusivas (programa de fidelidade)
            </p>
            <a 
              href="https://www.europcar.com/en-us/loyalty-program" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="bg-[#ffcc00] hover:bg-yellow-500 text-gray-900 font-bold py-2 px-6 rounded w-full block text-center"
            >
              Privilege-Programa de fidelidade
            </a>
          </div>

          <div className="flex flex-col items-center">
            <div className="w-12 h-12 mb-4 bg-gray-100 rounded-full flex items-center justify-center">
              🏠
            </div>
            <h3 className="font-black text-gray-900 mb-2">Aluguel Flexível</h3>
            <p className="text-sm text-gray-500 mb-6">
              Ajuste a escolha e período adequado às suas necessidades.
            </p>
            <button className="bg-[#ffcc00] hover:bg-yellow-500 text-gray-900 font-bold py-2 px-6 rounded w-full">
              Descobrir
            </button>
          </div>
        </div>
      </div>

      {/* Presente no mundo */}
      <div className="bg-[#f2f2f2] border-t border-gray-200">
        <div className="max-w-6xl mx-auto px-4 py-16 flex flex-col md:flex-row">
          <div className="md:w-1/3 pr-8 mb-8 md:mb-0">
            <div className="w-12 h-12 mb-4 bg-[#008d36] rounded text-white flex items-center justify-center font-bold">
              🗺️
            </div>
            <h3 className="font-black text-gray-900 text-xl mb-2">
              Presente em todo o mundo
            </h3>
            <p className="text-sm text-gray-500">
              <span className="font-bold text-[#008d36]">3 835</span>{" "}
              Localidades Europcar em{" "}
              <span className="font-bold text-[#008d36]">+140</span> países.
            </p>
            <a
              href="#"
              className="text-sm text-[#008d36] font-bold mt-4 inline-block"
            >
              Ver tudo
            </a>
          </div>

          <div className="md:w-2/3 grid grid-cols-2 md:grid-cols-4 gap-4 text-xs font-semibold text-gray-700">
            <div>
              <h4 className="font-black text-black mb-3 text-sm">No Brasil</h4>
              <ul className="space-y-2">
                <li>São Paulo</li>
                <li>Guarulhos</li>
                <li>Campinas</li>
                <li>João Pessoa</li>
              </ul>
            </div>
            <div>
              <h4 className="font-black text-black mb-3 text-sm">
                Nas Américas
              </h4>
              <ul className="space-y-2">
                <li>Uruguai</li>
                <li>Argentina</li>
                <li>Estados Unidos</li>
                <li>Costa Rica</li>
              </ul>
            </div>
            <div>
              <h4 className="font-black text-black mb-3 text-sm">Na Europa</h4>
              <ul className="space-y-2">
                <li>Portugal</li>
                <li>Itália</li>
                <li>Espanha</li>
                <li>França</li>
              </ul>
            </div>
            <div>
              <h4 className="font-black text-black mb-3 text-sm">
                Outros Continentes
              </h4>
              <ul className="space-y-2">
                <li>Austrália</li>
                <li>Nova Zelândia</li>
                <li>África do Sul</li>
                <li>Turquia</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
