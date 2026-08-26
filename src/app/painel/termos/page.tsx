"use client";

import { useState, useEffect, useRef } from "react";

interface TermsDoc {
  id: string;
  type: string;
  fileName: string;
  mimeType: string;
  updatedAt: string;
}

const ALL_TERMS = [
  {
    type: "RESERVA",
    label: "Termos e Condições da Reserva",
    description: "Documento com os termos gerais para todas as reservas realizadas na plataforma.",
    icon: "📄",
    supportLink: false,
  },
  {
    type: "PAIS",
    label: "Termos e Condições do País de Destino",
    description: "Termos específicos do país onde a reserva será realizada. Aceita arquivo ou link externo.",
    icon: "🌍",
    supportLink: true,
  },
  {
    type: "BRASIL_ONLINE",
    label: "Termos de Reserva Online — Brasil",
    description: "Termos e condições para reservas online realizadas no Brasil.",
    icon: "🇧🇷",
    supportLink: false,
  },
];

export default function TermosPage() {
  const [docs, setDocs] = useState<TermsDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState<string | null>(null);
  const [savingLink, setSavingLink] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: string; text: string } | null>(null);
  const [paisUrl, setPaisUrl] = useState("");
  const [paisMode, setPaisMode] = useState<"file" | "link">("link");
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const fetchDocs = async () => {
    try {
      const res = await fetch("/api/admin/terms");
      const data = await res.json();
      const arr = Array.isArray(data) ? data : [];
      setDocs(arr);
      const paisDoc = arr.find((d: TermsDoc) => d.type === "PAIS");
      if (paisDoc) {
        if (paisDoc.mimeType === "text/uri-list") {
          setPaisUrl(paisDoc.fileName);
          setPaisMode("link");
        } else {
          setPaisMode("file");
        }
      }
    } catch {
      setDocs([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchDocs(); }, []);

  const getDoc = (type: string) => docs.find(d => d.type === type);

  const handleUpload = async (type: string) => {
    const input = fileRefs.current[type];
    if (!input?.files?.length) return;

    const file = input.files[0];
    if (file.size > 10 * 1024 * 1024) {
      setMessage({ type: "error", text: "Arquivo muito grande. Máximo: 10MB." });
      return;
    }

    setUploading(type);
    setMessage(null);

    try {
      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve, reject) => {
        reader.onload = () => {
          const result = reader.result as string;
          resolve(result.split(",")[1] || result);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const res = await fetch("/api/admin/terms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          fileName: file.name,
          mimeType: file.type || "application/pdf",
          fileData: base64,
        }),
      });

      if (res.ok) {
        setMessage({ type: "success", text: `"${file.name}" enviado com sucesso!` });
        fetchDocs();
      } else {
        const err = await res.json();
        setMessage({ type: "error", text: err.error || "Erro ao enviar" });
      }
    } catch (e: any) {
      setMessage({ type: "error", text: e.message || "Erro ao enviar" });
    } finally {
      setUploading(null);
      if (input) input.value = "";
    }
  };

  const handleSaveLink = async (type: string, url: string) => {
    if (!url.trim()) {
      setMessage({ type: "error", text: "Insira uma URL válida." });
      return;
    }
    setSavingLink(type);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/terms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, externalUrl: url.trim() }),
      });
      if (res.ok) {
        setMessage({ type: "success", text: "Link salvo com sucesso!" });
        fetchDocs();
      } else {
        const err = await res.json();
        setMessage({ type: "error", text: err.error || "Erro ao salvar" });
      }
    } catch (e: any) {
      setMessage({ type: "error", text: e.message || "Erro ao salvar" });
    } finally {
      setSavingLink(null);
    }
  };

  const getViewUrl = (type: string) => {
    const map: Record<string, string> = { RESERVA: "reserva", PAIS: "pais", BRASIL_ONLINE: "brasil" };
    return `/api/terms/${map[type]}`;
  };

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-black text-white flex items-center gap-3">
          📜 Termos e Condições
        </h1>
        <p className="text-gray-400 text-sm mt-1">
          Gerencie os documentos de termos e condições. Eles aparecerão no checkout e no rodapé do site.
        </p>
      </div>

      {message && (
        <div className={`mb-6 p-4 rounded-lg border text-sm font-bold ${
          message.type === "success"
            ? "bg-green-900/30 border-green-800 text-green-400"
            : "bg-red-900/30 border-red-800 text-red-400"
        }`}>
          {message.text}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {ALL_TERMS.map(config => {
            const doc = getDoc(config.type);
            const isUploading = uploading === config.type;
            const isSavingLink = savingLink === config.type;
            const isPais = config.type === "PAIS";

            return (
              <div key={config.type} className="bg-gray-900 border border-gray-800 rounded-xl p-6 hover:border-gray-700 transition-colors flex flex-col">
                {/* Header */}
                <div className="flex items-start gap-3 mb-4">
                  <span className="text-3xl">{config.icon}</span>
                  <div>
                    <h3 className="text-white font-bold text-sm">{config.label}</h3>
                    <p className="text-gray-500 text-xs mt-1">{config.description}</p>
                  </div>
                </div>

                {/* Current status */}
                {doc ? (
                  <div className="bg-gray-800 rounded-lg p-3 mb-4">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="w-2 h-2 bg-green-500 rounded-full" />
                      <span className="text-green-400 text-xs font-bold">
                        {doc.mimeType === "text/uri-list" ? "Link ativo" : "Arquivo ativo"}
                      </span>
                    </div>
                    {doc.mimeType === "text/uri-list" ? (
                      <a href={doc.fileName} target="_blank" rel="noopener noreferrer" className="text-blue-400 text-sm font-medium hover:underline break-all">
                        {doc.fileName}
                      </a>
                    ) : (
                      <p className="text-white text-sm font-medium truncate">{doc.fileName}</p>
                    )}
                    <p className="text-gray-500 text-[10px] mt-1">
                      Atualizado: {new Date(doc.updatedAt).toLocaleString("pt-BR")}
                    </p>
                    {doc.mimeType !== "text/uri-list" && (
                      <a href={getViewUrl(config.type)} target="_blank" rel="noopener noreferrer" className="text-blue-400 text-xs hover:underline mt-1 inline-block">
                        Visualizar →
                      </a>
                    )}
                  </div>
                ) : (
                  <div className="bg-gray-800/50 border border-dashed border-gray-700 rounded-lg p-3 mb-4 text-center">
                    <span className="text-gray-600 text-xs">Nenhum conteúdo configurado</span>
                  </div>
                )}

                {/* PAIS: toggle between link and file */}
                {isPais && (
                  <div className="flex rounded-lg overflow-hidden border border-gray-700 mb-4">
                    <button
                      onClick={() => setPaisMode("link")}
                      className={`flex-1 py-2 text-xs font-bold transition-colors ${
                        paisMode === "link" ? "bg-blue-600 text-white" : "bg-gray-800 text-gray-400 hover:text-white"
                      }`}
                    >
                      🔗 Link Externo
                    </button>
                    <button
                      onClick={() => setPaisMode("file")}
                      className={`flex-1 py-2 text-xs font-bold transition-colors ${
                        paisMode === "file" ? "bg-green-600 text-white" : "bg-gray-800 text-gray-400 hover:text-white"
                      }`}
                    >
                      📄 Arquivo
                    </button>
                  </div>
                )}

                {/* Link input (PAIS only, link mode) */}
                {isPais && paisMode === "link" && (
                  <div className="space-y-2 mt-auto">
                    <input
                      type="url"
                      value={paisUrl}
                      onChange={e => setPaisUrl(e.target.value)}
                      placeholder="https://www.europcar.com/terms-and-conditions"
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white text-sm placeholder:text-gray-600 outline-none focus:border-blue-500 transition-colors"
                    />
                    <button
                      onClick={() => handleSaveLink("PAIS", paisUrl)}
                      disabled={isSavingLink || !paisUrl.trim()}
                      className={`w-full py-3 rounded-lg text-sm font-bold transition-colors ${
                        isSavingLink || !paisUrl.trim()
                          ? "bg-gray-800 text-gray-500 cursor-not-allowed"
                          : "bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 border border-blue-600/30"
                      }`}
                    >
                      {isSavingLink ? (
                        <span className="flex items-center justify-center gap-2">
                          <span className="w-4 h-4 border-2 border-gray-500 border-t-transparent rounded-full animate-spin" />
                          Salvando...
                        </span>
                      ) : "🔗 Salvar Link"}
                    </button>
                  </div>
                )}

                {/* File upload (all types, or PAIS in file mode) */}
                {(!isPais || paisMode === "file") && (
                  <div className="mt-auto">
                    <input
                      ref={el => { fileRefs.current[config.type] = el; }}
                      type="file"
                      accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                      className="hidden"
                      onChange={() => handleUpload(config.type)}
                    />
                    <button
                      onClick={() => fileRefs.current[config.type]?.click()}
                      disabled={isUploading}
                      className={`w-full py-3 rounded-lg text-sm font-bold transition-colors ${
                        isUploading
                          ? "bg-gray-800 text-gray-500 cursor-wait"
                          : doc
                            ? "bg-yellow-600/20 text-yellow-400 hover:bg-yellow-600/30 border border-yellow-600/30"
                            : "bg-green-600/20 text-green-400 hover:bg-green-600/30 border border-green-600/30"
                      }`}
                    >
                      {isUploading ? (
                        <span className="flex items-center justify-center gap-2">
                          <span className="w-4 h-4 border-2 border-gray-500 border-t-transparent rounded-full animate-spin" />
                          Enviando...
                        </span>
                      ) : doc && doc.mimeType !== "text/uri-list" ? "📎 Substituir Arquivo" : "📤 Enviar Arquivo (PDF ou DOC)"}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Info box */}
      <div className="mt-8 bg-blue-900/20 border border-blue-800/30 rounded-xl p-5">
        <h4 className="text-blue-400 text-sm font-bold mb-2">ℹ️ Como funciona</h4>
        <ul className="text-gray-400 text-xs space-y-1.5">
          <li>• <strong className="text-white">Reserva e Brasil:</strong> Faça upload de arquivos PDF ou DOC/DOCX (máx. 10MB)</li>
          <li>• <strong className="text-white">País de Destino:</strong> Cole um link externo <em>ou</em> faça upload de arquivo — escolha com os botões acima</li>
          <li>• Os links aparecerão automaticamente no <strong className="text-white">rodapé do site</strong></li>
          <li>• No <strong className="text-white">checkout</strong>, o cliente deverá aceitar os termos antes de finalizar</li>
          <li>• Para alterar, basta enviar um novo arquivo ou link</li>
        </ul>
      </div>
    </div>
  );
}
