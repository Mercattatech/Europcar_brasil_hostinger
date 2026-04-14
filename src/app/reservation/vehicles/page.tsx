"use client";

import Link from "next/link";
import { useState, useMemo, useEffect, useCallback, Suspense } from "react";
import { useSession, signOut } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import LoginModal from "@/components/auth/LoginModal";

function getVehicleType(car: any): string {
  const code = car.carCategoryCode || "";
  if (car.carType === "TR") return "Furgões e caminhões";
  if (code.startsWith("U") || code.startsWith("L")) return "Premium";
  return "Carro";
}

// Multi-source car image: official API URL → sample name → ACRISS code → placeholder
function CarImage({ sample, code, alt, imageUrl }: { sample: string; code: string; alt: string; imageUrl?: string }) {
  const sources = [
    // 1. Official image from XRS API (carvisual link — HD 835x557)
    imageUrl || null,
    // 2. By brand/model name from carCategorySample
    sample ? (() => {
      const parts = sample.split(" ");
      const brand = parts[0].toLowerCase().replace(/[^a-z0-9]/g, "");
      const model = parts.slice(1, 3).join("-").toLowerCase().replace(/[^a-z0-9-]/g, "");
      return `https://www.europcar.com/vehicles/images/223/cars/${brand}/${model}.png`;
    })() : null,
    // 3. By ACRISS category code
    code ? `https://static.europcar.com/carvisuals/partners/835x557/${code}_IT.png` : null,
    // 4. Generic placeholder
    `https://placehold.co/400x200/f5f5f5/008d36?text=${encodeURIComponent(code || "CAR")}`,
  ].filter(Boolean) as string[];

  const [srcIdx, setSrcIdx] = useState(0);

  return (
    <img
      src={sources[srcIdx]}
      alt={alt}
      onError={() => { if (srcIdx < sources.length - 1) setSrcIdx(i => i + 1); }}
      className="object-contain w-full h-full mix-blend-multiply"
    />
  );
}



// ---- Inner component (needs useSearchParams inside Suspense) ----
function VehiclesContent() {
  const { data: session, status } = useSession();
  const searchParams = useSearchParams();
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [selectedCar, setSelectedCar] = useState<any>(null);
  const [currentStep, setCurrentStep] = useState(2);

  // URL params
  const pickupStation = searchParams.get("pickup") || "";
  const returnStation = searchParams.get("return") || pickupStation;
  const pickupDate = searchParams.get("date") || "";
  const pickupTime = (searchParams.get("time") || "1000").replace(":", "");
  const returnTime = (searchParams.get("returnTime") || "1000").replace(":", "");
  const contractID = searchParams.get("contractID") || "";
  const driverCountry = searchParams.get("country") || "BR";
  const driverCountryName = searchParams.get("countryName") || "Brasil";

  // Auto-compute returnDate (+3 days) if not in URL
  const returnDate = useMemo(() => {
    const rd = searchParams.get("returnDate");
    if (rd) return rd;
    if (!pickupDate || pickupDate.length < 8) return "";
    const y = parseInt(pickupDate.slice(0, 4));
    const m = parseInt(pickupDate.slice(4, 6)) - 1;
    const d = parseInt(pickupDate.slice(6, 8));
    const dt = new Date(y, m, d + 3);
    return `${dt.getFullYear()}${String(dt.getMonth() + 1).padStart(2, "0")}${String(dt.getDate()).padStart(2, "0")}`;
  }, [searchParams, pickupDate]);

  // contractID from sessionStorage
  const [sessionContractID, setSessionContractID] = useState("");
  useEffect(() => {
    try { setSessionContractID(sessionStorage.getItem("europcar_contractID") || ""); } catch { }
  }, []);
  const effectiveContractID = contractID || sessionContractID;

  // Station name display
  const [stationName, setStationName] = useState(pickupStation);
  useEffect(() => {
    if (!pickupStation) return;
    fetch(`/api/europcar/getStations?q=${pickupStation}`)
      .then(r => r.json())
      .then(d => {
        const s = d.stations?.find((x: any) => x.code === pickupStation);
        if (s) setStationName(s.name);
      }).catch(() => { });
  }, [pickupStation]);

  // XRS cars state
  const [cars, setCars] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Extras
  const [dbExtras, setDbExtras] = useState<any[]>([]);
  const [selectedExtrasMap, setSelectedExtrasMap] = useState<Record<string, number>>({});
  const [loadingExtras, setLoadingExtras] = useState(false);

  // Filters
  const [transmission, setTransmission] = useState("Ambos");
  const [vehicleType, setVehicleType] = useState("Todos");
  const [minSeats, setMinSeats] = useState(2);
  const [sortBy, setSortBy] = useState("Recomendado");

  const formatDate = (d: string) => d ? `${d.slice(6, 8)}/${d.slice(4, 6)}/${d.slice(0, 4)}` : "";

  // ---- Fetch vehicles from XRS ----
  const fetchCars = useCallback(async () => {
    if (!pickupStation || !pickupDate) {
      setError("Dados de pesquisa incompletos. Volte e tente novamente.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      // Step 1: getCarCategories → get ACRISS codes
      const catRes = await fetch("/api/europcar/getCarCategories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pickupStation, returnStation: returnStation || pickupStation, pickupDate, returnDate, pickupTime, returnTime }),
      });
      const catData = await catRes.json();

      const rawCatList =
        catData?.message?.serviceResponse?.carCategoryList?.carCategory ||
        catData?.serviceResponse?.carCategoryList?.carCategory || [];
      const catList: any[] = Array.isArray(rawCatList) ? rawCatList : rawCatList ? [rawCatList] : [];

      const acrissCodes = catList
        .map((c: any) => (c.$ ? c.$.carCategoryCode : c.carCategoryCode))
        .filter(Boolean);

      if (acrissCodes.length === 0) {
        setError("Nenhum veículo disponível para esta estação e período.");
        setLoading(false);
        return;
      }

      // Step 2: getMultipleRates → response is reservationRateList/reservationRate
      const ratesRes = await fetch("/api/europcar/getMultipleRates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pickupStation,
          returnStation: returnStation || pickupStation,
          pickupDate,
          returnDate,
          pickupTime,
          returnTime,
          acrissCodes,
          contractID: effectiveContractID,
        }),
      });
      const ratesData = await ratesRes.json();

      const allRates: any[] = [];
      const chunks = Array.isArray(ratesData.results) ? ratesData.results : [ratesData];

      for (const chunk of chunks) {
        const rawList =
          chunk?.message?.serviceResponse?.reservationRateList?.reservationRate ||
          chunk?.serviceResponse?.reservationRateList?.reservationRate || [];
        const rateArr: any[] = Array.isArray(rawList) ? rawList : rawList ? [rawList] : [];
        for (const r of rateArr) {
          const attrs = r.$ || r;
          if (!attrs.carCategoryCode || !attrs.totalRateEstimate) continue;

          // Extract official car image from <links><link id="carvisual" .../></links>
          const linksRaw = r.links?.link || [];
          const linksArr: any[] = Array.isArray(linksRaw) ? linksRaw : [linksRaw];
          const carvisual = linksArr.find((l: any) => (l.$ || l).id === "carvisual");
          const imageUrl: string = (carvisual?.$ || carvisual)?.value || "";

          // Extract optional insurances (type="O", price > 0) from <insuranceList>
          const rawIns = r.insuranceList?.insurance || [];
          const insArr: any[] = Array.isArray(rawIns) ? rawIns : [rawIns];
          const optionalInsurances = insArr
            .map((ins: any) => ins.$ || ins)
            .filter((ins: any) => ins.type === "O" && parseFloat(ins.price || "0") > 0);

          allRates.push({ ...attrs, imageUrl, optionalInsurances });
        }
      }


      if (allRates.length === 0) {
        setError("Sem tarifas disponíveis para o período selecionado. Tente outras datas.");
        setLoading(false);
        return;
      }

      setCars(allRates);
    } catch (e: any) {
      setError("Erro ao buscar veículos: " + (e.message || "Tente novamente."));
    } finally {
      setLoading(false);
    }
  }, [pickupStation, returnStation, pickupDate, returnDate, pickupTime, returnTime, effectiveContractID]);

  useEffect(() => { fetchCars(); }, [fetchCars]);

  // Load extras when advancing to step 3
  useEffect(() => {
    if (currentStep === 3 && dbExtras.length === 0) {
      setLoadingExtras(true);
      fetch("/api/admin/extras")
        .then(r => r.json())
        .then(d => setDbExtras(d.filter((e: any) => e.active)))
        .finally(() => setLoadingExtras(false));
    }
  }, [currentStep, dbExtras.length]);

  const handleExtraQuantity = (id: string, delta: number) => {
    setSelectedExtrasMap(prev => {
      const current = prev[id] || 0;
      const next = Math.max(0, current + delta);
      if (next === 0) { const { [id]: _, ...rest } = prev; return rest; }
      return { ...prev, [id]: next };
    });
  };

  const selectedExtrasPricePerDay = useMemo(() => {
    let sum = 0;
    for (const [id, qty] of Object.entries(selectedExtrasMap)) {
      const ext = dbExtras.find((e: any) => e.id === id);
      if (ext) sum += ext.pricePerDay * (qty as number);
    }
    return sum;
  }, [selectedExtrasMap, dbExtras]);

  const filteredCars = useMemo(() => {
    let result = cars.filter((car: any) => {
      const auto = car.carCategoryAutomatic === "Y";
      if (transmission === "Automática" && !auto) return false;
      if (transmission === "Manual" && auto) return false;
      if (vehicleType !== "Todos" && getVehicleType(car) !== vehicleType) return false;
      const seats = parseInt(car.carCategorySeats || "2");
      if (seats < minSeats) return false;
      return true;
    });
    if (sortBy === "Preço: Menor para maior") result.sort((a: any, b: any) => parseFloat(a.totalRateEstimate) - parseFloat(b.totalRateEstimate));
    else if (sortBy === "Preço: Maior para menor") result.sort((a: any, b: any) => parseFloat(b.totalRateEstimate) - parseFloat(a.totalRateEstimate));
    return result;
  }, [cars, transmission, vehicleType, minSeats, sortBy]);

  const priceRange = useMemo(() => {
    if (!filteredCars.length) return { min: 0, max: 0 };
    const prices = filteredCars.map((c: any) => parseFloat(c.totalRateEstimate || 0));
    return { min: Math.min(...prices), max: Math.max(...prices) };
  }, [filteredCars]);

  const handleSelectCar = (car: any) => {
    setSelectedCar(car);
    setCurrentStep(3);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const fmtPrice = (v: any) => parseFloat(String(v || 0)).toFixed(2).replace(".", ",");

  // ---- RENDER ----
  return (
    <div className="min-h-screen bg-[#f7f7f7] font-sans">
      {showLoginModal && <LoginModal onClose={() => setShowLoginModal(false)} />}

      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 h-20 flex justify-between items-center">
          <Link href="/">
            <div className="bg-[#008d36] px-4 py-2"><img src="/logo.jpg" alt="Europcar" className="h-10 object-contain" /></div>
          </Link>
          <div className="flex items-center gap-6 text-sm font-bold text-gray-900">
            {session?.user ? (
              <div className="flex items-center gap-4">
                <span className="text-[#008d36]">Olá, {session.user.name || session.user.email?.split("@")[0]}</span>
                <button onClick={() => signOut()} className="text-xs text-gray-500 hover:text-red-500 font-normal">Sair</button>
              </div>
            ) : status !== "loading" && (
              <button onClick={() => setShowLoginModal(true)} className="hover:text-[#008d36]">Fazer login</button>
            )}
            <span>🇧🇷 BR</span>
          </div>
        </div>
      </header>

      {/* Stepper */}
      <div className="bg-white border-b border-gray-200 py-4">
        <div className="max-w-7xl mx-auto px-4 flex gap-4">
          {/* Step 1 */}
          <div className="flex-1 bg-white border border-gray-200 rounded p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="bg-[#008d36] text-white font-bold text-xs w-5 h-5 flex items-center justify-center rounded-sm">1</span>
              <span className="text-[11px] font-bold text-gray-500 uppercase">LOCAL DO ALUGUEL</span>
            </div>
            <div className="flex justify-between text-xs">
              <div>
                <div className="font-bold text-gray-900 uppercase text-[10px]">Retirada</div>
                <div className="font-bold truncate max-w-[130px]">{stationName || pickupStation}</div>
                <div className="text-gray-500">{formatDate(pickupDate)}</div>
              </div>
              <div>
                <div className="font-bold text-gray-900 uppercase text-[10px]">Devolução</div>
                <div className="font-bold truncate max-w-[130px]">{stationName || (returnStation || pickupStation)}</div>
                <div className="text-gray-500">{formatDate(returnDate)}</div>
              </div>
            </div>
          </div>
          {/* Step 2 */}
          <div className={`flex-1 bg-white border-2 ${currentStep === 2 ? "border-[#008d36]" : "border-gray-200"} rounded p-4 relative`}>
            <div className="absolute -top-3 left-4 bg-white px-2 flex items-center gap-2">
              <span className="bg-[#008d36] text-white font-bold text-xs w-5 h-5 flex items-center justify-center rounded-sm">2</span>
              <span className="text-[11px] font-bold text-[#008d36] uppercase">VEÍCULO</span>
            </div>
            <p className="text-[13px] text-gray-500 mt-2">
              {selectedCar ? `${selectedCar.carCategoryName || selectedCar.carCategoryCode} ✓` : "Selecione um veículo abaixo."}
            </p>
          </div>
          {/* Step 3 */}
          <div className={`flex-1 bg-white border-2 ${currentStep === 3 ? "border-[#008d36]" : "border-gray-200"} rounded p-4 relative`}>
            <div className="absolute -top-3 left-4 bg-white px-2 flex items-center gap-2">
              <span className={`${currentStep === 3 ? "bg-[#008d36] text-white" : "bg-gray-200 text-gray-500"} font-bold text-xs w-5 h-5 flex items-center justify-center rounded-sm`}>3</span>
              <span className={`text-[11px] font-bold ${currentStep === 3 ? "text-[#008d36]" : "text-gray-400"} uppercase`}>PROTEÇÃO, EXTRAS</span>
            </div>
            <p className="text-[13px] text-gray-500 mt-2">{currentStep === 3 ? "Escolha extras opcionais." : "Disponível após selecionar veículo."}</p>
          </div>
          {/* Step 4 */}
          <div className="flex-1 bg-white border border-gray-200 rounded p-4">
            <div className="flex items-center gap-2">
              <span className="bg-gray-200 text-gray-500 font-bold text-xs w-5 h-5 flex items-center justify-center rounded-sm">4</span>
              <span className="text-[11px] font-bold text-gray-400 uppercase">REVISAR</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main */}
      <div className="max-w-7xl mx-auto px-4 py-8 flex gap-8 items-start">
        {/* Filters sidebar */}
        <div className="w-[260px] shrink-0 sticky top-4">
          <div className="bg-white rounded border border-gray-200 p-6">
            <div className="flex justify-between items-center mb-4 border-b border-gray-100 pb-3">
              <h3 className="font-bold text-gray-900">Filtros</h3>
              <button onClick={() => { setTransmission("Ambos"); setVehicleType("Todos"); setMinSeats(2); }} className="text-[#008d36] text-xs font-bold hover:underline">Redefinir</button>
            </div>
            <div className="mb-5">
              <h4 className="font-bold text-sm text-gray-900 mb-2">Transmissão</h4>
              {["Ambos", "Automática", "Manual"].map(t => (
                <label key={t} className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer mb-1.5">
                  <input type="radio" name="trans" checked={transmission === t} onChange={() => setTransmission(t)} className="accent-[#008d36]" /> {t}
                </label>
              ))}
            </div>
            <div className="mb-5 border-t border-gray-100 pt-4">
              <h4 className="font-bold text-sm text-gray-900 mb-2">Tipo de veículo</h4>
              {["Todos", "Carro", "Furgões e caminhões", "Premium"].map(v => (
                <label key={v} className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer mb-1.5">
                  <input type="radio" name="tipo" checked={vehicleType === v} onChange={() => setVehicleType(v)} className="accent-[#008d36]" /> {v}
                </label>
              ))}
            </div>
            <div className="border-t border-gray-100 pt-4">
              <h4 className="font-bold text-sm text-gray-900 mb-2">Assentos mín.</h4>
              <div className="flex justify-between text-xs font-bold text-gray-600 mb-1">{[2, 4, 5, 7].map(n => <span key={n}>{n}+</span>)}</div>
              <input type="range" min="2" max="7" value={minSeats} onChange={e => setMinSeats(Number(e.target.value))} className="w-full accent-[#008d36]" />
            </div>
            {priceRange.max > 0 && (
              <div className="border-t border-gray-100 pt-4 mt-4">
                <h4 className="font-bold text-sm text-gray-900 mb-2">Preços ({filteredCars[0]?.currency || "EUR"})</h4>
                <div className="flex gap-3">
                  <div className="flex-1 text-center border border-gray-200 rounded p-2 text-sm font-bold">{fmtPrice(priceRange.min)}</div>
                  <span className="self-center text-gray-400">—</span>
                  <div className="flex-1 text-center border border-gray-200 rounded p-2 text-sm font-bold">{fmtPrice(priceRange.max)}</div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Content area */}
        <div className="flex-1">
          {currentStep === 2 ? (
            <>
              {/* ✅ Banner de Tarifa Contratada Ativa */}
              {effectiveContractID && (
                <div className="mb-5 flex items-center gap-3 bg-green-50 border border-green-300 rounded-lg px-5 py-3">
                  <svg className="w-5 h-5 text-green-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div className="flex-1">
                    <span className="text-sm font-bold text-green-800">Tarifa contratada aplicada: </span>
                    <span className="text-sm font-mono font-black text-green-900 bg-green-100 px-2 py-0.5 rounded">{effectiveContractID}</span>
                    <span className="text-xs text-green-600 ml-2">— Os preços exibidos já refletem sua tarifa negociada.</span>
                  </div>
                  <a href="/" className="text-xs text-green-600 hover:text-red-500 font-bold underline shrink-0">Remover</a>
                </div>
              )}

              <div className="flex justify-end items-center mb-5">
                <label className="text-sm font-bold text-gray-900 mr-3">Classificar por:</label>
                <select className="border border-gray-300 rounded bg-white px-3 py-2 text-sm font-bold text-gray-700 outline-none w-52" value={sortBy} onChange={e => setSortBy(e.target.value)}>
                  <option>Recomendado</option>
                  <option>Preço: Menor para maior</option>
                  <option>Preço: Maior para menor</option>
                </select>
              </div>

              {/* Loading */}
              {loading && (
                <div className="bg-white rounded-lg border border-gray-200 p-16 text-center">
                  <div className="w-10 h-10 border-4 border-[#008d36] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                  <p className="font-bold text-gray-600">Buscando veículos disponíveis...</p>
                  <p className="text-sm text-gray-400 mt-1">Consultando API Europcar XRS</p>
                </div>
              )}

              {/* Error */}
              {!loading && error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-8 text-center">
                  <div className="text-4xl mb-3">⚠️</div>
                  <p className="font-bold text-red-700 text-lg mb-1">Não foi possível carregar os veículos</p>
                  <p className="text-red-600 text-sm mb-4">{error}</p>
                  <button onClick={fetchCars} className="bg-[#008d36] text-white px-6 py-2 rounded font-bold text-sm hover:bg-[#007530]">Tentar novamente</button>
                </div>
              )}

              {/* Cars */}
              {!loading && !error && (
                <div className="flex flex-col gap-5">
                  {filteredCars.length === 0 && (
                    <div className="bg-white p-8 text-center rounded-lg border border-gray-200 text-gray-500">Nenhum veículo com estes filtros. Tente redefinir.</div>
                  )}
                  {filteredCars.map((car: any, idx: number) => {
                    const code = car.carCategoryCode;
                    const name = car.carCategoryName || code;
                    const sample = car.carCategorySample || "";
                    const currency = car.currency || "EUR";
                    const totalPrice = parseFloat(car.totalRateEstimate || 0);
                    const basePrice = parseFloat(car.basePrice || 0);
                    const isSelected = selectedCar?.carCategoryCode === code && selectedCar?.rateId === car.rateId;

                    return (
                      <div key={`${code}-${idx}`} className={`bg-white rounded-lg border p-5 flex items-center gap-6 transition-shadow ${isSelected ? "border-[#008d36] shadow-lg" : "border-gray-200 hover:shadow-md"}`}>
                        {/* Image */}
                        <div className="w-[240px] shrink-0">
                          <div className="h-[150px] bg-white border border-gray-100 rounded flex items-center justify-center p-3">
                            <CarImage sample={sample} code={code} alt={sample || name} imageUrl={car.imageUrl} />
                          </div>
                          {sample && <p className="text-[10px] text-center text-gray-400 mt-1">{sample} ou similar</p>}
                        </div>

                        {/* Info */}
                        <div className="flex-1">
                          <h2 className="text-lg font-black text-gray-900 uppercase">{name}</h2>
                          <span className="text-[10px] bg-gray-100 text-gray-600 font-bold px-2 py-0.5 rounded-full">{code}</span>

                          <div className="flex items-center gap-4 mt-3 text-sm font-bold text-gray-600 flex-wrap">
                            <span>🧑‍🤝‍🧑 {car.carCategorySeats || "?"}</span>
                            <span>🚪 {car.carCategoryDoors || "?"}</span>
                            {car.carCategoryBaggageQuantity && <span>🧳 {car.carCategoryBaggageQuantity}</span>}
                            <span>⚙️ {car.carCategoryAutomatic === "Y" ? "Auto" : "Manual"}</span>
                            {car.carCategoryAirCond === "Y" && <span>❄️ A/C</span>}
                            {car.fuelTypeCode && <span>⛽ {car.fuelTypeCode}</span>}
                          </div>

                          <div className="flex items-center gap-2 mt-3 text-sm font-bold text-[#008d36]">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>
                            {car.includedKm === "UNLIMITED" ? "Quilometragem ilimitada" : `${car.includedKm} km incluídos`}
                          </div>
                        </div>

                        {/* Price + CTA */}
                        <div className="w-[175px] shrink-0 flex flex-col items-end border-l border-gray-100 pl-5">
                          <span className="text-[10px] uppercase font-bold text-gray-400 mb-1">TOTAL DO PERÍODO</span>
                          <div className="flex items-baseline gap-1 mb-1">
                            <span className="text-2xl font-black text-gray-900">{currency} {fmtPrice(totalPrice)}</span>
                          </div>
                          <span className="text-xs text-gray-400 mb-3">Base: {currency} {fmtPrice(basePrice)}</span>
                          {car.bookingCurrencyOfTotalRateEstimate && car.bookingCurrencyOfTotalRateEstimate !== currency && (
                            <span className="text-xs text-gray-500 mb-2">≈ R$ {fmtPrice(car.totalRateEstimateInBookingCurrency)}</span>
                          )}
                          <button
                            onClick={() => handleSelectCar(car)}
                            className={`w-full font-bold py-3 rounded text-sm transition-colors ${isSelected ? "bg-[#008d36] text-white" : "bg-[#ffcc00] hover:bg-[#e6b800] text-gray-900"}`}
                          >
                            {isSelected ? "Selecionado ✓" : "Selecionar"}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          ) : (
            /* Step 3 */
            <div className="bg-white rounded border border-gray-200 p-8 relative">
              <button onClick={() => setCurrentStep(2)} className="absolute top-6 right-6 text-[#008d36] font-bold hover:underline text-sm">← Voltar</button>
              <h2 className="text-2xl font-black text-gray-900 mb-6">Proteções e extras</h2>

              <div className="border border-green-200 rounded mb-8 bg-green-50 p-4 flex gap-4 items-center">
                <div className="flex-1 border-r border-green-200">
                  <div className="text-[10px] uppercase text-green-700">Veículo</div>
                  <div className="font-bold text-sm">{selectedCar?.carCategoryName || selectedCar?.carCategoryCode}</div>
                  <div className="text-xs text-green-700">{selectedCar?.currency} {fmtPrice(selectedCar?.totalRateEstimate)}</div>
                </div>
                <div className="flex-1">
                  <div className="text-[10px] uppercase text-green-700">Extras</div>
                  <div className="font-bold text-sm">+ R$ {selectedExtrasPricePerDay.toFixed(2).replace(".", ",")} / dia</div>
                </div>
                <button
                  onClick={() => {
                    const payload = { car: selectedCar, extras: selectedExtrasMap, pickupStation, returnStation, pickupDate, returnDate, pickupTime, returnTime, contractID: effectiveContractID, driverCountry, driverCountryName };
                    sessionStorage.setItem("europcar_booking", JSON.stringify(payload));
                    window.location.href = "/checkout";
                  }}
                  className="bg-[#ffcc00] hover:bg-[#e6b800] text-gray-900 font-bold py-3 px-6 rounded shrink-0 text-sm uppercase"
                >
                  Ir para revisão →
                </button>
              </div>

              {/* Proteções da API Europcar XRS */}
              {selectedCar?.optionalInsurances?.length > 0 ? (
                <>
                  <h3 className="font-bold text-lg text-gray-900 mb-4">Proteções disponíveis</h3>
                  <div className="grid grid-cols-2 gap-4 mb-8">
                    {selectedCar.optionalInsurances.map((ins: any) => {
                      const insId = ins.code;
                      const sel = selectedExtrasMap[insId] > 0;
                      const priceEUR = parseFloat(ins.price || "0");
                      const priceBRL = parseFloat(ins.priceInBookingCurrency || "0");
                      const totalWithInsBRL = parseFloat(ins.rentalPriceInBookingCurrencyAI || "0");
                      // Insurance code descriptions
                      const insNames: Record<string, string> = {
                        // Liability
                        TPL:    "Seguro de Responsabilidade Civil",
                        // Damage waivers
                        LDW:    "Proteção contra Danos e Roubo (LDW)",
                        CDW:    "Proteção contra Danos por Colisão (CDW)",
                        THW:    "Proteção contra Roubo (THW)",
                        SCDW:   "Super Proteção CDW",
                        SPCDW:  "Super Proteção CDW Premium",
                        STHW:   "Super Proteção THW",
                        SPTHW:  "Super Proteção THW Premium",
                        // Packages
                        MEDIUM:  "Cobertura Média",
                        PREMIUM: "Cobertura Premium",
                        PREMPRE: "Premium Pré-pago",
                        PREMUP:  "Upgrade Premium",
                        // Add-ons
                        RSA:  "Assistência na Estrada (RSA)",
                        APP:  "Proteção de Aparência",
                        PAI:  "Proteção de Acidentes Pessoais (PAI)",
                        PEP:  "Proteção de Efeitos Pessoais (PEP)",
                      };
                      const insDesc: Record<string, string> = {
                        // Liability
                        TPL: "Seguro obrigatório de Responsabilidade Civil perante terceiros. Cobre danos materiais e corporais causados a terceiros em acidentes pelos quais você seja responsável. Não cobre danos ao veículo alugado.",
                        // Damage waivers
                        LDW: `Combinação de CDW + THW: limita sua responsabilidade financeira em caso de colisão, danos ao veículo ou roubo/furto. Franquia aplicável: EUR ${ins.excessWithPOM || "—"}.`,
                        CDW: `Proteção contra Danos por Colisão: reduz sua responsabilidade em caso de danos acidentais ao veículo. Franquia: EUR ${ins.excessWithPOM || "—"}.`,
                        THW: `Proteção contra Roubo: reduz sua responsabilidade em caso de furto ou roubo do veículo. Franquia: EUR ${ins.excessWithPOM || "—"}.`,
                        SCDW: "Super CDW: reduz a franquia de colisão e danos a zero. Você não paga nenhum valor adicional em caso de danos ao veículo.",
                        SPCDW: "Super CDW Premium: franquia zero para danos ao veículo, incluindo danos a pneus, vidros e para-choques. Cobertura máxima contra colisões.",
                        STHW: "Super THW: reduz a franquia de roubo a zero. Você não paga nenhum valor adicional em caso de furto ou roubo do veículo.",
                        SPTHW: "Super THW Premium: franquia zero para roubo e furto, com cobertura estendida a acessórios e itens internos do veículo.",
                        // Packages
                        MEDIUM: `Cobertura Média: inclui proteção CDW e THW com franquia reduzida, além de cobertura para pneus, vidros e para-brisas. Franquia aplicável: EUR ${ins.excessWithPOM || "—"}.`,
                        PREMIUM: "Cobertura Premium: proteção completa sem franquia — cobre colisão, roubo, vidros, pneus, para-choques e danos de aparência. Tranquilidade total durante seu aluguel.",
                        PREMPRE: "Cobertura Premium Pré-paga: todos os benefícios da cobertura premium com desconto ao pagar antecipadamente. Sem franquia. Inclui CDW, THW, vidros, pneus e assistência na estrada.",
                        PREMUP: "Upgrade para Cobertura Premium: eleva seu plano atual para a proteção máxima disponível, reduzindo ou zerando a franquia vigente e ampliando as coberturas incluídas.",
                        // Add-ons
                        RSA: "Assistência na Estrada 24h: suporte imediato em caso de pane, acidente, furo de pneu, falta de combustível ou chaves trancadas no veículo, a qualquer hora e em qualquer lugar.",
                        APP: "Proteção de Aparência: cobre danos estéticos ao veículo que normalmente não são incluídos no CDW padrão, como arranhões, amassados leves, danos às rodas e para-choques.",
                        PAI: "Proteção de Acidentes Pessoais: cobre despesas médicas, indenização por morte e invalidez permanente para o condutor e passageiros em caso de acidente durante o aluguel.",
                        PEP: "Proteção de Efeitos Pessoais: cobre bagagens e pertences pessoais deixados no veículo em caso de roubo ou furto, até o limite especificado em contrato.",
                      };
                      return (
                        <div key={insId} className={`border-2 rounded-lg p-5 transition-colors ${sel ? "border-[#008d36] bg-green-50" : "border-gray-200 hover:border-[#008d36]"}`}>
                          <div className="flex justify-between items-start mb-2">
                            <h4 className="font-black text-gray-900">{insNames[insId] || insId}</h4>
                            {ins.excessWithPOM && parseFloat(ins.excessWithPOM) === 0 && (
                              <span className="text-[10px] bg-green-100 text-green-700 font-bold px-2 py-0.5 rounded-full">SEM FRANQUIA</span>
                            )}
                          </div>
                          <div className="text-xl font-black text-gray-900 mb-1">
                            EUR {priceEUR.toFixed(2)}
                            {priceBRL > 0 && <span className="text-sm font-normal text-gray-400 ml-1">(R$ {priceBRL.toFixed(2)})</span>}
                            <span className="text-xs text-gray-400 font-normal"> /dia</span>
                          </div>
                          {totalWithInsBRL > 0 && (
                            <div className="text-xs text-green-700 font-bold mb-1">Total com proteção: R$ {totalWithInsBRL.toFixed(2)}</div>
                          )}
                          <p className="text-sm text-gray-500 mb-4">{insDesc[insId] || "Proteção adicional."}</p>
                          <button
                            onClick={() => sel ? handleExtraQuantity(insId, -1) : handleExtraQuantity(insId, 1)}
                            className={`w-full font-bold py-2 rounded text-sm transition-colors ${sel ? "bg-gray-100 text-gray-500" : "bg-[#ffcc00] hover:bg-[#e6b800] text-gray-900"}`}
                          >
                            {sel ? "Remover ✓" : "Adicionar"}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </>
              ) : (
                <p className="text-gray-400 text-sm py-4">Nenhuma proteção disponível para este veículo.</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ---- Export with Suspense (required for useSearchParams in Next.js 14) ----
export default function VehiclesSelectionPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#f7f7f7] flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-[#008d36] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="font-bold text-gray-600">Carregando...</p>
        </div>
      </div>
    }>
      <VehiclesContent />
    </Suspense>
  );
}
