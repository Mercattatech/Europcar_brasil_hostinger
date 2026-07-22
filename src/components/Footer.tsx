"use client";

import { useState, useEffect } from "react";

export default function Footer() {
  const year = new Date().getFullYear();
  const [termsAvailable, setTermsAvailable] = useState<{reserva: boolean, pais: boolean, paisUrl: string, brasil: boolean}>({reserva: false, pais: false, paisUrl: '', brasil: false});

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

  return (
    <>

      <footer className="bg-[#1a1a1a] text-gray-400 border-t border-gray-800">
        {/* Main links grid */}
      <div className="max-w-6xl mx-auto px-4 py-10">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Col 1 - Logo + branding */}
          <div>
            <img src="/logo.jpg" alt="Europcar" className="h-8 object-contain mb-4 brightness-200" />
            <p className="text-xs leading-relaxed">
              Europcar Brasil — Plataforma oficial de aluguel de veículos.
              Presente em mais de 140 países com uma frota diversificada
              para atender suas necessidades.
            </p>
          </div>

          {/* Col 2 - Europcar Internacional */}
          <div>
            <h4 className="text-white text-sm font-bold mb-3">Europcar Internacional</h4>
            <p className="text-[10px] text-gray-500 font-bold uppercase mb-2">Informações legais</p>
            <ul className="space-y-2 text-xs">
              <li><a href="https://www.europcar.com/terms-and-conditions" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">Informação Legal</a></li>
              <li><a href="https://www.europcar.com/damage-management-policy" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">Política de Gerenciamento de Danos</a></li>
              <li><a href="https://www.europcar.com/deposit-policy" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">Política de Depósito</a></li>
              <li><a href="https://www.europcar.com/privacy-policy" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">Segurança e Política de Privacidade</a></li>
              <li><a href="https://www.europcar.com/terms-and-conditions" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">Termos e Condições</a></li>
            </ul>
          </div>

          {/* Col 3 - Europcar Brasil */}
          <div>
            <h4 className="text-white text-sm font-bold mb-3">Europcar Brasil</h4>
            <p className="text-[10px] text-gray-500 font-bold uppercase mb-2">Mais informações</p>
            <ul className="space-y-2 text-xs">
              <li><a href="/reservation/vehicles" className="hover:text-white transition-colors">Localidades agências no Brasil</a></li>
              <li><a href="https://www.europcar.com/pt-br/rental-agreement" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">Contrato de locação</a></li>
              <li><a href="https://www.europcar.com/pt-br/legal-pages/termsAndConditions" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">Termos e Condições</a></li>
            </ul>

            {/* Platform Terms Links */}
            {(termsAvailable.reserva || termsAvailable.pais || termsAvailable.brasil) && (
              <>
                <p className="text-[10px] text-gray-500 font-bold uppercase mb-2 mt-4">Termos da Plataforma</p>
                <ul className="space-y-2 text-xs">
                  {termsAvailable.reserva && (
                    <li><a href="/api/terms/reserva" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">📄 Termos da Reserva</a></li>
                  )}
                  {termsAvailable.pais && (
                    <li><a href={termsAvailable.paisUrl} target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">🌍 Termos do País de Destino</a></li>
                  )}
                  {termsAvailable.brasil && (
                    <li><a href="/api/terms/brasil" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">🇧🇷 Reserva Online — Brasil</a></li>
                  )}
                </ul>
              </>
            )}
          </div>

          {/* Col 4 - Contatos */}
          <div>
            <h4 className="text-white text-sm font-bold mb-3">Contatos</h4>

            {/* Contact buttons */}
            <div className="flex flex-col gap-2 mt-4">
              <a href="mailto:reservas@europcar.com.br" className="inline-flex items-center gap-2 bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white text-xs font-bold px-3 py-2 rounded-lg transition-colors w-fit">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                reservas@europcar.com.br
              </a>
              <a href="https://api.whatsapp.com/send?phone=551155420500" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 bg-[#25d366]/20 hover:bg-[#25d366]/30 text-[#25d366] text-xs font-bold px-3 py-2 rounded-lg transition-colors w-fit">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                (11) 5542-0500
              </a>
            </div>

            {/* Social media */}
            <div className="flex gap-3 mt-4">
              <a href="https://www.instagram.com/europcar_brasil/" target="_blank" rel="noopener noreferrer" className="text-gray-500 hover:text-white transition-colors" title="Instagram">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>
              </a>
              <a href="https://www.facebook.com/europcarbr/" target="_blank" rel="noopener noreferrer" className="text-gray-500 hover:text-white transition-colors" title="Facebook">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
              </a>
              <a href="https://www.linkedin.com/company/europcar-brasil/?viewAsMember=true" target="_blank" rel="noopener noreferrer" className="text-gray-500 hover:text-white transition-colors" title="LinkedIn">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* LGPD Disclaimer */}
      <div className="border-t border-gray-800">
        <div className="max-w-6xl mx-auto px-4 py-6">
          <div className="bg-gray-900/60 border border-gray-700 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <svg className="w-6 h-6 text-blue-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <h5 className="text-white text-xs font-bold uppercase tracking-wide mb-1">
                  Proteção de Dados — LGPD (Lei nº 13.709/2018)
                </h5>
                <p className="text-[11px] leading-relaxed text-gray-400">
                  Ao utilizar este site e preencher seus dados pessoais para efetivação de reserva, você declara
                  estar ciente e de acordo que as informações fornecidas (nome, e-mail, telefone, CPF e dados de
                  pagamento) serão coletadas e tratadas exclusivamente para a finalidade de processamento da sua
                  reserva de veículo junto à Europcar, conforme previsto na Lei Geral de Proteção de Dados
                  Pessoais (LGPD — Lei nº 13.709/2018). Seus dados não serão compartilhados com terceiros para
                  finalidades distintas e serão armazenados em ambiente seguro com criptografia. Você pode
                  solicitar a exclusão dos seus dados a qualquer momento entrando em contato conosco.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Copyright */}
      <div className="border-t border-gray-800">
        <div className="max-w-6xl mx-auto px-4 py-4 flex flex-col md:flex-row justify-between items-center gap-2">
          <p className="text-[10px] text-gray-500 text-center md:text-left">
            © {year} Europcar Brasil. Todos os direitos reservados.<br />
            CNPJ: 60.783.203/0001-23
          </p>
          <p className="text-[10px] text-gray-600">
            Desenvolvido por{" "}
            <a href="https://mercattatech.com" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-white transition-colors">
              Mercatta Tech
            </a>
          </p>
        </div>
      </div>
    </footer>
    </>
  );
}
