"use client";

import { useState } from "react";
import Link from "next/link";

// Same COUNTRIES list used in the main search form
const COUNTRIES = [
  { code: "BR", name: "Brasil", emoji: "🇧🇷" },
  { code: "AR", name: "Argentina", emoji: "🇦🇷" },
  { code: "US", name: "Estados Unidos", emoji: "🇺🇸" },
  { code: "CA", name: "Canadá", emoji: "🇨🇦" },
  { code: "MX", name: "México", emoji: "🇲🇽" },
  { code: "DE", name: "Alemanha", emoji: "🇩🇪" },
  { code: "FR", name: "França", emoji: "🇫🇷" },
  { code: "IT", name: "Itália", emoji: "🇮🇹" },
  { code: "ES", name: "Espanha", emoji: "🇪🇸" },
  { code: "PT", name: "Portugal", emoji: "🇵🇹" },
  { code: "GB", name: "Reino Unido", emoji: "🇬🇧" },
  { code: "UY", name: "Uruguai", emoji: "🇺🇾" },
  { code: "CL", name: "Chile", emoji: "🇨🇱" },
  { code: "CO", name: "Colômbia", emoji: "🇨🇴" },
  { code: "PE", name: "Peru", emoji: "🇵🇪" },
  { code: "PY", name: "Paraguai", emoji: "🇵🇾" },
  { code: "BO", name: "Bolívia", emoji: "🇧🇴" },
  { code: "JP", name: "Japão", emoji: "🇯🇵" },
  { code: "AU", name: "Austrália", emoji: "🇦🇺" },
  { code: "ZA", name: "África do Sul", emoji: "🇿🇦" },
];

export default function CheckInOnline() {
  // Step control
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Step 1 - Search
  const [resNumber, setResNumber] = useState("");
  const [email, setEmail] = useState("");
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [reservationData, setReservationData] = useState<any>(null);

  // Step 2 - Driver data / CNH
  const [cnhNumero, setCnhNumero] = useState("");
  const [cnhValidade, setCnhValidade] = useState("");
  const [cnhCidade, setCnhCidade] = useState("");
  const [paisEmissao, setPaisEmissao] = useState("BR");
  const [submitLoading, setSubmitLoading] = useState(false);
  const [submitError, setSubmitError] = useState("");

  // Step 3 - Success
  const [driverID, setDriverID] = useState<string | null>(null);

  // Mask for CNH expiry: MM/AAAA
  const maskCnhValidade = (value: string) => {
    let r = value.replace(/\D/g, "");
    if (r.length > 6) r = r.substring(0, 6);
    if (r.length > 2) {
      return `${r.substring(0, 2)}/${r.substring(2)}`;
    }
    return r;
  };

  // Step 1: Search reservation
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setSearchLoading(true);
    setSearchError("");

    try {
      const res = await fetch("/api/reservas/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, resNumber }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Reserva não encontrada");
      }

      setReservationData(data);
      setStep(2);
    } catch (err: any) {
      setSearchError(err.message);
    } finally {
      setSearchLoading(false);
    }
  };

  // Step 2: Submit check-in with driver/license data
  const handleSubmitCheckin = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitLoading(true);
    setSubmitError("");

    try {
      const customerData = reservationData?.customer || {};
      const res = await fetch("/api/europcar/checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resNumber,
          firstName: customerData.nome || "",
          lastName: customerData.sobrenome || "",
          email: customerData.email || email,
          phone: customerData.telefone || "",
          cpf: customerData.cpf || "",
          cnhNumero,
          cnhValidade,
          cnhCidade,
          paisEmissao,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Erro ao processar check-in");
      }

      setDriverID(data.driverID);
      setStep(3);
    } catch (err: any) {
      setSubmitError(err.message);
    } finally {
      setSubmitLoading(false);
    }
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr || dateStr.length < 8) return dateStr;
    return `${dateStr.substring(6, 8)}/${dateStr.substring(4, 6)}/${dateStr.substring(0, 4)}`;
  };

  return (
    <div className="min-h-screen bg-white font-sans flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 h-20 flex justify-between items-center">
          <Link href="/">
            <div className="bg-[#008d36] px-4 py-2 flex items-center justify-center">
              <img src="/logo.jpg" alt="Europcar" className="h-[40px] md:h-[50px] object-contain" />
            </div>
          </Link>
          <div className="flex items-center gap-6 text-sm font-bold text-gray-900">
            <Link href="/reservation/searchbooking" className="hover:text-[#008d36] flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
              Minhas Reservas
            </Link>
            <a href="https://www.europcar.com/pt-br/contact-us" target="_blank" rel="noopener noreferrer" className="hover:text-[#008d36] flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
              Ajuda
            </a>
          </div>
        </div>
      </header>

      <div className="flex-1 flex flex-col items-center pt-8 px-4 pb-20">
        {/* Back Button */}
        <div className="w-full max-w-2xl mb-6 flex items-center">
          <Link href="/" className="flex items-center text-sm font-bold text-gray-900 hover:text-[#008d36]">
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>
            Voltar
          </Link>
        </div>

        {/* Progress Steps */}
        <div className="w-full max-w-2xl mb-8">
          <div className="flex items-center justify-center gap-0">
            {[
              { num: 1, label: "Localizar Reserva" },
              { num: 2, label: "Dados da Habilitação" },
              { num: 3, label: "Concluído" },
            ].map((s, i) => (
              <div key={s.num} className="flex items-center">
                <div className="flex flex-col items-center">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-sm transition-all ${
                      step >= s.num
                        ? "bg-[#008d36] text-white shadow-lg"
                        : "bg-gray-200 text-gray-500"
                    }`}
                  >
                    {step > s.num ? (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>
                    ) : (
                      s.num
                    )}
                  </div>
                  <span className={`text-[11px] font-bold mt-1.5 ${step >= s.num ? "text-[#008d36]" : "text-gray-400"}`}>
                    {s.label}
                  </span>
                </div>
                {i < 2 && (
                  <div className={`w-16 md:w-24 h-0.5 mx-2 mb-5 ${step > s.num ? "bg-[#008d36]" : "bg-gray-200"}`} />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* ========== STEP 1: Localizar Reserva ========== */}
        {step === 1 && (
          <div className="w-full max-w-2xl">
            <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
              <div className="flex flex-col md:flex-row">
                <div className="p-8 md:w-1/2">
                  <h1 className="text-2xl font-black text-gray-900 mb-2">Check-in Online</h1>
                  <p className="text-sm text-gray-500 mb-6">
                    Evite filas no balcão. Preencha seus dados e acelere a retirada do veículo.
                  </p>

                  <form onSubmit={handleSearch} className="space-y-5">
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">
                        Número da Reserva
                      </label>
                      <input
                        required
                        type="text"
                        value={resNumber}
                        onChange={(e) => setResNumber(e.target.value)}
                        placeholder="Ex: 8501239853"
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#008d36] focus:border-[#008d36] outline-none transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">
                        E-mail do Locatário
                      </label>
                      <input
                        required
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="seu@email.com"
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#008d36] focus:border-[#008d36] outline-none transition-all"
                      />
                    </div>

                    {searchError && (
                      <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm font-bold border border-red-200">
                        {searchError}
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={searchLoading || !resNumber || !email}
                      className="w-full bg-[#008d36] hover:bg-[#007a2d] disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-bold py-3.5 px-8 rounded-lg transition-colors flex justify-center items-center gap-2 shadow-md"
                    >
                      {searchLoading ? (
                        <>
                          <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                          </svg>
                          Buscando...
                        </>
                      ) : (
                        <>
                          Avançar para Documentos
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3"></path></svg>
                        </>
                      )}
                    </button>
                  </form>
                </div>

                <div className="bg-green-50 p-8 md:w-1/2 border-l border-green-100 flex flex-col justify-center">
                  <h3 className="text-xl font-bold text-gray-900 mb-4">Vantagens do Check-in Online:</h3>
                  <ul className="space-y-4">
                    <li className="flex items-start gap-3">
                      <div className="bg-[#008d36] text-white rounded-full p-1 mt-0.5 shrink-0">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                      </div>
                      <div>
                        <p className="font-bold text-gray-800">Balcão Prioritário</p>
                        <p className="text-sm text-gray-500">Apresente apenas o QRCode no balcão de Check-in Express.</p>
                      </div>
                    </li>
                    <li className="flex items-start gap-3">
                      <div className="bg-[#008d36] text-white rounded-full p-1 mt-0.5 shrink-0">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                      </div>
                      <div>
                        <p className="font-bold text-gray-800">Menos Burocracia</p>
                        <p className="text-sm text-gray-500">Seu contrato de aluguel será enviado digitalmente.</p>
                      </div>
                    </li>
                    <li className="flex items-start gap-3">
                      <div className="bg-[#008d36] text-white rounded-full p-1 mt-0.5 shrink-0">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                      </div>
                      <div>
                        <p className="font-bold text-gray-800">Retirada Rápida</p>
                        <p className="text-sm text-gray-500">Com documentos pré-aprovados, a retirada leva minutos.</p>
                      </div>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========== STEP 2: Dados da Habilitação ========== */}
        {step === 2 && reservationData && (
          <div className="w-full max-w-2xl space-y-6">
            {/* Reservation Summary Card */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="bg-[#008d36] text-white p-4 flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider opacity-80">Reserva</span>
                  <h2 className="text-xl font-black tracking-wider">{resNumber}</h2>
                </div>
                <span className="bg-white/20 text-white text-[10px] font-bold uppercase px-3 py-1 rounded">
                  {reservationData.status || "Confirmada"}
                </span>
              </div>
              <div className="p-5 grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="text-[10px] font-bold text-gray-400 uppercase block">Retirada</span>
                  <span className="font-bold text-gray-900">{formatDate(reservationData.pickupDate)}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-gray-400 uppercase block">Devolução</span>
                  <span className="font-bold text-gray-900">{formatDate(reservationData.returnDate)}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-gray-400 uppercase block">Veículo</span>
                  <span className="font-bold text-gray-900 uppercase">{reservationData.car || "Padrão"}</span>
                </div>
              </div>
            </div>

            {/* License Form */}
            <form onSubmit={handleSubmitCheckin} className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 md:p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-[#008d36]/10 rounded-full flex items-center justify-center shrink-0">
                  <svg className="w-5 h-5 text-[#008d36]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-lg font-black text-gray-900">Dados da Habilitação</h2>
                  <p className="text-xs text-gray-500">Preencha os dados da sua CNH para completar o check-in. <span className="text-gray-400">(Opcional)</span></p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">
                      Nº da Habilitação <span className="text-gray-400 font-normal">(Opcional)</span>
                    </label>
                    <input
                      type="text"
                      value={cnhNumero}
                      onChange={(e) => setCnhNumero(e.target.value)}
                      placeholder="00000000000"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#008d36] focus:border-[#008d36] outline-none transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">
                      Validade da CNH <span className="text-gray-400 font-normal">(Opcional)</span>
                    </label>
                    <input
                      type="text"
                      value={cnhValidade}
                      onChange={(e) => setCnhValidade(maskCnhValidade(e.target.value))}
                      placeholder="MM/AAAA"
                      maxLength={7}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#008d36] focus:border-[#008d36] outline-none transition-all"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">
                      Cidade de Emissão <span className="text-gray-400 font-normal">(Opcional)</span>
                    </label>
                    <input
                      type="text"
                      value={cnhCidade}
                      onChange={(e) => setCnhCidade(e.target.value)}
                      placeholder="São Paulo"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#008d36] focus:border-[#008d36] outline-none transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">
                      Eu resido em
                    </label>
                    <div className="relative">
                      <select
                        value={paisEmissao}
                        onChange={(e) => setPaisEmissao(e.target.value)}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#008d36] focus:border-[#008d36] outline-none transition-all appearance-none bg-white pr-10"
                      >
                        {COUNTRIES.map((c) => (
                          <option key={c.code} value={c.code}>
                            {c.emoji} {c.name}
                          </option>
                        ))}
                      </select>
                      <svg className="w-5 h-5 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>
                </div>
              </div>

              {submitError && (
                <div className="mt-4 bg-red-50 text-red-600 p-3 rounded-lg text-sm font-bold border border-red-200">
                  {submitError}
                </div>
              )}

              <div className="flex gap-3 mt-8">
                <button
                  type="button"
                  onClick={() => { setStep(1); setReservationData(null); }}
                  className="px-6 py-3 border border-gray-300 rounded-lg font-bold text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Voltar
                </button>
                <button
                  type="submit"
                  disabled={submitLoading}
                  className="flex-1 bg-[#008d36] hover:bg-[#007a2d] disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-bold py-3.5 px-8 rounded-lg transition-colors flex justify-center items-center gap-2 shadow-md"
                >
                  {submitLoading ? (
                    <>
                      <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Enviando...
                    </>
                  ) : (
                    <>
                      Concluir Check-in
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ========== STEP 3: Success ========== */}
        {step === 3 && (
          <div className="w-full max-w-lg">
            <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-10 text-center border-t-8 border-[#008d36]">
              <div className="w-20 h-20 bg-green-100 text-[#008d36] rounded-full flex items-center justify-center mx-auto mb-6">
                <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                </svg>
              </div>

              <h1 className="text-2xl font-black text-gray-900 mb-2">
                Check-in Concluído!
              </h1>
              <p className="text-gray-600 mb-6 text-sm">
                Seus dados foram enviados com sucesso para a Europcar. Na retirada do veículo, apresente seu documento de identidade original no balcão.
              </p>

              <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 mb-6">
                <span className="text-xs font-bold text-gray-500 uppercase tracking-widest block mb-1">
                  Reserva
                </span>
                <span className="text-3xl font-black text-[#008d36] tracking-widest">
                  {resNumber}
                </span>
                {driverID && (
                  <div className="mt-3">
                    <span className="text-xs font-bold text-gray-500 uppercase tracking-widest block mb-1">
                      Driver ID
                    </span>
                    <span className="text-lg font-black text-gray-900">
                      {driverID}
                    </span>
                  </div>
                )}
              </div>

              <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6 text-left">
                <p className="text-xs font-bold text-green-800 mb-2">📋 O que levar na retirada:</p>
                <ul className="text-xs text-green-700 space-y-1">
                  <li>• Documento de identidade (RG ou Passaporte)</li>
                  <li>• CNH dentro da validade</li>
                  <li>• Cartão de crédito em nome do condutor</li>
                </ul>
              </div>

              <div className="flex gap-3">
                <Link
                  href="/"
                  className="flex-1 font-bold text-[#008d36] hover:bg-green-50 border border-[#008d36] py-3 px-6 rounded-lg transition-colors text-center"
                >
                  Voltar ao Início
                </Link>
                <Link
                  href="/reservation/searchbooking"
                  className="flex-1 font-bold text-white bg-[#008d36] hover:bg-[#007a2d] py-3 px-6 rounded-lg transition-colors text-center"
                >
                  Minhas Reservas
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="bg-black py-6 mt-auto">
        <div className="max-w-7xl mx-auto px-4 flex flex-col md:flex-row justify-between items-center text-xs font-bold text-white">
          <div className="flex items-center flex-wrap gap-4 mb-4 md:mb-0 text-gray-400">
            <span>©Europcar 2026</span>
            <a href="#" className="hover:underline text-white">Termos e Condições</a>
            <a href="https://www.europcar.com/pt-br/contact-us" target="_blank" rel="noopener noreferrer" className="hover:underline text-white">Contato</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
