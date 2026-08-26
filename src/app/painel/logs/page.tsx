"use client";

import { useState, useEffect } from "react";

export default function PainelLogs() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedLog, setExpandedLog] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/logs")
      .then(res => res.json())
      .then(data => { setLogs(Array.isArray(data) ? data : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-white">System Logs</h1>
          <p className="text-gray-400 text-sm mt-1">Registros de transações da API Cielo</p>
        </div>
        <button onClick={() => window.location.reload()} className="bg-gray-800 hover:bg-gray-700 text-gray-300 px-4 py-2 rounded-lg font-bold text-sm transition-colors">
          🔄 Atualizar
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-10"><div className="w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin"></div></div>
      ) : logs.length === 0 ? (
        <div className="bg-gray-900 border border-gray-800 p-10 rounded-xl text-center text-gray-500">Nenhum log registrado ainda.</div>
      ) : (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-800/50 border-b border-gray-700">
              <tr>
                <th className="px-5 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Data/Hora</th>
                <th className="px-5 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Endpoint</th>
                <th className="px-5 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Payload</th>
                <th className="px-5 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Response</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/50">
              {logs.map(log => (
                <tr key={log.id} className="hover:bg-gray-800/30 transition-colors align-top">
                  <td className="px-5 py-4 font-mono text-xs text-gray-500 whitespace-nowrap">
                    {new Date(log.createdAt).toLocaleString("pt-BR")}
                  </td>
                  <td className="px-5 py-4">
                    <span className="font-bold text-white text-xs">{log.endpoint}</span>
                  </td>
                  <td className="px-5 py-4">
                    <pre className="bg-gray-800 p-2 rounded text-[10px] text-gray-300 overflow-auto max-w-xs max-h-20 scrollbar-thin">{log.payload}</pre>
                  </td>
                  <td className="px-5 py-4">
                    <pre className="bg-gray-800 p-2 rounded text-[10px] text-gray-300 overflow-auto max-w-md max-h-20 scrollbar-thin">{log.response}</pre>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
