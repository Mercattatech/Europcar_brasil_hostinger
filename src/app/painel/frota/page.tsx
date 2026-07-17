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
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchOverrides = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/cars/images");
      const data = await res.json();
      setOverrides(data);
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
    try {
      const formData = new FormData();
      formData.append("carCode", carCode.trim().toUpperCase());
      formData.append("file", file);

      const res = await fetch("/api/cars/images", {
        method: "POST",
        body: formData,
      });
      
      if (res.ok) {
        setCarCode("");
        setFile(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
        await fetchOverrides();
      } else {
        const error = await res.json();
        alert(error.error || "Erro ao fazer upload");
      }
    } catch (err) {
      console.error(err);
      alert("Erro ao fazer upload");
    } finally {
      setUploading(false);
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
      <p className="text-gray-400 text-sm mb-6">Faça upload de fotos customizadas para categorias de veículos (ex: EDMR, CDAR).</p>

      {/* Upload Form */}
      <form onSubmit={handleUpload} className="bg-gray-800/50 border border-gray-700 rounded-lg p-5 mb-6">
        <h2 className="text-sm font-bold text-white mb-3">Adicionar/Atualizar Foto</h2>
        <div className="flex gap-3 items-end">
          <div className="w-48">
            <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Código do Carro (SIPP)</label>
            <input
              value={carCode}
              onChange={e => setCarCode(e.target.value.toUpperCase())}
              placeholder="Ex: EDMR"
              className="w-full bg-gray-900 border border-gray-600 text-white rounded px-3 py-2 text-sm outline-none focus:border-[#008d36] uppercase"
              required
            />
          </div>
          <div className="flex-1">
            <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Arquivo da Imagem (.jpg, .png)</label>
            <input
              type="file"
              accept="image/*"
              onChange={e => setFile(e.target.files?.[0] || null)}
              ref={fileInputRef}
              className="w-full bg-gray-900 border border-gray-600 text-gray-300 rounded px-3 py-1.5 text-sm outline-none focus:border-[#008d36] file:mr-4 file:py-1 file:px-3 file:rounded file:border-0 file:text-xs file:font-bold file:bg-[#008d36] file:text-white hover:file:bg-[#007a2d]"
              required
            />
          </div>
          <button
            type="submit"
            disabled={uploading || !carCode.trim() || !file}
            className="bg-[#008d36] hover:bg-[#007a2d] disabled:opacity-50 text-white font-bold px-6 py-2 rounded text-sm transition-colors shrink-0"
          >
            {uploading ? "Salvando..." : "Fazer Upload"}
          </button>
        </div>
      </form>

      {/* List */}
      <div className="bg-gray-800/50 border border-gray-700 rounded-lg overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-700 flex justify-between items-center">
          <h2 className="text-sm font-bold text-white">Fotos Customizadas ({overrides.length})</h2>
        </div>
        
        {loading ? (
          <div className="p-8 text-center text-gray-400">Carregando...</div>
        ) : overrides.length === 0 ? (
          <div className="p-8 text-center text-gray-500">Nenhuma foto customizada. O sistema usará as fotos padrão da API.</div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 p-5">
            {overrides.map(o => (
              <div key={o.carCode} className="bg-gray-900 border border-gray-700 rounded-lg overflow-hidden flex flex-col group relative">
                <div className="h-32 bg-white flex items-center justify-center p-2 relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={o.imageUrl} alt={o.carCode} className="max-w-full max-h-full object-contain" />
                  
                  {/* Overlay Delete Button */}
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
