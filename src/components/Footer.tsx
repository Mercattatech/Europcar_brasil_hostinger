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
                  <span className="text-green-400">💬</span>
                  <a href="https://wa.me/551140032055" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors py-1">WhatsApp: (11) 4003-2055</a>
                </li>
                <li className="flex items-center gap-2">
                  <span>🕐</span>
                  <span>Seg-Sex: 8h às 20h</span>
                </li>
              </ul>
              <div className="flex gap-3 mt-4">
                {/* Facebook */}
                <a href="https://www.facebook.com/Europcar" target="_blank" rel="noopener noreferrer" className="w-9 h-9 bg-gray-800 hover:bg-[#1877f2] rounded-lg flex items-center justify-center transition-colors" title="Facebook">
                  <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.41c0-3.025 1.792-4.697 4.533-4.697 1.312 0 2.686.236 2.686.236v2.97h-1.513c-1.491 0-1.956.931-1.956 1.886v2.268h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073z"/></svg>
                </a>
                {/* Instagram */}
                <a href="https://www.instagram.com/europcar/" target="_blank" rel="noopener noreferrer" className="w-9 h-9 bg-gray-800 hover:bg-gradient-to-br hover:from-[#f09433] hover:via-[#e6683c] hover:to-[#833ab4] rounded-lg flex items-center justify-center transition-colors" title="Instagram">
                  <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>
                </a>
                {/* X / Twitter */}
                <a href="https://twitter.com/Europcar" target="_blank" rel="noopener noreferrer" className="w-9 h-9 bg-gray-800 hover:bg-black rounded-lg flex items-center justify-center transition-colors" title="X (Twitter)">
                  <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.748l7.73-8.835L1.254 2.25H8.08l4.261 5.635zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                </a>
                {/* WhatsApp */}
                <a href="https://wa.me/551140032055" target="_blank" rel="noopener noreferrer" className="w-9 h-9 bg-gray-800 hover:bg-[#25d366] rounded-lg flex items-center justify-center transition-colors" title="WhatsApp">
                  <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
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
