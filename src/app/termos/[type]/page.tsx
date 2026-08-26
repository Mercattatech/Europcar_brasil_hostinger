"use client";

import { useParams } from "next/navigation";

const TERMS_MAP: Record<string, { title: string; apiPath: string }> = {
  reserva: { title: "Termos e Condições da Reserva", apiPath: "/api/terms/reserva" },
  pais: { title: "Termos e Condições do País de Destino", apiPath: "/api/terms/pais" },
  brasil: { title: "Termos de Reserva Online — Brasil", apiPath: "/api/terms/brasil" },
};

export default function TermosViewPage() {
  const params = useParams();
  const type = (params.type as string)?.toLowerCase();
  const config = TERMS_MAP[type];

  if (!config) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Documento não encontrado</h1>
          <p className="text-gray-500">O tipo de documento solicitado não é válido.</p>
          <a href="/" className="text-[#008d36] font-bold mt-4 inline-block hover:underline">← Voltar ao início</a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 py-4 px-6 shadow-sm">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <a href="/">
              <img src="/logo.jpg" alt="Europcar" className="h-8 object-contain" />
            </a>
            <div className="w-px h-6 bg-gray-300" />
            <h1 className="text-lg font-bold text-gray-900">{config.title}</h1>
          </div>
          <a href="/" className="text-sm text-[#008d36] font-bold hover:underline">← Voltar</a>
        </div>
      </div>

      {/* PDF/Doc Viewer */}
      <div className="flex-1 max-w-5xl mx-auto w-full p-6">
        <iframe
          src={config.apiPath}
          className="w-full rounded-xl border border-gray-200 shadow-lg bg-white"
          style={{ minHeight: "calc(100vh - 200px)" }}
          title={config.title}
        />
      </div>
    </div>
  );
}
