"use client";

import { useState, useEffect, useRef } from "react";

const TIMES = Array.from({ length: 24 * 4 }).map((_, i) => {
  const h = Math.floor(i / 4)
    .toString()
    .padStart(2, "0");
  const m = ((i % 4) * 15).toString().padStart(2, "0");
  return `${h}:${m}`;
});

const AGES = [
  ...Array.from({ length: 8 }, (_, i) => 18 + i).map(String),
  "26+",
];

const COUNTRIES = [
  { code: "BR", name: "Brasil", emoji: "🇧🇷" },
  { code: "AR", name: "Argentina", emoji: "🇦🇷" },
  { code: "US", name: "Estados Unidos", emoji: "🇺🇸" },
  { code: "CA", name: "Canadá", emoji: "🇨🇦" },
  { code: "MX", name: "México", emoji: "🇲🇽" },
  { code: "AL", name: "Albânia", emoji: "🇦🇱" },
  { code: "AD", name: "Andorra", emoji: "🇦🇩" },
  { code: "AM", name: "Armênia", emoji: "🇦🇲" },
  { code: "AT", name: "Áustria", emoji: "🇦🇹" },
  { code: "BY", name: "Bielorrússia", emoji: "🇧🇾" },
  { code: "BE", name: "Bélgica", emoji: "🇧🇪" },
  { code: "BA", name: "Bósnia e Herzegovina", emoji: "🇧🇦" },
  { code: "BG", name: "Bulgária", emoji: "🇧🇬" },
  { code: "HR", name: "Croácia", emoji: "🇭🇷" },
  { code: "CY", name: "Chipre", emoji: "🇨🇾" },
  { code: "CZ", name: "República Checa", emoji: "🇨🇿" },
  { code: "DK", name: "Dinamarca", emoji: "🇩🇰" },
  { code: "EE", name: "Estônia", emoji: "🇪🇪" },
  { code: "FI", name: "Finlândia", emoji: "🇫🇮" },
  { code: "FR", name: "França", emoji: "🇫🇷" },
  { code: "GE", name: "Geórgia", emoji: "🇬🇪" },
  { code: "DE", name: "Alemanha", emoji: "🇩🇪" },
  { code: "GR", name: "Grécia", emoji: "🇬🇷" },
  { code: "HU", name: "Hungria", emoji: "🇭🇺" },
  { code: "IS", name: "Islândia", emoji: "🇮🇸" },
  { code: "IE", name: "Irlanda", emoji: "🇮🇪" },
  { code: "IT", name: "Itália", emoji: "🇮🇹" },
  { code: "KZ", name: "Cazaquistão", emoji: "🇰🇿" },
  { code: "XK", name: "Kosovo", emoji: "🇽🇰" },
  { code: "LV", name: "Letônia", emoji: "🇱🇻" },
  { code: "LI", name: "Liechtenstein", emoji: "🇱🇮" },
  { code: "LT", name: "Lituânia", emoji: "🇱🇹" },
  { code: "LU", name: "Luxemburgo", emoji: "🇱🇺" },
  { code: "MT", name: "Malta", emoji: "🇲🇹" },
  { code: "MD", name: "Moldávia", emoji: "🇲🇩" },
  { code: "MC", name: "Mônaco", emoji: "🇲🇨" },
  { code: "ME", name: "Montenegro", emoji: "🇲🇪" },
  { code: "NL", name: "Países Baixos", emoji: "🇳🇱" },
  { code: "MK", name: "Macedônia do Norte", emoji: "🇲🇰" },
  { code: "NO", name: "Noruega", emoji: "🇳🇴" },
  { code: "PL", name: "Polônia", emoji: "🇵🇱" },
  { code: "PT", name: "Portugal", emoji: "🇵🇹" },
  { code: "RO", name: "Romênia", emoji: "🇷🇴" },
  { code: "RU", name: "Rússia", emoji: "🇷🇺" },
  { code: "SM", name: "San Marino", emoji: "🇸🇲" },
  { code: "RS", name: "Sérvia", emoji: "🇷🇸" },
  { code: "SK", name: "Eslováquia", emoji: "🇸🇰" },
  { code: "SI", name: "Eslovênia", emoji: "🇸🇮" },
  { code: "ES", name: "Espanha", emoji: "🇪🇸" },
  { code: "SE", name: "Suécia", emoji: "🇸🇪" },
  { code: "CH", name: "Suíça", emoji: "🇨🇭" },
  { code: "TR", name: "Turquia", emoji: "🇹🇷" },
  { code: "UA", name: "Ucrânia", emoji: "🇺🇦" },
  { code: "GB", name: "Reino Unido", emoji: "🇬🇧" },
  { code: "VA", name: "Vaticano", emoji: "🇻🇦" },
];

export default function HeroSearchForm() {
  const [pickupLocation, setPickupLocation] = useState("");
  const [stationCountryCode, setStationCountryCode] = useState("");
  const [stationQuery, setStationQuery] = useState("");
  const [stations, setStations] = useState<any[]>([]);
  const [showStationsList, setShowStationsList] = useState(false);
  const [hoveredStation, setHoveredStation] = useState<any>(null);
  const [stationDetail, setStationDetail] = useState<any>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const detailCacheRef = useRef<Record<string, any>>({});

  // Return station (One-Way)
  const [returnLocation, setReturnLocation] = useState("");
  const [returnStationQuery, setReturnStationQuery] = useState("");
  const [returnStations, setReturnStations] = useState<any[]>([]);
  const [showReturnStationsList, setShowReturnStationsList] = useState(false);
  const [hoveredReturnStation, setHoveredReturnStation] = useState<any>(null);
  const [returnStationDetail, setReturnStationDetail] = useState<any>(null);
  const [loadingReturnDetail, setLoadingReturnDetail] = useState(false);
  const returnDetailCacheRef = useRef<Record<string, any>>({});
  const returnStationRef = useRef<HTMLDivElement>(null);

  const [pickupDate, setPickupDate] = useState("");
  const [pickupTime, setPickupTime] = useState("10:00");
  const [returnDate, setReturnDate] = useState("");
  const [returnTime, setReturnTime] = useState("10:00");

  const [age, setAge] = useState("26+");
  const [country, setCountry] = useState("BR");
  const [sameReturnLocation, setSameReturnLocation] = useState(true);

  // Tarifa Popover
  const [showTariffPopover, setShowTariffPopover] = useState(false);
  const [tarifNumber, setTarifNumber] = useState("");
  const popoverRef = useRef<HTMLDivElement>(null);

  // Auto-fill contractID from URL (e.g. when clicking a promotion)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const contractFromURL = urlParams.get('contractID');
      if (contractFromURL) {
        setTarifNumber(contractFromURL);
        setShowTariffPopover(true);
      }
    }
  }, []);

  // Date Picker Custom Popover
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Data mínima: +1 dia (estações validadas em 28/05/2026 — CallerCode 1132581 confirmado)
  const minPickupDate = (() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split("T")[0];
  })();

  // Fetch stations on type
  useEffect(() => {
    if (stationQuery.length > 2) {
      const fetchStations = async () => {
        try {
          const res = await fetch(
            `/api/europcar/getStations?q=${encodeURIComponent(stationQuery)}`,
          );
          const data = await res.json();
          setStations(data.stations || []);
          setShowStationsList(true);
          if (data.stations && data.stations.length > 0) {
            setHoveredStation(data.stations[0]);
          }
        } catch (e) {
          console.error(e);
        }
      };
      const debounce = setTimeout(fetchStations, 400);
      return () => clearTimeout(debounce);
    } else {
      setShowStationsList(false);
      setHoveredStation(null);
    }
  }, [stationQuery]);

  // Fetch return stations on type (One-Way)
  useEffect(() => {
    if (sameReturnLocation) return;
    if (returnStationQuery.length > 2) {
      const fetchStations = async () => {
        try {
          const res = await fetch(
            `/api/europcar/getStations?q=${encodeURIComponent(returnStationQuery)}`,
          );
          const data = await res.json();
          setReturnStations(data.stations || []);
          setShowReturnStationsList(true);
          if (data.stations && data.stations.length > 0) {
            setHoveredReturnStation(data.stations[0]);
          }
        } catch (e) {
          console.error(e);
        }
      };
      const debounce = setTimeout(fetchStations, 400);
      return () => clearTimeout(debounce);
    } else {
      setShowReturnStationsList(false);
      setHoveredReturnStation(null);
    }
  }, [returnStationQuery, sameReturnLocation]);

  // Fetch detailed station info (opening hours) when hovering
  useEffect(() => {
    if (!hoveredStation?.code) { setStationDetail(null); return; }
    const code = hoveredStation.code;
    // Use cache to avoid repeated calls
    if (detailCacheRef.current[code]) {
      setStationDetail(detailCacheRef.current[code]);
      return;
    }
    setLoadingDetail(true);
    const timer = setTimeout(() => {
      fetch(`/api/europcar/getStation?code=${code}`)
        .then(r => r.json())
        .then(d => {
          if (d.station) {
            detailCacheRef.current[code] = d.station;
            setStationDetail(d.station);
          }
        })
        .catch(() => {})
        .finally(() => setLoadingDetail(false));
    }, 200); // small debounce to avoid firing on fast mouse movements
    return () => clearTimeout(timer);
  }, [hoveredStation]);

  // Fetch return station detail when hovering (One-Way)
  useEffect(() => {
    if (!hoveredReturnStation?.code) { setReturnStationDetail(null); return; }
    const code = hoveredReturnStation.code;
    if (returnDetailCacheRef.current[code]) {
      setReturnStationDetail(returnDetailCacheRef.current[code]);
      return;
    }
    setLoadingReturnDetail(true);
    const timer = setTimeout(() => {
      fetch(`/api/europcar/getStation?code=${code}`)
        .then(r => r.json())
        .then(d => {
          if (d.station) {
            returnDetailCacheRef.current[code] = d.station;
            setReturnStationDetail(d.station);
          }
        })
        .catch(() => {})
        .finally(() => setLoadingReturnDetail(false));
    }, 200);
    return () => clearTimeout(timer);
  }, [hoveredReturnStation]);

  // Handle outside click popovers
  useEffect(() => {
    function handleClickOutside(event: any) {
      if (popoverRef.current && !popoverRef.current.contains(event.target)) {
        setShowTariffPopover(false);
      }
      if (returnStationRef.current && !returnStationRef.current.contains(event.target)) {
        setShowReturnStationsList(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();

    if (!pickupLocation) {
      alert("Selecione um local de retirada válido da lista");
      return;
    }
    if (!sameReturnLocation && !returnLocation) {
      alert("Selecione um local de devolução válido da lista");
      return;
    }
    if (!pickupDate) {
      alert("Selecione a data de retirada");
      return;
    }
    if (minPickupDate && pickupDate < minPickupDate) {
      alert(`A data mínima de retirada é ${minPickupDate}. Por favor selecione uma data válida.`);
      return;
    }

    const fmt = (d: string) => d.replace(/-/g, "");
    const fmtTime = (t: string) => t.replace(":", "");

    // Garantir returnDate >= pickupDate + 3 dias
    let effectiveReturn = returnDate;
    if (!effectiveReturn || effectiveReturn <= pickupDate) {
      const d = new Date(pickupDate);
      d.setDate(d.getDate() + 3);
      effectiveReturn = d.toISOString().split("T")[0];
    }

    const params = new URLSearchParams({
      pickup:      pickupLocation,
      return:      sameReturnLocation ? pickupLocation : (returnLocation || pickupLocation),
      date:        fmt(pickupDate),
      returnDate:  fmt(effectiveReturn),
      time:        fmtTime(pickupTime),
      returnTime:  fmtTime(returnTime),
      country:     country,
      countryName: COUNTRIES.find(c => c.code === country)?.name ?? country,
    });
    if (stationCountryCode) params.set("stationCountry", stationCountryCode);
    if (tarifNumber) params.set("contractID", tarifNumber);

    window.location.href = `/reservation/vehicles?${params.toString()}`;
  };

  const selectedCountryEmoji =
    COUNTRIES.find((c) => c.code === country)?.emoji || "🌎";

  return (
    <div className="bg-white rounded-xl shadow-[0_10px_40px_rgba(0,0,0,0.2)] overflow-visible p-6 md:p-8 relative mt-0">
      <h2 className="text-gray-900 font-bold mb-4 text-base md:text-lg">
        Qual tipo de veículo?
      </h2>

      {/* Veículo Type Tabs */}
      <div className="flex gap-0 border border-gray-300 rounded inline-flex mb-8">
        <button
          type="button"
          className="bg-[#008d36] text-white font-bold px-6 py-2 text-sm rounded-l shadow-sm flex items-center gap-2"
        >
          🚗 Carro
        </button>
        <button
          type="button"
          className="bg-white text-gray-700 font-bold px-6 py-2 text-sm rounded-r hover:bg-gray-50 flex items-center gap-2"
        >
          🚐 Furgões e caminhões
        </button>
      </div>

      <form onSubmit={handleSearch}>
        {/* Main Grid Filters */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {/* Pickup Location + Return Location */}
          <div className="lg:col-span-2 relative">
            <div className="flex justify-between items-center mb-2">
              <label className="text-sm font-bold text-gray-900">
                {sameReturnLocation ? "Local de retirada e devolução" : "Local de retirada"}
              </label>
              <label className="text-xs text-gray-400 font-bold flex items-center gap-1 cursor-pointer">
                <input
                  type="checkbox"
                  className="accent-[#008d36] w-4 h-4 rounded text-[#008d36] focus:ring-[#008d36] opacity-80"
                  checked={sameReturnLocation}
                  onChange={(e) => {
                    setSameReturnLocation(e.target.checked);
                    if (e.target.checked) {
                      setReturnLocation("");
                      setReturnStationQuery("");
                      setReturnStations([]);
                      setShowReturnStationsList(false);
                    }
                  }}
                />{" "}
                Mesmo local de devolução
              </label>
            </div>


            {/* Pickup Station Field - always visible */}
            <div className="relative">
                <span className="absolute left-3 top-3.5 text-[#008d36]">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path>
                  </svg>
                </span>
                <input
                  type="text"
                  placeholder={sameReturnLocation ? "Cidade, endereço, ponto de interesse" : "Local de retirada"}
                  className="w-full pl-11 p-4 bg-white border border-gray-300 rounded-lg focus:ring-1 focus:ring-[#008d36] focus:border-[#008d36] outline-none text-base font-medium transition-all text-gray-900 placeholder-gray-400"
                  value={stationQuery}
                  onChange={(e) => {
                    setStationQuery(e.target.value);
                    if (!e.target.value) setPickupLocation("");
                  }}
                  required
                />

                {/* Dropdown Autocomplete - Pickup Station */}
                {showStationsList && stations.length > 0 && (
                  <div className="absolute top-full left-0 w-full md:w-[760px] mt-2 bg-white flex shadow-2xl rounded-lg z-50 h-[380px] overflow-hidden border border-gray-200">
                    <div className="w-full md:w-[380px] flex flex-col border-r border-gray-200">
                      <div className="bg-gray-50 font-bold text-[10px] text-gray-500 px-4 py-2 border-b border-gray-200 tracking-wider">EUROPCAR STATION</div>
                      <div className="flex-1 overflow-y-auto">
                        {stations.map((station) => (
                          <div key={station.code} className={`px-4 py-3 cursor-pointer text-sm border-b border-gray-100 flex items-center gap-3 transition-colors ${hoveredStation?.code === station.code ? 'bg-gray-100' : 'hover:bg-gray-50 text-gray-700'}`} onMouseEnter={() => setHoveredStation(station)} onClick={() => { setPickupLocation(station.code); setStationCountryCode(station.countryCode || ''); setStationQuery(station.name); setShowStationsList(false); }}>
                            {station.type === 'airport' ? (<svg className="w-5 h-5 text-gray-400 shrink-0" fill="currentColor" viewBox="0 0 24 24"><path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z" /></svg>) : (<svg className="w-5 h-5 text-gray-400 shrink-0" fill="currentColor" viewBox="0 0 24 24"><path d="M15 11V5l-3-3-3 3v2H3v14h18V11h-6zm-8 8H5v-2h2v2zm0-4H5v-2h2v2zm0-4H5V9h2v2zm6 8h-2v-2h2v2zm0-4h-2v-2h2v2zm0-4h-2V9h2v2zm0-4h-2V5h2v2zm6 12h-2v-2h2v2zm0-4h-2v-2h2v2z" /></svg>)}
                            <div className="flex flex-col min-w-0">
                              <span className="font-extrabold text-xs uppercase text-gray-900 leading-snug truncate">{station.name}</span>
                              {station.country && (<span className="text-[10px] text-gray-400 font-medium">{station.country}</span>)}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                    {hoveredStation && (
                      <div className="hidden md:flex flex-col w-[380px] bg-[#f9f9f9] overflow-y-auto relative p-6">
                        <h3 className="font-extrabold text-sm uppercase text-black max-w-[80%] leading-tight">{stationDetail?.name || hoveredStation.name}</h3>
                        {hoveredStation.country && (<span className="text-[10px] bg-[#008d36]/10 text-[#008d36] font-bold px-2 py-0.5 rounded-full mt-1 w-fit">{hoveredStation.country}</span>)}
                        {(stationDetail?.address || hoveredStation.address) && (<p className="text-[11px] font-medium text-gray-500 mt-1 whitespace-pre-wrap leading-tight">{stationDetail?.address || hoveredStation.address}{stationDetail?.postalCode ? `, ${stationDetail.postalCode}` : ''}{stationDetail?.city ? ` — ${stationDetail.city}` : ''}</p>)}
                        {(stationDetail?.phone || stationDetail?.email) && (
                          <div className="mt-3 flex flex-col gap-1">
                            {stationDetail.phone && (<div className="flex items-center gap-1.5 text-[11px] text-gray-600"><svg className="w-3.5 h-3.5 text-[#008d36] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg><span className="font-bold">{stationDetail.phone}</span></div>)}
                            {stationDetail.email && (<div className="flex items-center gap-1.5 text-[11px] text-gray-600"><svg className="w-3.5 h-3.5 text-[#008d36] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg><span>{stationDetail.email}</span></div>)}
                          </div>
                        )}
                        <div className="mt-4">
                          <div className="flex items-center gap-1.5 mb-2"><svg className="w-3.5 h-3.5 text-[#008d36]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg><span className="text-[10px] font-black text-gray-700 uppercase tracking-wider">Horário de Funcionamento</span></div>
                          {loadingDetail ? (<div className="flex gap-1.5 items-center text-[11px] text-gray-400"><div className="w-3 h-3 border-2 border-[#008d36] border-t-transparent rounded-full animate-spin"></div>Consultando API Europcar...</div>) : stationDetail?.hours?.length ? (<div className="flex flex-col gap-0.5">{stationDetail.hours.map((h: any, i: number) => { const isClosed = !h.open || h.open === h.close || h.open === '00:00'; return (<div key={i} className="flex text-xs w-full justify-between py-0.5 border-b border-gray-100 last:border-0"><span className="font-bold text-gray-800 w-8 shrink-0">{h.day}</span>{isClosed ? (<span className="text-red-500 font-bold">Fechado</span>) : (<span className="text-gray-600 font-medium">{h.open} – {h.close}</span>)}</div>); })}</div>) : hoveredStation.hours?.length ? (<div className="flex flex-col gap-0.5">{hoveredStation.hours.map((h: any, i: number) => (<div key={i} className="flex text-xs w-full justify-between py-0.5 border-b border-gray-100 last:border-0"><span className="font-bold text-gray-800 w-8 shrink-0">{h.day}</span><span className="text-gray-600 font-medium">{h.hours}</span></div>))}</div>) : (<p className="text-[11px] text-gray-400 italic">Consulte a loja para informações de horário.</p>)}
                        </div>
                        <button onClick={() => { setPickupLocation(hoveredStation.code); setStationCountryCode(hoveredStation.countryCode || ''); setStationQuery(hoveredStation.name); setShowStationsList(false); }} className="mt-4 w-full bg-[#008d36] hover:bg-[#007530] text-white font-bold text-sm py-2.5 rounded transition-colors">Selecionar esta loja</button>
                      </div>
                    )}
                  </div>
                )}
            </div>

            {/* Return Station Field - only when One-Way */}
            {!sameReturnLocation && (
              <div className="relative mt-3" ref={returnStationRef}>
                <label className="text-sm font-bold text-[#e67e00] block mb-2">Local de devolução</label>
                <div className="relative">
                  <span className="absolute left-3 top-3.5 text-[#e67e00]">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path>
                    </svg>
                  </span>
                  <input
                    type="text"
                    placeholder="Cidade, endereço ou ponto de interesse"
                    className="w-full pl-11 p-4 bg-white border border-[#e67e00] rounded-lg focus:ring-1 focus:ring-[#e67e00] focus:border-[#e67e00] outline-none text-base font-medium transition-all text-gray-900 placeholder-gray-400"
                    value={returnStationQuery}
                    onChange={(e) => {
                      setReturnStationQuery(e.target.value);
                      if (!e.target.value) setReturnLocation("");
                    }}
                  />

                  {/* Dropdown Autocomplete - Return Station */}
                  {showReturnStationsList && returnStations.length > 0 && (
                    <div className="absolute top-full left-0 w-full md:w-[760px] mt-2 bg-white flex shadow-2xl rounded-lg z-50 h-[380px] overflow-hidden border border-gray-200">
                      <div className="w-full md:w-[380px] flex flex-col border-r border-gray-200">
                        <div className="bg-orange-50 font-bold text-[10px] text-orange-600 px-4 py-2 border-b border-gray-200 tracking-wider">LOCAL DE DEVOLUÇÃO</div>
                        <div className="flex-1 overflow-y-auto">
                          {returnStations.map((station) => (
                            <div key={station.code} className={`px-4 py-3 cursor-pointer text-sm border-b border-gray-100 flex items-center gap-3 transition-colors ${hoveredReturnStation?.code === station.code ? 'bg-orange-50' : 'hover:bg-gray-50 text-gray-700'}`} onMouseEnter={() => setHoveredReturnStation(station)} onClick={() => { setReturnLocation(station.code); setReturnStationQuery(station.name); setShowReturnStationsList(false); }}>
                              {station.type === 'airport' ? (<svg className="w-5 h-5 text-gray-400 shrink-0" fill="currentColor" viewBox="0 0 24 24"><path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z" /></svg>) : (<svg className="w-5 h-5 text-gray-400 shrink-0" fill="currentColor" viewBox="0 0 24 24"><path d="M15 11V5l-3-3-3 3v2H3v14h18V11h-6zm-8 8H5v-2h2v2zm0-4H5v-2h2v2zm0-4H5V9h2v2zm6 8h-2v-2h2v2zm0-4h-2v-2h2v2zm0-4h-2V9h2v2zm0-4h-2V5h2v2zm6 12h-2v-2h2v2zm0-4h-2v-2h2v2z" /></svg>)}
                              <div className="flex flex-col min-w-0">
                                <span className="font-extrabold text-xs uppercase text-gray-900 leading-snug truncate">{station.name}</span>
                                {station.country && (<span className="text-[10px] text-gray-400 font-medium">{station.country}</span>)}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                      {hoveredReturnStation && (
                        <div className="hidden md:flex flex-col w-[380px] bg-[#fffaf5] overflow-y-auto relative p-6">
                          <h3 className="font-extrabold text-sm uppercase text-black max-w-[80%] leading-tight">{returnStationDetail?.name || hoveredReturnStation.name}</h3>
                          {hoveredReturnStation.country && (<span className="text-[10px] bg-[#e67e00]/10 text-[#e67e00] font-bold px-2 py-0.5 rounded-full mt-1 w-fit">{hoveredReturnStation.country}</span>)}
                          {(returnStationDetail?.address || hoveredReturnStation.address) && (<p className="text-[11px] font-medium text-gray-500 mt-1 whitespace-pre-wrap leading-tight">{returnStationDetail?.address || hoveredReturnStation.address}{returnStationDetail?.postalCode ? `, ${returnStationDetail.postalCode}` : ''}{returnStationDetail?.city ? ` — ${returnStationDetail.city}` : ''}</p>)}
                          {(returnStationDetail?.phone || returnStationDetail?.email) && (
                            <div className="mt-3 flex flex-col gap-1">
                              {returnStationDetail.phone && (<div className="flex items-center gap-1.5 text-[11px] text-gray-600"><svg className="w-3.5 h-3.5 text-[#e67e00] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg><span className="font-bold">{returnStationDetail.phone}</span></div>)}
                              {returnStationDetail.email && (<div className="flex items-center gap-1.5 text-[11px] text-gray-600"><svg className="w-3.5 h-3.5 text-[#e67e00] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg><span>{returnStationDetail.email}</span></div>)}
                            </div>
                          )}
                          <div className="mt-4">
                            <div className="flex items-center gap-1.5 mb-2"><svg className="w-3.5 h-3.5 text-[#e67e00]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg><span className="text-[10px] font-black text-gray-700 uppercase tracking-wider">Horário de Funcionamento</span></div>
                            {loadingReturnDetail ? (<div className="flex gap-1.5 items-center text-[11px] text-gray-400"><div className="w-3 h-3 border-2 border-[#e67e00] border-t-transparent rounded-full animate-spin"></div>Consultando API Europcar...</div>) : returnStationDetail?.hours?.length ? (<div className="flex flex-col gap-0.5">{returnStationDetail.hours.map((h: any, i: number) => { const isClosed = !h.open || h.open === h.close || h.open === '00:00'; return (<div key={i} className="flex text-xs w-full justify-between py-0.5 border-b border-gray-100 last:border-0"><span className="font-bold text-gray-800 w-8 shrink-0">{h.day}</span>{isClosed ? (<span className="text-red-500 font-bold">Fechado</span>) : (<span className="text-gray-600 font-medium">{h.open} – {h.close}</span>)}</div>); })}</div>) : hoveredReturnStation.hours?.length ? (<div className="flex flex-col gap-0.5">{hoveredReturnStation.hours.map((h: any, i: number) => (<div key={i} className="flex text-xs w-full justify-between py-0.5 border-b border-gray-100 last:border-0"><span className="font-bold text-gray-800 w-8 shrink-0">{h.day}</span><span className="text-gray-600 font-medium">{h.hours}</span></div>))}</div>) : (<p className="text-[11px] text-gray-400 italic">Consulte a loja para informações de horário.</p>)}
                          </div>
                          <button onClick={() => { setReturnLocation(hoveredReturnStation.code); setReturnStationQuery(hoveredReturnStation.name); setShowReturnStationsList(false); }} className="mt-4 w-full bg-[#e67e00] hover:bg-[#cc6f00] text-white font-bold text-sm py-2.5 rounded transition-colors">Selecionar esta loja</button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>


          {/* Pickup Date / Time */}
          <div className="relative">
            <label className="text-sm font-bold text-gray-900 block mb-2">
              Data e hora de retirada
            </label>
            <div className={`flex border rounded-lg overflow-hidden transition-colors border-gray-300 focus-within:border-[#008d36] focus-within:ring-1 focus-within:ring-[#008d36]`}>
              <div className="flex-1 flex items-center bg-white px-3 border-r border-gray-200">
                <input
                  type="date"
                  className="w-full py-3 bg-transparent outline-none text-sm font-bold text-gray-900 cursor-pointer"
                  value={pickupDate}
                  min={minPickupDate}
                  onChange={(e) => setPickupDate(e.target.value)}
                  required
                />
              </div>
              <select
                className="w-20 px-2 py-3 bg-white border-l-0 outline-none text-sm text-gray-900 font-bold"
                value={pickupTime}
                onChange={(e) => setPickupTime(e.target.value)}
              >
                {TIMES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Return Date / Time */}
          <div>
            <label className="text-sm font-bold text-gray-900 block mb-2">
              Data e hora de devolução
            </label>
            <div className={`flex border rounded-lg overflow-hidden transition-colors border-gray-300 focus-within:border-[#008d36] focus-within:ring-1 focus-within:ring-[#008d36]`}>
              <div className="flex-1 flex items-center bg-white px-3 border-r border-gray-200">
                <input
                  type="date"
                  className="w-full py-3 bg-transparent outline-none text-sm font-bold text-gray-900 cursor-pointer"
                  value={returnDate}
                  onChange={(e) => setReturnDate(e.target.value)}
                  min={pickupDate || minPickupDate}
                  required
                />
              </div>
              <select
                className="w-20 px-2 py-3 bg-white border-l-0 outline-none text-sm text-gray-900 font-bold"
                value={returnTime}
                onChange={(e) => setReturnTime(e.target.value)}
              >
                {TIMES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex flex-col md:flex-row justify-between items-center gap-6 mt-8">
          <div className="flex gap-8 items-center w-auto">
            {/* Idade Dropdown */}
            <div className="flex items-center gap-1 cursor-pointer text-sm relative group">
              <span className="font-bold text-gray-500">Tenho </span>
              <select
                value={age}
                onChange={(e) => setAge(e.target.value)}
                className="text-gray-900 font-bold bg-transparent border-none appearance-none outline-none pr-4 cursor-pointer"
                style={{ WebkitAppearance: "none", background: "transparent" }}
              >
                {AGES.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
              <svg
                className="w-4 h-4 text-[#008d36] absolute right-0 pointer-events-none"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="3"
                  d="M19 9l-7 7-7-7"
                ></path>
              </svg>
            </div>

            {/* País Dropdown */}
            <div className="flex items-center gap-1 cursor-pointer text-sm relative group">
              <span className="font-bold text-gray-500 whitespace-nowrap">
                Eu resido em{" "}
              </span>

              <div className="relative flex items-center">
                <span className="mr-1">{selectedCountryEmoji}</span>
                <select
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  className="text-gray-900 font-bold bg-transparent border-none appearance-none outline-none pr-4 cursor-pointer"
                  style={{
                    WebkitAppearance: "none",
                    background: "transparent",
                  }}
                >
                  {COUNTRIES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <svg
                  className="w-4 h-4 text-[#008d36] absolute right-0 pointer-events-none"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="3"
                    d="M19 9l-7 7-7-7"
                  ></path>
                </svg>
              </div>
            </div>
          </div>

          <div
            className="flex items-center justify-end gap-6 w-full md:w-auto mt-4 md:mt-0 relative"
            ref={popoverRef}
          >
            {/* Tarifa checkbox / label which opens popover */}
            <div
              className="flex items-center gap-2 cursor-pointer group select-none"
              onClick={() => setShowTariffPopover(!showTariffPopover)}
            >
              <div
                className={`w-5 h-5 rounded flex items-center justify-center transition-colors ${tarifNumber || showTariffPopover ? "bg-[#008d36]" : "border border-gray-300"}`}
              >
                {(tarifNumber || showTariffPopover) && (
                  <svg
                    className="w-3 h-3 text-white"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="3"
                      d="M5 13l4 4L19 7"
                    ></path>
                  </svg>
                )}
              </div>
              <span className="text-[14px] text-gray-500 font-bold">
                Tenho uma{" "}
                <span className="text-gray-900">tarifa contratada</span>
              </span>
              <svg
                className="w-4 h-4 text-gray-400 group-hover:text-gray-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                ></path>
              </svg>
            </div>

            {/* Tarifa Popover - Exact match implementation */}
            {showTariffPopover && (
              <div className="absolute top-full right-1/2 md:right-0 transform md:translate-x-0 translate-x-1/2 mt-4 w-[350px] bg-white rounded-lg shadow-2xl z-50 overflow-hidden flex flex-col border border-gray-200">
                <div className="p-5 flex flex-col gap-3">
                  <h3 className="font-extrabold text-[#000000] text-[16px] leading-[22px]">
                    Está a viajar em trabalho ou lazer e vai pagar com cartão de
                    crédito ou charge card
                  </h3>
                  <p className="text-[#000000] font-normal text-sm">
                    Indique a sua tarifa contratada
                  </p>

                  <div className="flex items-center gap-2">
                    <div className="flex-1 flex border-2 border-[#008d36] rounded px-3 py-2 items-center">
                      <svg
                        className="w-5 h-5 text-[#008d36] mr-2"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z"
                          clipRule="evenodd"
                          fillRule="evenodd"
                        ></path>
                      </svg>
                      <input
                        type="text"
                        placeholder="Insira um número"
                        value={tarifNumber}
                        onChange={(e) => setTarifNumber(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') setShowTariffPopover(false); }}
                        className="w-full text-base font-normal outline-none"
                        autoFocus
                      />
                      {tarifNumber && (
                        <button
                          type="button"
                          onClick={() => setTarifNumber('')}
                          className="text-gray-400 hover:text-gray-600 ml-1 shrink-0"
                          title="Limpar"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowTariffPopover(false)}
                      className={`w-12 h-11 rounded flex justify-center items-center transition-colors ${
                        tarifNumber ? 'bg-[#008d36] hover:bg-[#007530]' : 'bg-[#ebebeb] hover:bg-gray-200'
                      }`}
                    >
                      <svg
                        className={`w-6 h-6 font-bold ${ tarifNumber ? 'text-white' : 'text-black'}`}
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="3"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M14 5l7 7m0 0l-7 7m7-7H3"
                        ></path>
                      </svg>
                    </button>
                  </div>
                </div>

                <div className="border-t border-gray-200 mt-2 mx-5"></div>

                <div className="p-5 flex flex-col gap-2">
                  <h3 className="font-extrabold text-[#000000] text-[15px] leading-[21px]">
                    Está a viajar em trabalho e quer pagar com outro meio de
                    pagamento ou necessita de um serviço de Entrega/Recolha
                  </h3>
                  <a
                    href="#"
                    className="font-semibold text-sm text-gray-900 mt-2 flex items-center hover:underline"
                  >
                    Ir para acesso de Empresa{" "}
                    <svg
                      className="w-5 h-5 ml-1 mt-0.5 font-bold"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M14 5l7 7m0 0l-7 7m7-7H3"
                      ></path>
                    </svg>
                  </a>
                </div>

                <div className="bg-[#f2f2f2] p-5">
                  <h3 className="font-extrabold text-[#000000] text-sm">
                    Tem um código de cupão?
                  </h3>
                  <p className="text-gray-600 font-medium text-[13px] leading-snug mt-1">
                    Se tiver um código de cupão alfanumérico, poderá aplicá-lo
                    na página de pagamento deste site no ato da reserva.
                  </p>
                </div>
              </div>
            )}

            {/* ✅ Badge de tarifa ativa — aparece após fechar o popover com código preenchido */}
            {!showTariffPopover && tarifNumber && (
              <div className="absolute -bottom-7 right-0 flex items-center gap-1.5 bg-green-50 border border-green-300 rounded-full px-3 py-1">
                <svg className="w-3.5 h-3.5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-[11px] font-bold text-green-700">Tarifa contratada ativa:</span>
                <span className="text-[11px] font-mono font-black text-green-800">{tarifNumber}</span>
                <button
                  type="button"
                  onClick={() => setTarifNumber('')}
                  className="text-green-500 hover:text-red-500 ml-1"
                  title="Remover tarifa"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            )}

            <button
              type="submit"
              className="w-full md:w-56 bg-[#ffcc00] hover:bg-[#e6b800] text-gray-900 font-black py-4 px-8 rounded transition-colors text-base flex justify-center items-center shadow-md border-0"
            >
              Pesquisar
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
