"use client";

import { useState, useEffect, useCallback } from "react";

const ACTION_COLORS: Record<string, string> = {
  getMultipleRates: "bg-blue-500/20 text-blue-400",
  getQuote: "bg-purple-500/20 text-purple-400",
  bookReservation: "bg-green-500/20 text-green-400",
  getOpenHours: "bg-yellow-500/20 text-yellow-400",
  getCarCategories: "bg-orange-500/20 text-orange-400",
  getStations: "bg-cyan-500/20 text-cyan-400",
  unknown: "bg-gray-500/20 text-gray-400",
};

function formatXML(xml: string): string {
  if (!xml || xml.trim().startsWith("{")) return xml; // JSON fallback
  try {
    let formatted = "";
    let indent = 0;
    const lines = xml.replace(/>\s*</g, "><").split(/(?<=>)(?=<)/);
    for (const line of lines) {
      if (line.startsWith("</")) indent--;
      formatted += "  ".repeat(Math.max(0, indent)) + line + "\n";
      if (line.startsWith("<") && !line.startsWith("</") && !line.includes("</") && !line.startsWith("<?") && !line.endsWith("/>"))
        indent++;
    }
    return formatted.trim();
  } catch {
    return xml;
  }
}

export default function PainelLogsXRS() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLog, setSelectedLog] = useState<any | null>(null);
  const [view, setView] = useState<"request" | "response">("response");
  const [filterAction, setFilterAction] = useState("");
  const [onlyErrors, setOnlyErrors] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3000); };

  const fetchLogs = useCallback(async () => {
    const params = new URLSearchParams();
    if (filterAction) params.set("action", filterAction);
    if (onlyErrors) params.set("onlyErrors", "true");
    params.set("limit", "200");

    try {
      const res = await fetch(`/api/admin/logs-xrs?${params}`);
      const data = await res.json();
      setLogs(Array.isArray(data) ? data : []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [filterAction, onlyErrors]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(fetchLogs, 5000);
    return () => clearInterval(interval);
  }, [autoRefresh, fetchLogs]);

  const handleExport = (log: any) => {
    const content = view === "response" ? log.xmlResponse : log.xmlRequest;
    const formatted = formatXML(content);
    const filename = `xrs_${log.action}_${log.id.slice(0, 8)}_${view}.xml`;
    const blob = new Blob([formatted], { type: "application/xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
    showToast(`Exportado: ${filename}`);
  };

  const handleExportAll = () => {
    if (!selectedLog) return;
    const req = formatXML(selectedLog.xmlRequest);
    const res = formatXML(selectedLog.xmlResponse);
    const content = `<!-- XRS LOG: ${selectedLog.action} | ${selectedLog.sourceFile} -->\n<!-- DATA: ${new Date(selectedLog.createdAt).toLocaleString("pt-BR")} -->\n\n<!-- === REQUEST === -->\n${req}\n\n<!-- === RESPONSE === -->\n${res}`;
    const filename = `xrs_${selectedLog.action}_${selectedLog.id.slice(0, 8)}_full.xml`;
    const blob = new Blob([content], { type: "application/xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
    showToast(`Exportado: ${filename}`);
  };

  const handleClearLogs = async () => {
    if (!confirm("Apagar TODOS os logs XRS? Esta ação é irreversível.")) return;
    await fetch("/api/admin/logs-xrs", { method: "DELETE" });
    setLogs([]); setSelectedLog(null);
    showToast("Logs apagados!");
  };

  const actions = Array.from(new Set(logs.map(l => l.action)));

  return (
    <div className="flex h-full gap-0 -m-6 overflow-hidden" style={{ height: "calc(100vh - 64px)" }}>
      {toast && <div className="fixed top-4 right-4 z-50 bg-green-600 text-white px-5 py-3 rounded-lg shadow-2xl font-bold text-sm">{toast}</div>}

      {/* Left panel — log list */}
      <div className="w-80 shrink-0 bg-gray-900 border-r border-gray-800 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-4 py-4 border-b border-gray-800 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-base font-black text-white">XRS Debugger</h1>
              <p className="text-[11px] text-gray-500">{logs.length} requisições capturadas</p>
            </div>
            <button onClick={fetchLogs} className="p-1.5 bg-gray-800 hover:bg-gray-700 rounded-lg text-gray-400 hover:text-white" title="Atualizar">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>
            </button>
          </div>

          {/* Filters */}
          <select value={filterAction} onChange={e => setFilterAction(e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-green-600">
            <option value="">Todas as ações</option>
            {actions.map(a => <option key={a} value={a}>{a}</option>)}
          </select>

          <div className="flex items-center justify-between gap-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={onlyErrors} onChange={e => setOnlyErrors(e.target.checked)} className="accent-red-500" />
              <span className="text-xs text-gray-400">Só erros</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={autoRefresh} onChange={e => setAutoRefresh(e.target.checked)} className="accent-green-500" />
              <span className="text-xs text-gray-400">Auto (5s)</span>
            </label>
            <button onClick={handleClearLogs} className="text-[10px] text-red-400 hover:text-red-300 font-bold">Limpar</button>
          </div>
        </div>

        {/* Log list */}
        <div className="flex-1 overflow-y-auto divide-y divide-gray-800/50">
          {loading ? (
            <div className="flex justify-center py-8"><div className="w-6 h-6 border-2 border-green-500 border-t-transparent rounded-full animate-spin"></div></div>
          ) : logs.length === 0 ? (
            <div className="text-center py-10 text-gray-600 text-sm">Nenhum log ainda.<br />Faça uma requisição no site.</div>
          ) : logs.map(log => (
            <button
              key={log.id}
              onClick={() => { setSelectedLog(log); setView("response"); }}
              className={`w-full text-left px-4 py-3 hover:bg-gray-800/50 transition-colors ${selectedLog?.id === log.id ? "bg-gray-800 border-l-2 border-green-500" : ""}`}
            >
              <div className="flex items-center gap-2 mb-1">
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${ACTION_COLORS[log.action] || ACTION_COLORS.unknown}`}>{log.action}</span>
                {log.hasError && <span className="text-[10px] bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded font-bold">ERRO</span>}
              </div>
              <div className="text-[10px] text-gray-500">{log.sourceFile}</div>
              <div className="flex items-center justify-between mt-1">
                <span className="text-[10px] text-gray-600">{new Date(log.createdAt).toLocaleString("pt-BR")}</span>
                {log.durationMs && <span className={`text-[10px] font-bold ${log.durationMs > 3000 ? "text-red-400" : "text-gray-500"}`}>{log.durationMs}ms</span>}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Right panel — detail view */}
      {selectedLog ? (
        <div className="flex-1 flex flex-col overflow-hidden bg-gray-950">
          {/* Detail header */}
          <div className="px-6 py-4 border-b border-gray-800 bg-gray-900 flex items-start justify-between gap-4">
            <div className="space-y-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`text-xs font-bold px-2 py-0.5 rounded ${ACTION_COLORS[selectedLog.action] || ACTION_COLORS.unknown}`}>{selectedLog.action}</span>
                {selectedLog.hasError && <span className="text-xs bg-red-500/20 text-red-400 px-2 py-0.5 rounded font-bold">❌ COM ERRO</span>}
                {selectedLog.httpStatus && <span className={`text-xs font-bold px-2 py-0.5 rounded ${selectedLog.httpStatus === 200 ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"}`}>HTTP {selectedLog.httpStatus}</span>}
                {selectedLog.durationMs && <span className="text-xs bg-gray-800 text-gray-400 px-2 py-0.5 rounded">{selectedLog.durationMs}ms</span>}
              </div>
              <p className="text-xs text-gray-400">
                <span className="font-bold text-white">Arquivo:</span> <code className="bg-gray-800 px-1.5 py-0.5 rounded text-green-400">{selectedLog.sourceFile}</code>
              </p>
              <p className="text-xs text-gray-500 truncate">
                <span className="font-bold text-gray-400">Endpoint:</span> {selectedLog.endpoint}
              </p>
              <p className="text-[11px] text-gray-600">{new Date(selectedLog.createdAt).toLocaleString("pt-BR")}</p>
            </div>
            <div className="flex gap-2 shrink-0">
              <button onClick={() => handleExport(selectedLog)} className="px-3 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
                Exportar {view === "response" ? "Response" : "Request"}
              </button>
              <button onClick={handleExportAll} className="px-3 py-2 bg-green-600 hover:bg-green-700 text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
                Exportar Tudo
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-gray-800 bg-gray-900">
            <button onClick={() => setView("response")} className={`px-6 py-3 text-sm font-bold border-b-2 transition-colors ${view === "response" ? "border-green-500 text-green-400" : "border-transparent text-gray-500 hover:text-gray-300"}`}>
              📥 Response XML
            </button>
            <button onClick={() => setView("request")} className={`px-6 py-3 text-sm font-bold border-b-2 transition-colors ${view === "request" ? "border-blue-500 text-blue-400" : "border-transparent text-gray-500 hover:text-gray-300"}`}>
              📤 Request XML
            </button>
          </div>

          {/* XML Content */}
          <div className="flex-1 overflow-auto p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                {view === "response" ? `xrs_${selectedLog.action}_${selectedLog.id.slice(0, 8)}_response.xml` : `xrs_${selectedLog.action}_${selectedLog.id.slice(0, 8)}_request.xml`}
              </span>
              <button
                onClick={() => {
                  const content = view === "response" ? selectedLog.xmlResponse : selectedLog.xmlRequest;
                  navigator.clipboard.writeText(formatXML(content));
                  showToast("Copiado!");
                }}
                className="text-[10px] text-gray-500 hover:text-white font-bold flex items-center gap-1"
              >
                📋 Copiar
              </button>
            </div>
            <pre className="bg-gray-900 border border-gray-800 rounded-xl p-5 text-xs text-green-400 font-mono overflow-auto whitespace-pre leading-relaxed" style={{ minHeight: "400px" }}>
              {formatXML(view === "response" ? selectedLog.xmlResponse : selectedLog.xmlRequest)}
            </pre>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center bg-gray-950">
          <div className="text-center text-gray-600">
            <div className="text-5xl mb-3">🔍</div>
            <p className="font-bold text-gray-500">Selecione uma requisição</p>
            <p className="text-sm mt-1">Os XMLs completos aparecerão aqui</p>
          </div>
        </div>
      )}
    </div>
  );
}
