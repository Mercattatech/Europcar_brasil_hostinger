export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="bg-[#1a1a1a] text-gray-400 border-t border-gray-800">
      {/* Links e info */}
      <div className="max-w-6xl mx-auto px-4 py-10">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Col 1 - Marca */}
          <div>
            <img src="/logo.jpg" alt="Europcar" className="h-8 object-contain mb-4 brightness-200" />
            <p className="text-xs leading-relaxed">
              Europcar Brasil — Plataforma oficial de aluguel de veículos.
              Presente em mais de 140 países com uma frota diversificada
              para atender suas necessidades.
            </p>
          </div>

          {/* Col 2 - Links */}
          <div>
            <h4 className="text-white text-sm font-bold mb-3">Links Úteis</h4>
            <ul className="space-y-2 text-xs">
              <li><a href="/" className="hover:text-white transition-colors">Início</a></li>
              <li><a href="/reservation/searchbooking" className="hover:text-white transition-colors">Consultar Reserva</a></li>
              <li><a href="/promocoes" className="hover:text-white transition-colors">Promoções</a></li>
              <li><a href="https://www.europcar.com/pt-br/contact-us" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">Ajuda e Contato</a></li>
            </ul>
          </div>

          {/* Col 3 - Segurança */}
          <div>
            <h4 className="text-white text-sm font-bold mb-3">Segurança</h4>
            <div className="flex items-start gap-2 mb-3">
              <svg className="w-5 h-5 text-green-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              <p className="text-xs leading-relaxed">
                Site protegido com criptografia SSL. Seus dados estão seguros durante toda a navegação e transação.
              </p>
            </div>
            <div className="flex items-start gap-2">
              <svg className="w-5 h-5 text-green-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              <p className="text-xs leading-relaxed">
                Pagamentos processados com segurança via Cielo, líder em pagamentos no Brasil.
              </p>
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
          <p className="text-[10px] text-gray-500">
            © {year} Europcar Brasil. Todos os direitos reservados.
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
  );
}
