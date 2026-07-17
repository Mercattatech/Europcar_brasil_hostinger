"use client";
import { useEffect, useState, useRef } from "react";

interface CarImageOverride {
  carCode: string;
  imageUrl: string;
}

export default function PainelFrotaPage() {
  const [overrides, setOverrides] = useState<CarImageOverride[]>([]);
  const [loading, setLoading] = useState(true);
  const [carCode, setCarCode] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [message, setMessage] = useState<{ type: string; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchOverrides = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/cars/images");
      const data = await res.json();
      setOverrides(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchOverrides(); }, []);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!carCode.trim() || !file) return;

    setUploading(true);
    setMessage(null);
    try {
      const formData = new FormData();
      formData.append("carCode", carCode.trim().toUpperCase());
      formData.append("file", file);

      const res = await fetch("/api/cars/images", { method: "POST", body: formData });
      if (res.ok) {
        setMessage({ type: "success", text: `Foto do ${carCode.toUpperCase()} salva com sucesso!` });
        setCarCode("");
        setFile(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
        await fetchOverrides();
      } else {
        const error = await res.json();
        setMessage({ type: "error", text: error.error || "Erro ao fazer upload" });
      }
    } catch {
      setMessage({ type: "error", text: "Erro ao fazer upload" });
    } finally {
      setUploading(false);
    }
  };

  // Auto-fetch from Europcar CDN and save to DB
  const handleFetchFromAPI = async () => {
    if (!carCode.trim()) {
      setMessage({ type: "error", text: "Digite o código SIPP primeiro." });
      return;
    }
    const code = carCode.trim().toUpperCase();
    setFetching(true);
    setMessage(null);

    try {
      // Try Europcar CDN URLs in order
      const urls = [
        `https://static.europcar.com/carvisuals/partners/835x557/${code}_IT.png`,
        `https://static.europcar.com/carvisuals/partners/835x557/${code}_DE.png`,
        `https://static.europcar.com/carvisuals/partners/835x557/${code}_FR.png`,
      ];

      // Fetch via server-side proxy to avoid CORS
      const res = await fetch("/api/cars/fetch-from-cdn", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ carCode: code, urls }),
      });

      if (res.ok) {
        setMessage({ type: "success", text: `Imagem do ${code} baixada da Europcar e salva!` });
        setCarCode("");
        await fetchOverrides();
      } else {
        const err = await res.json();
        setMessage({ type: "error", text: err.error || "Imagem não encontrada na Europcar para este código." });
      }
    } catch {
      setMessage({ type: "error", text: "Erro ao buscar imagem da Europcar." });
    } finally {
      setFetching(false);
    }
  };

  const handleDelete = async (code: string) => {
    if (!confirm(`Excluir foto customizada do veículo ${code}?`)) return;
    try {
      await fetch(`/api/cars/images?carCode=${code}`, { method: "DELETE" });
      await fetchOverrides();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-black text-white mb-1">Fotos da Frota (Veículos)</h1>
      <p className="text-gray-400 text-sm mb-2">
        Cadastre fotos customizadas por código SIPP (ex: EDMR, CDAR). Quando não houver customização, o sistema usa automaticamente as fotos do CDN da Europcar.
      </p>

      {/* Info box */}
      <div className="bg-blue-900/20 border border-blue-800/30 rounded-lg p-4 mb-6 text-xs text-gray-400">
        <strong className="text-blue-400">ℹ️ Como funciona:</strong> O sistema já exibe as imagens do CDN da Europcar automaticamente (
        <code className="text-gray-300">static.europcar.com/.../SIPP_IT.png</code>). Use esta página apenas para <strong className="text-white">substituir</strong> a foto padrão ou para baixar e salvar a imagem da Europcar localmente usando o botão <strong className="text-green-400">"Buscar da Europcar"</strong>.
      </div>

      {message && (
        <div className={`mb-4 p-4 rounded-lg border text-sm font-bold ${
          message.type === "success"
            ? "bg-green-900/30 border-green-800 text-green-400"
            : "bg-red-900/30 border-red-800 text-red-400"
        }`}>
          {message.text}
        </div>
      )}

      {/* Upload Form */}
      <form onSubmit={handleUpload} className="bg-gray-800/50 border border-gray-700 rounded-lg p-5 mb-6">
        <h2 className="text-sm font-bold text-white mb-3">Adicionar/Atualizar Foto</h2>
        <div className="flex gap-3 items-end flex-wrap">
          <div className="w-48">
            <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Código do Carro (SIPP)</label>
            <input
              value={carCode}
              onChange={e => setCarCode(e.target.value.toUpperCase())}
              placeholder="Ex: EDMR"
              className="w-full bg-gray-900 border border-gray-600 text-white rounded px-3 py-2 text-sm outline-none focus:border-[#008d36] uppercase"
            />
          </div>

          {/* Auto-fetch from Europcar CDN */}
          <button
            type="button"
            onClick={handleFetchFromAPI}
            disabled={fetching || !carCode.trim()}
            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white font-bold px-5 py-2 rounded text-sm transition-colors shrink-0 flex items-center gap-2"
          >
            {fetching ? (
              <>
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Buscando...
              </>
            ) : "🌐 Buscar da Europcar"}
          </button>

          <div className="text-gray-600 text-xs py-2 shrink-0">ou</div>

          <div className="flex-1 min-w-48">
            <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Fazer Upload Manual (.jpg, .png)</label>
            <input
              type="file"
              accept="image/*"
              onChange={e => setFile(e.target.files?.[0] || null)}
              ref={fileInputRef}
              className="w-full bg-gray-900 border border-gray-600 text-gray-300 rounded px-3 py-1.5 text-sm outline-none focus:border-[#008d36] file:mr-4 file:py-1 file:px-3 file:rounded file:border-0 file:text-xs file:font-bold file:bg-[#008d36] file:text-white hover:file:bg-[#007a2d]"
            />
          </div>

          <button
            type="submit"
            disabled={uploading || !carCode.trim() || !file}
            className="bg-[#008d36] hover:bg-[#007a2d] disabled:opacity-50 text-white font-bold px-6 py-2 rounded text-sm transition-colors shrink-0"
          >
            {uploading ? "Salvando..." : "📤 Upload"}
          </button>
        </div>
      </form>

      {/* List */}
      <div className="bg-gray-800/50 border border-gray-700 rounded-lg overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-700 flex justify-between items-center">
          <h2 className="text-sm font-bold text-white">Fotos Customizadas ({overrides.length})</h2>
          <span className="text-xs text-gray-500">Passe o mouse sobre a foto para excluir</span>
        </div>

        {loading ? (
          <div className="p-8 text-center text-gray-400">Carregando...</div>
        ) : overrides.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            Nenhuma foto customizada. O sistema usará as fotos padrão do CDN da Europcar.
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 p-5">
            {overrides.map(o => (
              <div key={o.carCode} className="bg-gray-900 border border-gray-700 rounded-lg overflow-hidden flex flex-col group relative">
                <div className="h-32 bg-white flex items-center justify-center p-2 relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={o.imageUrl} alt={o.carCode} className="max-w-full max-h-full object-contain" />
                  <button
                    onClick={() => handleDelete(o.carCode)}
                    className="absolute top-2 right-2 bg-red-600/90 hover:bg-red-500 text-white w-7 h-7 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                    title="Excluir foto"
                  >
                    🗑️
                  </button>
                </div>
                <div className="px-3 py-2 border-t border-gray-700 text-center">
                  <span className="text-white font-bold text-sm bg-gray-800 px-2 py-0.5 rounded border border-gray-600">{o.carCode}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
