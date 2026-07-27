"use client";

import { useState, useEffect } from "react";

const STEP_LABELS: Record<number, { label: string; icon: string; color: string }> = {
  1: { label: "Pesquisa", icon: "🔍", color: "bg-blue-500" },
  2: { label: "Veículo", icon: "🚗", color: "bg-yellow-500" },
  3: { label: "Extras", icon: "🛡️", color: "bg-orange-500" },
  4: { label: "Checkout", icon: "💳", color: "bg-purple-500" },
  5: { label: "Concluída", icon: "✅", color: "bg-green-500" },
};

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  IN_PROGRESS: { label: "Em Progresso", color: "bg-yellow-600/20 text-yellow-400" },
  COMPLETED: { label: "Concluída", color: "bg-green-600/20 text-green-400" },
  ABANDONED: { label: "Abandonada", color: "bg-red-600/20 text-red-400" },
};

export default function JornadaPage() {
  const [stats, setStats] = useState<any>(null);
  const [journeys, setJourneys] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingStats, setLoadingStats] = useState(true);

  // Filters
  const [filterStatus, setFilterStatus] = useState("");
  const [filterStep, setFilterStep] = useState("");
  const [filterStation, setFilterStation] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [search, setSearch] = useState("");

  // Expanded row
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchStats = () => {
    setLoadingStats(true);
    const params = new URLSearchParams();
    if (startDate) params.set("startDate", startDate);
    if (endDate) params.set("endDate", endDate);
    fetch(`/api/admin/journey/stats?${params}`)
      .then((r) => r.json())
      .then((d) => {
        if (d && d.funnel) {
          setStats(d);
        } else {
          setStats(null);
        }
        setLoadingStats(false);
      })
      .catch(() => { setStats(null); setLoadingStats(false); });
  };

  const fetchJourneys = (p: number = 1) => {
    setLoading(true);
    const params = new URLSearchParams();
    params.set("page", String(p));
    params.set("limit", "30");
    if (filterStatus) params.set("status", filterStatus);
    if (filterStep) params.set("step", filterStep);
    if (filterStation) params.set("station", filterStation);
    if (startDate) params.set("startDate", startDate);
    if (endDate) params.set("endDate", endDate);
    if (search) params.set("search", search);

    fetch(`/api/admin/journey?${params}`)
      .then((r) => r.json())
      .then((d) => {
        if (d && !d.error) {
          setJourneys(d.journeys || []);
          setTotal(d.total || 0);
          setPage(d.page || 1);
          setTotalPages(d.totalPages || 1);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    fetchStats();
    fetchJourneys(1);
  }, []);

  const handleFilter = (e: React.FormEvent) => {
    e.preventDefault();
    fetchStats();
    fetchJourneys(1);
  };

  const fmtDate = (d: string) => {
    try {
      return new Date(d).toLocaleString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return d;
    }
  };

  const fmtDateShort = (d: string | null | undefined) => {
    if (!d) return "—";
    // Format: YYYYMMDD → DD/MM/YYYY
    if (d.length === 8 && !d.includes("/") && !d.includes("-")) {
      return `${d.slice(6, 8)}/${d.slice(4, 6)}/${d.slice(0, 4)}`;
    }
    return d;
  };

  const fmtTime = (t: string | null | undefined) => {
    if (!t) return "—";
    if (t.length === 4) return `${t.slice(0, 2)}:${t.slice(2, 4)}`;
    return t;
  };

  // Funnel bar widths
  const funnelMax = stats?.funnel?.step1 || 1;
  const funnelData = stats
    ? [
        { step: 1, count: stats.funnel.step1, label: "Pesquisa", icon: "🔍" },
        { step: 2, count: stats.funnel.step2, label: "Veículo", icon: "🚗" },
        { step: 3, count: stats.funnel.step3, label: "Extras", icon: "🛡️" },
        { step: 4, count: stats.funnel.step4, label: "Checkout", icon: "💳" },
        { step: 5, count: stats.funnel.step5, label: "Concluída", icon: "✅" },
      ]
    : [];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-white">Jornada do Cliente</h1>
          <p className="text-sm text-gray-400 mt-1">
            Acompanhe o funil de conversão e entenda onde os clientes abandonam
          </p>
        </div>
      </div>

      {/* Loading State */}
      {loadingStats && !stats && (
        <div className="flex justify-center py-10">
          <div className="text-center">
            <div className="w-10 h-10 border-4 border-green-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-sm text-gray-500">Carregando dados da jornada...</p>
          </div>
        </div>
      )}

      {/* Empty State when no stats (API error or no data) */}
      {!loadingStats && !stats && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-10 text-center">
          <p className="text-4xl mb-4">🗺️</p>
          <h3 className="text-lg font-bold text-white mb-2">Jornada do Cliente</h3>
          <p className="text-sm text-gray-400 mb-4">Nenhuma jornada registrada ainda. Os dados aparecerão aqui quando os primeiros clientes pesquisarem no site.</p>
          <p className="text-xs text-gray-600">As pesquisas, seleções de veículos e checkouts serão rastreados automaticamente.</p>
        </div>
      )}

      {/* Summary Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg bg-blue-600/20 flex items-center justify-center text-lg">📊</div>
              <p className="text-xs font-bold text-gray-500 uppercase">Total Pesquisas</p>
            </div>
            <p className="text-3xl font-black text-white">{stats.totalSessions}</p>
            <p className="text-xs text-gray-500 mt-1">Hoje: {stats.today?.sessions || 0}</p>
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg bg-green-600/20 flex items-center justify-center text-lg">✅</div>
              <p className="text-xs font-bold text-gray-500 uppercase">Conversões</p>
            </div>
            <p className="text-3xl font-black text-green-400">{stats.statusCounts.completed}</p>
            <p className="text-xs text-gray-500 mt-1">Hoje: {stats.today?.completed || 0}</p>
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-600/20 flex items-center justify-center text-lg">📈</div>
              <p className="text-xs font-bold text-gray-500 uppercase">Taxa de Conversão</p>
            </div>
            <p className="text-3xl font-black text-emerald-400">{stats.conversionRate}%</p>
            <p className="text-xs text-gray-500 mt-1">Pesquisa → Reserva</p>
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg bg-yellow-600/20 flex items-center justify-center text-lg">⏳</div>
              <p className="text-xs font-bold text-gray-500 uppercase">Em Progresso</p>
            </div>
            <p className="text-3xl font-black text-yellow-400">{stats.statusCounts.inProgress}</p>
            <p className="text-xs text-gray-500 mt-1">Sessões ativas</p>
          </div>
        </div>
      )}

      {/* Funnel + Top Stations */}
      {stats && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Funnel */}
          <div className="lg:col-span-2 bg-gray-900 border border-gray-800 rounded-xl p-6">
            <h2 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
              <span className="w-1 h-5 bg-green-500 rounded-full inline-block"></span>
              Funil de Conversão
            </h2>
            <div className="space-y-4">
              {funnelData.map((item, idx) => {
                const pct = funnelMax > 0 ? (item.count / funnelMax) * 100 : 0;
                const prevCount = idx > 0 ? funnelData[idx - 1].count : item.count;
                const dropoff = prevCount > 0 ? (((prevCount - item.count) / prevCount) * 100).toFixed(0) : "0";
                return (
                  <div key={item.step} className="flex items-center gap-4">
                    <div className="w-24 shrink-0 flex items-center gap-2">
                      <span className="text-lg">{item.icon}</span>
                      <span className="text-xs font-bold text-gray-400">{item.label}</span>
                    </div>
                    <div className="flex-1 bg-gray-800 rounded-full h-8 overflow-hidden relative">
                      <div
                        className={`h-full rounded-full transition-all duration-700 ${
                          item.step === 5 ? "bg-gradient-to-r from-green-600 to-green-400" :
                          item.step === 4 ? "bg-gradient-to-r from-purple-600 to-purple-400" :
                          item.step === 3 ? "bg-gradient-to-r from-orange-600 to-orange-400" :
                          item.step === 2 ? "bg-gradient-to-r from-yellow-600 to-yellow-400" :
                          "bg-gradient-to-r from-blue-600 to-blue-400"
                        }`}
                        style={{ width: `${Math.max(pct, 3)}%` }}
                      />
                      <div className="absolute inset-0 flex items-center px-3 justify-between">
                        <span className="text-xs font-black text-white drop-shadow">{item.count}</span>
                        <span className="text-[10px] font-bold text-white/80">{pct.toFixed(0)}%</span>
                      </div>
                    </div>
                    {idx > 0 && (
                      <div className="w-16 shrink-0 text-right">
                        <span className={`text-[10px] font-bold ${parseInt(dropoff) > 50 ? "text-red-400" : parseInt(dropoff) > 30 ? "text-orange-400" : "text-gray-500"}`}>
                          -{dropoff}%
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Top Stations */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <span className="w-1 h-5 bg-blue-500 rounded-full inline-block"></span>
              Estações Mais Pesquisadas
            </h2>
            {stats.topStations?.length > 0 ? (
              <div className="space-y-3">
                {stats.topStations.map((s: any, idx: number) => (
                  <div key={idx} className="flex items-center gap-3">
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-black ${
                      idx === 0 ? "bg-yellow-500 text-black" :
                      idx === 1 ? "bg-gray-400 text-black" :
                      idx === 2 ? "bg-orange-600 text-white" :
                      "bg-gray-700 text-gray-300"
                    }`}>{idx + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-white truncate">{s.name}</p>
                      <p className="text-[10px] text-gray-500 font-mono">{s.code}</p>
                    </div>
                    <span className="text-sm font-black text-green-400">{s.count}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500">Nenhuma pesquisa registrada</p>
            )}
          </div>
        </div>
      )}

      {/* Filters */}
      <form onSubmit={handleFilter} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
          <div>
            <label className="text-[10px] font-bold text-gray-500 uppercase mb-1 block">Status</label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-3 py-2"
            >
              <option value="">Todos</option>
              <option value="IN_PROGRESS">Em Progresso</option>
              <option value="COMPLETED">Concluída</option>
              <option value="ABANDONED">Abandonada</option>
            </select>
          </div>
          <div>
            <label className="text-[10px] font-bold text-gray-500 uppercase mb-1 block">Etapa</label>
            <select
              value={filterStep}
              onChange={(e) => setFilterStep(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-3 py-2"
            >
              <option value="">Todas</option>
              <option value="1">1 - Pesquisa</option>
              <option value="2">2 - Veículo</option>
              <option value="3">3 - Extras</option>
              <option value="4">4 - Checkout</option>
              <option value="5">5 - Concluída</option>
            </select>
          </div>
          <div>
            <label className="text-[10px] font-bold text-gray-500 uppercase mb-1 block">De</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-3 py-2"
            />
          </div>
          <div>
            <label className="text-[10px] font-bold text-gray-500 uppercase mb-1 block">Até</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-3 py-2"
            />
          </div>
          <div>
            <label className="text-[10px] font-bold text-gray-500 uppercase mb-1 block">Buscar</label>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Estação, carro, reserva..."
              className="w-full bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-3 py-2 placeholder:text-gray-600"
            />
          </div>
          <div className="flex items-end">
            <button type="submit" className="w-full bg-green-600 hover:bg-green-700 text-white font-bold text-sm py-2 px-4 rounded-lg transition-colors">
              Filtrar
            </button>
          </div>
        </div>
      </form>

      {/* Journeys Table */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-800 flex items-center justify-between">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <span className="w-1 h-5 bg-purple-500 rounded-full inline-block"></span>
            Jornadas ({total})
          </h2>
          <div className="flex items-center gap-2 text-xs text-gray-500">
            Página {page} de {totalPages}
          </div>
        </div>

        {loading ? (
          <div className="p-10 text-center">
            <div className="w-8 h-8 border-3 border-green-500 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
            <p className="text-sm text-gray-500">Carregando...</p>
          </div>
        ) : journeys.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-4xl mb-3">🗺️</p>
            <p className="text-gray-400 font-bold">Nenhuma jornada registrada</p>
            <p className="text-xs text-gray-600 mt-1">As jornadas aparecerão aqui conforme os clientes utilizarem o site</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800 text-left">
                  <th className="px-4 py-3 text-[10px] font-bold text-gray-500 uppercase">Data</th>
                  <th className="px-4 py-3 text-[10px] font-bold text-gray-500 uppercase">Estação Retirada</th>
                  <th className="px-4 py-3 text-[10px] font-bold text-gray-500 uppercase">Carro</th>
                  <th className="px-4 py-3 text-[10px] font-bold text-gray-500 uppercase text-center">Etapa</th>
                  <th className="px-4 py-3 text-[10px] font-bold text-gray-500 uppercase text-center">Status</th>
                  <th className="px-4 py-3 text-[10px] font-bold text-gray-500 uppercase">Reserva</th>
                  <th className="px-4 py-3 text-[10px] font-bold text-gray-500 uppercase text-center">Detalhes</th>
                </tr>
              </thead>
              <tbody>
                {journeys.map((j: any) => {
                  const stepInfo = STEP_LABELS[j.currentStep] || { label: "?", icon: "❓", color: "bg-gray-500" };
                  const statusInfo = STATUS_LABELS[j.status] || { label: j.status, color: "bg-gray-600/20 text-gray-400" };
                  const isExpanded = expandedId === j.id;

                  return (
                    <>
                      <tr
                        key={j.id}
                        className={`border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors cursor-pointer ${isExpanded ? "bg-gray-800/40" : ""}`}
                        onClick={() => setExpandedId(isExpanded ? null : j.id)}
                      >
                        <td className="px-4 py-3">
                          <p className="text-white font-medium text-xs">{fmtDate(j.createdAt)}</p>
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-white font-bold text-xs">{j.pickupStationName || "—"}</p>
                          <p className="text-[10px] text-gray-500 font-mono">{j.pickupStation || ""}</p>
                        </td>
                        <td className="px-4 py-3">
                          {j.selectedCarName ? (
                            <div>
                              <p className="text-white font-bold text-xs">{j.selectedCarName}</p>
                              {j.carPrice && <p className="text-[10px] text-green-400 font-bold">R$ {j.carPrice.toFixed(2).replace(".", ",")}</p>}
                            </div>
                          ) : (
                            <span className="text-gray-600 text-xs">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="inline-flex items-center gap-1.5">
                            <span className="text-sm">{stepInfo.icon}</span>
                            <span className="text-xs font-bold text-gray-300">{stepInfo.label}</span>
                          </div>
                          {/* Step progress dots */}
                          <div className="flex items-center gap-0.5 justify-center mt-1.5">
                            {[1, 2, 3, 4, 5].map((s) => (
                              <div
                                key={s}
                                className={`w-4 h-1 rounded-full transition-colors ${
                                  s <= j.currentStep
                                    ? s === 5 ? "bg-green-500" : "bg-green-500/70"
                                    : "bg-gray-700"
                                }`}
                              />
                            ))}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${statusInfo.color}`}>
                            {statusInfo.label}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {j.resNumber ? (
                            <span className="text-xs font-bold text-green-400 font-mono">{j.resNumber}</span>
                          ) : (
                            <span className="text-gray-600 text-xs">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button className="text-gray-500 hover:text-white transition-colors">
                            <svg className={`w-4 h-4 transition-transform ${isExpanded ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                            </svg>
                          </button>
                        </td>
                      </tr>

                      {/* Expanded Details */}
                      {isExpanded && (
                        <tr key={`${j.id}-details`} className="bg-gray-800/20">
                          <td colSpan={7} className="px-6 py-5">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                              {/* Column 1: Trip Details */}
                              <div className="space-y-3">
                                <h4 className="text-xs font-bold text-gray-400 uppercase flex items-center gap-1.5">
                                  <span className="w-1 h-3 bg-blue-500 rounded-full"></span>
                                  Dados da Pesquisa
                                </h4>
                                <div className="bg-gray-900 rounded-lg p-3 space-y-2 text-xs">
                                  <div className="flex justify-between">
                                    <span className="text-gray-500">Retirada:</span>
                                    <span className="text-white font-bold">{j.pickupStationName || j.pickupStation || "—"}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-gray-500">Devolução:</span>
                                    <span className="text-white font-bold">{j.returnStationName || j.returnStation || "—"}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-gray-500">Data Retirada:</span>
                                    <span className="text-white">{fmtDateShort(j.pickupDate)} {fmtTime(j.pickupTime)}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-gray-500">Data Devolução:</span>
                                    <span className="text-white">{fmtDateShort(j.returnDate)} {fmtTime(j.returnTime)}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-gray-500">País:</span>
                                    <span className="text-white">{j.country || "—"}</span>
                                  </div>
                                  {j.contractID && (
                                    <div className="flex justify-between">
                                      <span className="text-gray-500">Contrato/Promo:</span>
                                      <span className="text-yellow-400 font-mono font-bold">{j.contractID}</span>
                                    </div>
                                  )}
                                </div>
                              </div>

                              {/* Column 2: Selection */}
                              <div className="space-y-3">
                                <h4 className="text-xs font-bold text-gray-400 uppercase flex items-center gap-1.5">
                                  <span className="w-1 h-3 bg-yellow-500 rounded-full"></span>
                                  Seleções
                                </h4>
                                <div className="bg-gray-900 rounded-lg p-3 space-y-2 text-xs">
                                  <div className="flex justify-between">
                                    <span className="text-gray-500">Carro:</span>
                                    <span className="text-white font-bold">{j.selectedCarName || "Não selecionou"}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-gray-500">Código:</span>
                                    <span className="text-white font-mono">{j.selectedCar || "—"}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-gray-500">Preço:</span>
                                    <span className="text-green-400 font-bold">{j.carPrice ? `R$ ${j.carPrice.toFixed(2).replace(".", ",")}` : "—"}</span>
                                  </div>
                                  {j.selectedExtras && Array.isArray(j.selectedExtras) && j.selectedExtras.length > 0 && (
                                    <div>
                                      <span className="text-gray-500 block mb-1">Extras:</span>
                                      <div className="flex flex-wrap gap-1">
                                        {j.selectedExtras.map((ex: string, idx: number) => (
                                          <span key={idx} className="text-[10px] bg-gray-800 text-gray-300 px-2 py-0.5 rounded-full">{ex}</span>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                  {j.paymentMethod && (
                                    <div className="flex justify-between">
                                      <span className="text-gray-500">Pagamento:</span>
                                      <span className="text-white font-bold">{j.paymentMethod}</span>
                                    </div>
                                  )}
                                </div>
                              </div>

                              {/* Column 3: Session Info */}
                              <div className="space-y-3">
                                <h4 className="text-xs font-bold text-gray-400 uppercase flex items-center gap-1.5">
                                  <span className="w-1 h-3 bg-purple-500 rounded-full"></span>
                                  Sessão
                                </h4>
                                <div className="bg-gray-900 rounded-lg p-3 space-y-2 text-xs">
                                  <div className="flex justify-between">
                                    <span className="text-gray-500">Session ID:</span>
                                    <span className="text-white font-mono text-[10px]">{j.sessionId?.slice(0, 12)}...</span>
                                  </div>
                                  {j.userId && (
                                    <div className="flex justify-between">
                                      <span className="text-gray-500">User ID:</span>
                                      <span className="text-white font-mono text-[10px]">{j.userId}</span>
                                    </div>
                                  )}
                                  <div className="flex justify-between">
                                    <span className="text-gray-500">IP:</span>
                                    <span className="text-white font-mono">{j.ipAddress || "—"}</span>
                                  </div>
                                  <div>
                                    <span className="text-gray-500 block mb-1">Navegador:</span>
                                    <span className="text-[10px] text-gray-400 break-all">{j.userAgent?.slice(0, 80) || "—"}{j.userAgent?.length > 80 ? "..." : ""}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-gray-500">Criado:</span>
                                    <span className="text-white">{fmtDate(j.createdAt)}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-gray-500">Atualizado:</span>
                                    <span className="text-white">{fmtDate(j.updatedAt)}</span>
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* Journey Timeline */}
                            <div className="mt-4 pt-4 border-t border-gray-800">
                              <h4 className="text-xs font-bold text-gray-400 uppercase mb-3">Linha do Tempo</h4>
                              <div className="flex items-center gap-2">
                                {[1, 2, 3, 4, 5].map((s) => {
                                  const si = STEP_LABELS[s];
                                  const reached = s <= j.currentStep;
                                  return (
                                    <div key={s} className="flex items-center gap-2 flex-1">
                                      <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                        reached
                                          ? s === j.currentStep && j.status !== "COMPLETED"
                                            ? "bg-yellow-600/20 text-yellow-400 border border-yellow-600/30"
                                            : "bg-green-600/20 text-green-400 border border-green-600/30"
                                          : "bg-gray-800 text-gray-600 border border-gray-700"
                                      }`}>
                                        <span>{si.icon}</span>
                                        <span className="hidden md:inline">{si.label}</span>
                                      </div>
                                      {s < 5 && (
                                        <div className={`flex-1 h-0.5 rounded ${reached && s < j.currentStep ? "bg-green-600" : "bg-gray-700"}`}></div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-6 py-4 border-t border-gray-800 flex items-center justify-between">
            <button
              onClick={() => fetchJourneys(page - 1)}
              disabled={page <= 1}
              className="text-xs font-bold text-gray-400 hover:text-white disabled:opacity-30 transition-colors"
            >
              ← Anterior
            </button>
            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                const p = i + 1;
                return (
                  <button
                    key={p}
                    onClick={() => fetchJourneys(p)}
                    className={`w-8 h-8 rounded text-xs font-bold transition-colors ${
                      p === page ? "bg-green-600 text-white" : "text-gray-500 hover:bg-gray-800"
                    }`}
                  >
                    {p}
                  </button>
                );
              })}
              {totalPages > 7 && <span className="text-gray-600 text-xs">...</span>}
            </div>
            <button
              onClick={() => fetchJourneys(page + 1)}
              disabled={page >= totalPages}
              className="text-xs font-bold text-gray-400 hover:text-white disabled:opacity-30 transition-colors"
            >
              Próxima →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
