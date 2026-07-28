"use client";

import { useState, useEffect } from "react";

export default function Footer() {
  const year = new Date().getFullYear();
  const [termsAvailable, setTermsAvailable] = useState<{reserva: boolean, pais: boolean, paisUrl: string, brasil: boolean}>({reserva: false, pais: false, paisUrl: '', brasil: false});
  const [openSection, setOpenSection] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/admin/terms')
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) {
          const paisDoc = data.find((d: any) => d.type === 'PAIS');
          setTermsAvailable({
            reserva: data.some((d: any) => d.type === 'RESERVA'),
            pais: !!paisDoc,
            paisUrl: paisDoc?.mimeType === 'text/uri-list' ? paisDoc.fileName : '/api/terms/pais',
            brasil: data.some((d: any) => d.type === 'BRASIL_ONLINE'),
          });
        }
      })
      .catch(() => {});
  }, []);

  const toggleSection = (section: string) => {
    setOpenSection(openSection === section ? null : section);
  };

  const FooterAccordion = ({ id, title, children }: { id: string; title: string; children: React.ReactNode }) => (
    <div>
      {/* Mobile: accordion, Desktop: always open */}
      <button
        onClick={() => toggleSection(id)}
        className="md:hidden flex items-center justify-between w-full py-3 text-left"
      >
        <h4 className="text-white text-sm font-bold">{title}</h4>
        <svg className={`w-4 h-4 text-gray-500 transition-transform ${openSection === id ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      <h4 className="hidden md:block text-white text-sm font-bold mb-3">{title}</h4>
      <div className={`${openSection === id ? 'block' : 'hidden'} md:block pb-4 md:pb-0`}>
        {children}
      </div>
    </div>
  );

  return (
    <>
      <footer className="bg-[#1a1a1a] text-gray-400 border-t border-gray-800">
        <div className="max-w-6xl mx-auto px-4 py-8 md:py-10">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-0 md:gap-8">
            {/* Col 1 - Logo + branding */}
            <div className="mb-6 md:mb-0 text-center md:text-left">
              <img src="/logo.jpg" alt="Europcar" className="h-8 object-contain mb-4 brightness-200 mx-auto md:mx-0" />
              <p className="text-xs leading-relaxed">
                Europcar Brasil — Plataforma oficial de aluguel de veículos.
                Presente em mais de 140 países com uma frota diversificada
                para atender suas necessidades.
              </p>
            </div>

            {/* Col 2 - Europcar Internacional */}
            <FooterAccordion id="international" title="Europcar Internacional">
              <p className="text-[10px] text-gray-500 font-bold uppercase mb-2">Informações legais</p>
              <ul className="space-y-2 text-xs">
                <li><a href="https://www.europcar.com/terms-and-conditions" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors py-1 block">Informação Legal</a></li>
                <li><a href="https://www.europcar.com/damage-management-policy" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors py-1 block">Política de Gerenciamento de Danos</a></li>
                <li><a href="https://www.europcar.com/deposit-policy" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors py-1 block">Política de Depósito</a></li>
                <li><a href="https://www.europcar.com/privacy-policy" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors py-1 block">Segurança e Política de Privacidade</a></li>
                <li><a href="https://www.europcar.com/terms-and-conditions" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors py-1 block">Termos e Condições</a></li>
              </ul>
            </FooterAccordion>

            {/* Col 3 - Europcar Brasil */}
            <FooterAccordion id="brasil" title="Europcar Brasil">
              <p className="text-[10px] text-gray-500 font-bold uppercase mb-2">Mais informações</p>
              <ul className="space-y-2 text-xs">
                {termsAvailable.reserva && (
                  <li><a href="/termos/reserva" className="hover:text-white transition-colors py-1 block">Condições Gerais de Reserva</a></li>
                )}
                {termsAvailable.pais && (
                  <li><a href={termsAvailable.paisUrl} target={termsAvailable.paisUrl.startsWith('http') ? '_blank' : undefined} rel="noopener noreferrer" className="hover:text-white transition-colors py-1 block">Condições Gerais — País</a></li>
                )}
                {termsAvailable.brasil && (
                  <li><a href="/termos/brasil-online" className="hover:text-white transition-colors py-1 block">Condições — Brasil Online</a></li>
                )}
                <li><a href="https://www.europcar.com/pt-br/contact-us" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors py-1 block">Contato / Ajuda</a></li>
                <li><a href="/filiais" className="hover:text-white transition-colors py-1 block">Nossas Filiais</a></li>
              </ul>
            </FooterAccordion>

            {/* Col 4 - Atendimento */}
            <FooterAccordion id="atendimento" title="Atendimento">
              <p className="text-[10px] text-gray-500 font-bold uppercase mb-2">Canais</p>
              <ul className="space-y-2 text-xs">
                <li className="flex items-center gap-2">
                  <span>📧</span>
                  <a href="mailto:reservas@europcar.com.br" className="hover:text-white transition-colors py-1">reservas@europcar.com.br</a>
                </li>
                <li className="flex items-center gap-2">
                  <span>📞</span>
                  <a href="tel:+551140032055" className="hover:text-white transition-colors py-1">(11) 4003-2055</a>
                </li>
                <li className="flex items-center gap-2">
                  <span>💬</span>
                  <span>Seg-Sex: 8h às 20h</span>
                </li>
              </ul>
              <div className="flex gap-3 mt-4">
                <a href="https://www.facebook.com/Europcar" target="_blank" rel="noopener noreferrer" className="w-9 h-9 bg-gray-800 hover:bg-[#008d36] rounded-lg flex items-center justify-center transition-colors">
                  <span className="text-sm">f</span>
                </a>
                <a href="https://www.instagram.com/europcar/" target="_blank" rel="noopener noreferrer" className="w-9 h-9 bg-gray-800 hover:bg-[#008d36] rounded-lg flex items-center justify-center transition-colors">
                  <span className="text-sm">📷</span>
                </a>
                <a href="https://twitter.com/Europcar" target="_blank" rel="noopener noreferrer" className="w-9 h-9 bg-gray-800 hover:bg-[#008d36] rounded-lg flex items-center justify-center transition-colors">
                  <span className="text-sm">𝕏</span>
                </a>
              </div>
            </FooterAccordion>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="border-t border-gray-800">
          <div className="max-w-6xl mx-auto px-4 py-4 flex flex-col md:flex-row items-center justify-between gap-2">
            <p className="text-[10px] md:text-xs text-gray-600 text-center md:text-left">
              © {year} Europcar Brasil — Grupo Mercatta. Todos os direitos reservados.
            </p>
            <p className="text-[10px] text-gray-700 text-center">
              Europcar™ é marca registrada do Europcar Groupe S.A.
            </p>
          </div>
        </div>
      </footer>
    </>
  );
}
