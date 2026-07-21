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
function CarImage({ sample, code, alt, imageUrl, overrideUrl }: { sample: string; code: string; alt: string; imageUrl?: string, overrideUrl?: string }) {
  const sources = [
    // 0. Custom override from admin panel
    overrideUrl || null,
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
  const [carImageOverrides, setCarImageOverrides] = useState<Record<string, string>>({});

  // URL params
  const pickupStation = searchParams.get("pickup") || "";
  const returnStation = searchParams.get("return") || pickupStation;
  const pickupDate = searchParams.get("date") || "";
  const pickupTime = (searchParams.get("time") || "1000").replace(":", "");
  const returnTime = (searchParams.get("returnTime") || "1000").replace(":", "");
  const contractID = searchParams.get("contractID") || "";
  const driverCountry = searchParams.get("country") || "BR";
  const driverCountryName = searchParams.get("countryName") || "Brasil";
  const stationCountry = searchParams.get("stationCountry") || "";

  useEffect(() => {
    fetch('/api/cars/images')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          const map = data.reduce((acc: any, item: any) => ({ ...acc, [item.carCode]: item.imageUrl }), {});
          setCarImageOverrides(map);
        }
      })
      .catch(console.error);
  }, []);

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
  const isOneWay = returnStation !== pickupStation;
  const [stationName, setStationName] = useState(pickupStation);
  const [returnStationName, setReturnStationName] = useState(returnStation);
  useEffect(() => {
    if (!pickupStation) return;
    fetch(`/api/europcar/getStations?q=${pickupStation}`)
      .then(r => r.json())
      .then(d => {
        const s = d.stations?.find((x: any) => x.code === pickupStation);
        if (s) setStationName(s.name);
      }).catch(() => { });
  }, [pickupStation]);

  // Resolve return station name (One-Way)
  useEffect(() => {
    if (!isOneWay || !returnStation) return;
    fetch(`/api/europcar/getStations?q=${returnStation}`)
      .then(r => r.json())
      .then(d => {
        const s = d.stations?.find((x: any) => x.code === returnStation);
        if (s) setReturnStationName(s.name);
      }).catch(() => { });
  }, [returnStation, isOneWay]);

  // XRS cars state
  const [cars, setCars] = useState<any[]>([]);
  const [etoCars, setEtoCars] = useState<any[]>([]);      // ETO Com Excesso rates
  const [etoZeroCars, setEtoZeroCars] = useState<any[]>([]); // ETO Zero Excesso rates
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // ETO margin from admin panel
  const [etoMargin, setEtoMargin] = useState(0);

  // Selected tariff type per car
  const [selectedTariffType, setSelectedTariffType] = useState<'POA' | 'ETO'>('POA');

  // Zero Excess upgrade (upsell on Step 3)
  const [zeroExcessUpgrade, setZeroExcessUpgrade] = useState(false);

  // Extras
  const [dbExtras, setDbExtras] = useState<any[]>([]);
  const [selectedExtrasMap, setSelectedExtrasMap] = useState<Record<string, number>>({});
  const [loadingExtras, setLoadingExtras] = useState(false);

  // XRS Equipment (accessories from API)
  const [xrsEquipment, setXrsEquipment] = useState<any[]>([]);
  const [selectedEquipmentMap, setSelectedEquipmentMap] = useState<Record<string, number>>({});
  const [loadingEquipment, setLoadingEquipment] = useState(false);
  // Equipment prices fetched from getQuote: { code: { price, priceBRL, currency } }
  const [equipmentPrices, setEquipmentPrices] = useState<Record<string, { price: number; priceBRL: number; currency: string }>>({});

  // ETO protection skip state
  const [protectionsSkipped, setProtectionsSkipped] = useState(false);

  // Filters
  const [transmission, setTransmission] = useState("Ambos");
  const [vehicleType, setVehicleType] = useState("Todos");
  const [minSeats, setMinSeats] = useState(2);
  const [sortBy, setSortBy] = useState("Recomendado");

  const formatDate = (d: string) => d ? `${d.slice(6, 8)}/${d.slice(4, 6)}/${d.slice(0, 4)}` : "";

  // ---- Fetch vehicles from XRS (POA + ETO in parallel) ----
  const fetchCars = useCallback(async () => {
    if (!pickupStation || !pickupDate) {
      setError("Dados de pesquisa incompletos. Volte e tente novamente.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      // Step 1: getCarCategories → get ACRISS codes (use POA CID)
      const poaCID = '57269673';
      const etoCID = '56935466'; // ETO Líquido (Com Excesso) — desconto maior

      const catRes = await fetch("/api/europcar/getCarCategories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          pickupStation, 
          returnStation: returnStation || pickupStation, 
          pickupDate, 
          returnDate, 
          pickupTime, 
          returnTime,
          contractID: effectiveContractID || poaCID
        }),
      });
      const catData = await catRes.json();

      // Check for One-Way restriction error
      const serviceResponse = catData?.message?.serviceResponse || catData?.serviceResponse;
      const errorCode = serviceResponse?.$.errorCode || serviceResponse?.errorCode || '';
      if (errorCode === 'rental.onewaynotallowed') {
        setError('Não é possível devolver neste local. A Europcar não permite devolução entre as estações selecionadas. Tente selecionar outras estações.');
        setLoading(false);
        return;
      }

      const rawCatList =
        catData?.message?.serviceResponse?.carCategoryList?.carCategory ||
        catData?.serviceResponse?.carCategoryList?.carCategory || [];
      const catList: any[] = Array.isArray(rawCatList) ? rawCatList : rawCatList ? [rawCatList] : [];

      const acrissCodes = catList
        .map((c: any) => (c.$ ? c.$.carCategoryCode : c.carCategoryCode))
        .filter(Boolean);

      const catDetailsMap = catList.reduce((acc: any, c: any) => {
        const attrs = c.$ || c;
        if (attrs.carCategoryCode) {
          acc[attrs.carCategoryCode] = attrs;
        }
        return acc;
      }, {});

      if (acrissCodes.length === 0) {
        const returnCode = serviceResponse?.$?.returnCode || serviceResponse?.returnCode || '';
        if (returnCode === 'KO') {
          setError('Não foi possível buscar veículos para este trajeto. Verifique as estações selecionadas e tente novamente.');
        } else {
          setError('Nenhum veículo disponível para esta estação e período.');
        }
        setLoading(false);
        return;
      }

      // Step 2: getMultipleRates — POA + ETO em paralelo
      const ratesBody = (cid: string) => ({
        pickupStation,
        returnStation: returnStation || pickupStation,
        pickupDate,
        returnDate,
        pickupTime,
        returnTime,
        acrissCodes,
        contractID: cid,
      });

      // Skip ETO fetches for Brazilian stations (Brazil = POA only)
      const isBrazilStation = stationCountry === 'BR' || pickupStation.startsWith('BR');

      const [poaRatesRes, etoRatesRes, etoZeroRatesRes] = await Promise.all([
        fetch("/api/europcar/getMultipleRates", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(ratesBody(effectiveContractID || poaCID)),
        }),
        isBrazilStation ? Promise.resolve(null) : fetch("/api/europcar/getMultipleRates", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(ratesBody(etoCID)),
        }).catch(() => null),
        isBrazilStation ? Promise.resolve(null) : fetch("/api/europcar/getMultipleRates", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(ratesBody('56935495')),
        }).catch(() => null),
      ]);

      const parseRates = (ratesData: any, specsMap: any) => {
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
            const linksRaw = r.links?.link || [];
            const linksArr: any[] = Array.isArray(linksRaw) ? linksRaw : [linksRaw];
            const carvisual = linksArr.find((l: any) => (l.$ || l).id === "carvisual");
            const imageUrl: string = (carvisual?.$ || carvisual)?.value || "";
            const rawIns = r.insuranceList?.insurance || [];
            const insArr: any[] = Array.isArray(rawIns) ? rawIns : [rawIns];
            const optionalInsurances = insArr
              .map((ins: any) => ins.$ || ins)
              .filter((ins: any) => ins.type === "O" && parseFloat(ins.price || "0") > 0);

            // Extract basic protections (included)
            const includedInsurances = insArr
              .map((ins: any) => ins.$ || ins)
              .filter((ins: any) => ins.type === "M" || ins.type === "I");

            // Extract mileage limits
            let mileageType = "Controlado";
            let mileageLimit = "";
            let mileageUnit = "km";
            const distance = r.distance?.$ || r.distance;
            if (distance) {
              if (distance.unlimitedDistance === "Y") {
                mileageType = "Livre";
              } else if (distance.distanceValue) {
                mileageLimit = distance.distanceValue;
                mileageUnit = distance.unit === "M" ? "milhas" : "km";
              }
            }

            const specs = specsMap[attrs.carCategoryCode] || {};
            allRates.push({ 
              ...attrs, 
              imageUrl, 
              optionalInsurances, 
              includedInsurances,
              mileageType,
              mileageLimit,
              mileageUnit,
              specs 
            });
          }
        }
        return allRates;
      };

      const poaRatesData = await poaRatesRes.json();
      const poaRates = parseRates(poaRatesData, catDetailsMap);

      // Parse ETO rates (may fail for some stations)
      let etoRates: any[] = [];
      if (etoRatesRes) {
        try {
          const etoRatesData = await etoRatesRes.json();
          etoRates = parseRates(etoRatesData, catDetailsMap);
        } catch { /* ETO unavailable for this station */ }
      }

      // Parse ETO Zero Excess rates
      let etoZeroRates: any[] = [];
      if (etoZeroRatesRes) {
        try {
          const etoZeroRatesData = await etoZeroRatesRes.json();
          etoZeroRates = parseRates(etoZeroRatesData, catDetailsMap);
        } catch { /* ETO Zero unavailable */ }
      }

      if (poaRates.length === 0) {
        setError("Sem tarifas disponíveis para o período selecionado. Tente outras datas.");
        setLoading(false);
        return;
      }

      setCars(poaRates);
      setEtoCars(etoRates);
      setEtoZeroCars(etoZeroRates);
    } catch (e: any) {
      setError("Erro ao buscar veículos: " + (e.message || "Tente novamente."));
    } finally {
      setLoading(false);
    }
  }, [pickupStation, returnStation, pickupDate, returnDate, pickupTime, returnTime, effectiveContractID]);

  useEffect(() => { fetchCars(); }, [fetchCars]);

  // Load ETO margin from admin panel
  useEffect(() => {
    fetch('/api/admin/margin')
      .then(r => r.json())
      .then(d => setEtoMargin(d.percent || 0))
      .catch(() => {});
  }, []);

  // Load extras when advancing to step 3
  useEffect(() => {
    if (currentStep === 3 && dbExtras.length === 0) {
      setLoadingExtras(true);
      fetch("/api/admin/extras")
        .then(r => r.json())
        .then(d => setDbExtras(d.filter((e: any) => e.active)))
        .finally(() => setLoadingExtras(false));
    }
    // Load standard equipment list
    if (currentStep === 3 && xrsEquipment.length === 0) {
      setXrsEquipment([
        { code: 'CSB', name: 'Cadeira de bebê (0-12 meses)', icon: '👶', description: 'Cadeira infantil para bebês de até 12 meses (grupo 0).', maxQty: 2, onRequest: false },
        { code: 'CST', name: 'Cadeira de criança (1-3 anos)', icon: '🧒', description: 'Cadeira infantil para crianças de 1 a 3 anos (grupo 1).', maxQty: 2, onRequest: false },
        { code: 'BST', name: 'Assento elevatório (4-12 anos)', icon: '💺', description: 'Assento elevatório (booster) para crianças de 4 a 12 anos.', maxQty: 2, onRequest: false },
        { code: 'NVS', name: 'GPS / Navegador', icon: '🗺️', description: 'Navegador GPS portátil com mapas atualizados.', maxQty: 1, onRequest: false },
        { code: 'SKR', name: 'Rack de esqui', icon: '🎿', description: 'Suporte para transporte de esquis no teto do veículo.', maxQty: 1, onRequest: true },
        { code: 'CHN', name: 'Correntes para neve', icon: '⛓️', description: 'Correntes para pneus — obrigatórias em certas regiões com neve.', maxQty: 1, onRequest: true },
        { code: 'WFI', name: 'Wi-Fi portátil', icon: '📶', description: 'Hotspot Wi-Fi portátil com dados móveis inclusos.', maxQty: 1, onRequest: true },
      ]);
    }
  }, [currentStep, dbExtras.length, xrsEquipment.length]);

  // Fetch equipment prices from getQuote when entering Step 3
  useEffect(() => {
    if (currentStep !== 3 || !selectedCar || Object.keys(equipmentPrices).length > 0) return;
    const carCategory = selectedCar.carCategoryCode;
    if (!carCategory || !pickupStation || !pickupDate || !returnDate) return;

    setLoadingEquipment(true);
    const allEqCodes = ['CSB', 'CST', 'BST', 'NVS', 'SKR', 'CHN', 'WFI'];
    const equipmentList = allEqCodes.map(code => ({ code, qty: 1 }));

    const cidForQuote = selectedTariffType === 'ETO'
      ? (selectedCar._etoCID || '56935466')
      : (effectiveContractID || '57269673');

    fetch('/api/europcar/getQuote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        carCategory,
        pickupStation,
        returnStation: returnStation || pickupStation,
        pickupDate,
        returnDate,
        pickupTime,
        returnTime,
        contractID: cidForQuote,
        equipmentList,
      }),
    })
      .then(r => r.json())
      .then(data => {
        const reservation = data?.message?.serviceResponse?.reservation;
        const quote = reservation?.quote;
        // equipmentList is under reservation, NOT under quote
        const eqList = reservation?.equipmentList?.equipment;
        if (!eqList) return;
        const items = Array.isArray(eqList) ? eqList : [eqList];
        const prices: Record<string, { price: number; priceBRL: number; currency: string }> = {};
        for (const item of items) {
          const a = item.$ || item;
          const code = a.code || '';
          if (code) {
            prices[code] = {
              price: parseFloat(a.price || '0'),
              priceBRL: parseFloat(a.priceInBookingCurrency || '0'),
              currency: quote?.$?.currency || 'EUR',
            };
          }
        }
        setEquipmentPrices(prices);
      })
      .catch(err => console.warn('[Step3] Equipment price fetch failed:', err))
      .finally(() => setLoadingEquipment(false));
  }, [currentStep, selectedCar, equipmentPrices, pickupStation, returnStation, pickupDate, returnDate, pickupTime, returnTime, selectedTariffType, effectiveContractID]);

  const handleEquipmentQuantity = (code: string, delta: number, maxQty: number = 4) => {
    setSelectedEquipmentMap(prev => {
      const current = prev[code] || 0;
      const totalOtherItems = Object.entries(prev).filter(([k]) => k !== code).reduce((sum, [, v]) => sum + v, 0);
      const next = Math.max(0, Math.min(current + delta, maxQty, 4 - totalOtherItems + current));
      if (next === 0) { const { [code]: _, ...rest } = prev; return rest; }
      return { ...prev, [code]: next };
    });
  };

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
    setSelectedCar({
      ...car,
      imageUrl: carImageOverrides[car.carCategoryCode] || car.imageUrl
    });
    setZeroExcessUpgrade(false); // reset upgrade when changing car
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
            <img src="/logo.jpg" alt="Europcar" className="h-12 object-contain" />
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
                <div className={`font-bold truncate max-w-[130px] ${isOneWay ? 'text-[#e67e00]' : ''}`}>{isOneWay ? (returnStationName || returnStation) : (stationName || pickupStation)}</div>
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
        {/* Filters sidebar - only on step 2 */}
        {currentStep === 2 && (
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
        )}

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
                    const totalPricePOA = parseFloat(car.totalRateEstimate || 0);
                    const totalBRL_POA = parseFloat(car.totalRateEstimateInBookingCurrency || 0);
                    const basePrice = parseFloat(car.basePrice || 0);
                    const isSelected = selectedCar?.carCategoryCode === code && selectedCar?.rateId === car.rateId;

                    // Find matching ETO rate for this car
                    const etoCar = etoCars.find(e => e.carCategoryCode === code);
                    const totalPriceETO_raw = etoCar ? parseFloat(etoCar.totalRateEstimate || 0) : 0;
                    const totalBRL_ETO_raw = etoCar ? parseFloat(etoCar.totalRateEstimateInBookingCurrency || 0) : 0;
                    // Apply admin margin to ETO
                    const totalPriceETO = totalPriceETO_raw * (1 + etoMargin / 100);
                    const totalBRL_ETO = totalBRL_ETO_raw * (1 + etoMargin / 100);
                    const hasETO = etoCar && totalPriceETO_raw > 0;
                    // Calculate discount % ETO vs POA
                    const discountPct = hasETO && totalPricePOA > 0 ? Math.round((1 - totalPriceETO / totalPricePOA) * 100) : 0;

                    return (
                      <div key={`${code}-${idx}`} className={`bg-white rounded-lg border p-5 flex items-center gap-6 transition-shadow ${isSelected ? "border-[#008d36] shadow-lg" : "border-gray-200 hover:shadow-md"}`}>
                        {/* Image */}
                        <div className="w-[240px] shrink-0 relative flex flex-col items-center">
                          {/* 2.1 Tags */}
                          {(code.startsWith('U') || code.startsWith('L') || car.specs?.carCategoryType?.toLowerCase().includes('premium')) ? (
                            <div className="group relative z-10 -mb-2">
                              <div className="bg-gradient-to-r from-[#d4af37] to-[#aa8323] text-white text-[10px] font-black uppercase px-3 py-1 rounded-full shadow cursor-help flex items-center gap-1">
                                Premium Brand Guaranteed
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" /></svg>
                              </div>
                              <div className="absolute hidden group-hover:block bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 bg-[#c8b46e] text-white border border-[#b89b4e] text-[10px] p-3 rounded shadow-lg z-20 font-bold leading-relaxed">
                                You'll get this model or another similar from a Premium brand: BMW, Audi, Mercedes, Tesla, Jaguar, Land Rover, Lexus, Porsche, Volvo or Alfa Romeo.
                                {/* Dropdown triangle */}
                                <div className="absolute top-full left-1/2 -translate-x-1/2 border-8 border-transparent border-t-[#c8b46e]"></div>
                              </div>
                            </div>
                          ) : (
                            <div className="group relative z-10 -mb-2">
                              <div className="bg-white border border-gray-300 text-gray-700 text-[10px] font-black uppercase px-3 py-1 rounded-full shadow-sm cursor-help flex items-center gap-1">
                                OU SIMILAR {car.specs?.carCategoryName ? car.specs.carCategoryName.split(',')[0].split(' ')[0] : 'MINI'}
                                <svg className="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                              </div>
                              <div className="absolute hidden group-hover:block bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 bg-white text-gray-700 border border-gray-200 text-[10px] p-2 rounded shadow-lg z-20 text-center">
                                Receberá este modelo ou um veículo semelhante, com o mesmo nível de características e conforto.
                                <div className="absolute top-full left-1/2 -translate-x-1/2 border-8 border-transparent border-t-white drop-shadow"></div>
                              </div>
                            </div>
                          )}

                          <div className="h-[150px] w-full bg-white flex items-center justify-center p-3 mt-1">
                            <CarImage sample={sample} code={code} alt={sample || name} imageUrl={car.imageUrl} overrideUrl={carImageOverrides[code]} />
                          </div>
                        </div>

                        {/* Info */}
                        <div className="flex-1">
                          <h2 className="text-lg font-black text-gray-900 uppercase">{name}</h2>
                          <span className="text-[10px] bg-gray-100 text-gray-600 font-bold px-2 py-0.5 rounded-full">{code}</span>

                          {/* 2.2 Vehicle Specs */}
                          <div className="flex items-center gap-3 mt-3 text-sm font-bold text-gray-600 flex-wrap">
                            <span title="Passageiros">👥 {car.specs?.carCategorySeats || car.carCategorySeats || "?"}</span>
                            {car.specs?.carCategoryBaggageQuantity && <span title="Malas">🧳 {car.specs.carCategoryBaggageQuantity}</span>}
                            <span title="Portas">🚪 {car.specs?.carCategoryDoors || car.carCategoryDoors || "?"}</span>
                            <span title="Transmissão">⚙️ {car.specs?.carCategoryAutomatic === "Y" || car.carCategoryAutomatic === "Y" ? "A" : "M"}</span>
                            {(car.specs?.carCategoryAirCond === "Y" || car.carCategoryAirCond === "Y") && <span title="Ar-condicionado">❄️ A/C</span>}
                            {car.specs?.carCategoryCO2Quantity && <span title="CO2 g/km">💨 {car.specs.carCategoryCO2Quantity}</span>}
                            {car.fuelTypeCode && <span title="Combustível">⛽ {car.fuelTypeCode}</span>}
                          </div>

                          {/* 2.3 Reservation Conditions */}
                          <div className="flex flex-col gap-1 mt-3">
                            {car.mileageType === "Livre" ? (
                              <div className="flex items-center gap-2 text-[11px] font-bold text-[#008d36]">
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>
                                Quilometragem Ilimitada incluída
                              </div>
                            ) : (
                              <div className="flex items-center gap-2 text-[11px] font-bold text-[#008d36]">
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>
                                {car.mileageLimit || "3600"} {car.mileageUnit} incluído
                              </div>
                            )}
                            
                            {(car.includedInsurances?.length > 0 || true) && (
                              <div className="flex items-center gap-2 text-[11px] font-bold text-[#008d36]">
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>
                                Proteção básica incluída
                              </div>
                            )}
                          </div>
                          
                          {/* 2.4 Detalhes do Veículo Dropdown */}
                          <details className="mt-4 group">
                            <summary className="list-none flex items-center gap-1 cursor-pointer text-[#008d36] text-[11px] font-black hover:underline">
                              Detalhes do veículo 
                              <svg className="w-4 h-4 transition-transform group-open:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 9l-7 7-7-7" /></svg>
                            </summary>
                            <div className="mt-2 p-3 bg-gray-50 border border-gray-100 rounded text-xs text-gray-600 grid grid-cols-2 gap-x-4 gap-y-2">
                              {car.specs?.carCategoryModelLength && <div><span className="font-bold">Comprimento:</span> {car.specs.carCategoryModelLength}m</div>}
                              {car.specs?.carCategoryModelWidth && <div><span className="font-bold">Largura:</span> {car.specs.carCategoryModelWidth}m</div>}
                              {car.specs?.carCategoryModelHeight && <div><span className="font-bold">Altura:</span> {car.specs.carCategoryModelHeight}m</div>}
                              {car.specs?.carCategoryPowerHP && <div><span className="font-bold">Potência:</span> {car.specs.carCategoryPowerHP} HP ({car.specs.carCategoryPowerKW} KW)</div>}
                              {car.specs?.carCategoryModelWeight && <div><span className="font-bold">Peso:</span> {car.specs.carCategoryModelWeight} kg</div>}
                              {car.specs?.carCategoryType && <div><span className="font-bold">Tipo:</span> {car.specs.carCategoryType}</div>}
                              {sample && <div className="col-span-2 text-[10px] text-gray-400 mt-1">Exemplo: {sample}</div>}
                            </div>
                          </details>
                        </div>

                        {/* Price + CTA — POA vs ETO */}
                        <div className="w-[220px] shrink-0 flex flex-col items-stretch border-l border-gray-100 pl-5 gap-2">
                          {/* POA Tariff */}
                          <div className="border border-gray-200 rounded-lg p-3 hover:border-[#008d36] transition-colors">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-[9px] uppercase font-black text-gray-500 tracking-wider">Pagar na Retirada</span>
                            </div>
                            <div className="text-lg font-black text-gray-900">
                              {totalBRL_POA > 0 ? `BRL ${fmtPrice(totalBRL_POA)}` : `${currency} ${fmtPrice(totalPricePOA)}`}
                            </div>
                            {totalBRL_POA > 0 && <span className="text-[10px] text-gray-400">Base: {currency} {fmtPrice(totalPricePOA)}</span>}
                            <button
                              onClick={() => { setSelectedTariffType('POA'); handleSelectCar(car); }}
                              className={`w-full mt-2 font-bold py-2 rounded text-xs transition-colors ${
                                isSelected && selectedTariffType === 'POA' ? "bg-[#008d36] text-white" : "bg-[#ffcc00] hover:bg-[#e6b800] text-gray-900"
                              }`}
                            >
                              {isSelected && selectedTariffType === 'POA' ? "Retirada ✓" : "Pagar na Retirada"}
                            </button>
                          </div>

                          {/* ETO Tariff — hidden for Brazilian stations */}
                          {hasETO && stationCountry !== 'BR' && (
                            <div className="border-2 border-[#e67e00] rounded-lg p-3 bg-orange-50/50 relative">
                              {discountPct > 0 && (
                                <span className="absolute -top-2.5 right-2 text-[9px] bg-[#e67e00] text-white px-2 py-0.5 rounded-full font-black">-{discountPct}%</span>
                              )}
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-[9px] uppercase font-black text-[#e67e00] tracking-wider">Pague On-line</span>
                                <span className="text-[9px] bg-[#e67e00]/10 text-[#e67e00] px-1.5 py-0.5 rounded font-bold">Sem IOF</span>
                              </div>
                              <div className="text-lg font-black text-gray-900">
                                {totalBRL_ETO > 0 ? `BRL ${fmtPrice(totalBRL_ETO)}` : `${currency} ${fmtPrice(totalPriceETO)}`}
                              </div>
                              {totalBRL_ETO > 0 && <span className="text-[10px] text-gray-400">Base: {currency} {fmtPrice(totalPriceETO)}</span>}
                              <button
                                onClick={() => { 
                                  setSelectedTariffType('ETO'); 
                                  handleSelectCar({ 
                                    ...car, 
                                    ...etoCar, 
                                    totalRateEstimate: totalPriceETO.toFixed(2),
                                    totalRateEstimateInBookingCurrency: totalBRL_ETO.toFixed(2),
                                    optionalInsurances: car.optionalInsurances, 
                                    _etoCID: '56935466' 
                                  }); 
                                }}
                                className={`w-full mt-2 font-bold py-2 rounded text-xs transition-colors ${
                                  isSelected && selectedTariffType === 'ETO' ? "bg-[#e67e00] text-white" : "bg-[#e67e00] hover:bg-[#cc6f00] text-white"
                                }`}
                              >
                                {isSelected && selectedTariffType === 'ETO' ? "Pago ✓" : "Pagar Agora"}
                              </button>
                            </div>
                          )}
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
                {zeroExcessUpgrade && (
                  <div className="flex-1 border-r border-green-200">
                    <div className="text-[10px] uppercase text-green-700">Proteção</div>
                    <div className="font-bold text-sm text-[#008d36]">🛡️ Franquia Zero</div>
                    <div className="text-xs text-green-700">Incluída no total</div>
                  </div>
                )}
                <div className="flex-1">
                  <div className="text-[10px] uppercase text-green-700">Extras</div>
                  <div className="font-bold text-sm">+ R$ {selectedExtrasPricePerDay.toFixed(2).replace(".", ",")} / dia</div>
                </div>
                <button
                  onClick={() => {
                    const selectedInsuranceCodes = Object.keys(selectedExtrasMap).filter(k => selectedExtrasMap[k] > 0);
                    const xrsEquipmentPayload = Object.entries(selectedEquipmentMap).filter(([, qty]) => qty > 0).map(([code, qty]) => {
                      const ep = equipmentPrices[code];
                      const meta = xrsEquipment.find((e: any) => e.code === code);
                      return { code, qty, name: meta?.name || code, icon: meta?.icon || '📦', price: ep?.price || 0, priceBRL: ep?.priceBRL || 0, currency: ep?.currency || 'EUR' };
                    });
                    const xrsInsurancesPayload = selectedInsuranceCodes.map(code => ({ code }));
                    const cidForTariff = selectedTariffType === 'ETO'
                      ? (zeroExcessUpgrade ? '56935495' : (selectedCar?._etoCID || '56935466'))
                      : (effectiveContractID || '57269673');
                    const payload = { car: selectedCar, extras: selectedExtrasMap, xrsEquipment: xrsEquipmentPayload, xrsInsurances: xrsInsurancesPayload, pickupStation, returnStation, pickupDate, returnDate, pickupTime, returnTime, contractID: cidForTariff, tariffType: selectedTariffType, zeroExcess: zeroExcessUpgrade, driverCountry, driverCountryName, stationCountry };
                    sessionStorage.setItem("europcar_booking", JSON.stringify(payload));
                    window.location.href = "/checkout";
                  }}
                  className="bg-[#ffcc00] hover:bg-[#e6b800] text-gray-900 font-bold py-3 px-6 rounded shrink-0 text-sm uppercase"
                >
                  Ir para revisão →
                </button>
              </div>

              {/* Congrats message — show when ETO skipped OR premium protection added */}
              {(selectedTariffType === 'ETO' && protectionsSkipped) || zeroExcessUpgrade ? (
                <div className="border-2 border-[#008d36] rounded-xl p-10 text-center bg-green-50 mb-8">
                  <div className="w-20 h-20 bg-green-100 text-[#008d36] rounded-full flex items-center justify-center mx-auto mb-6">
                    <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>
                  </div>
                  <h3 className="text-2xl font-black text-gray-900 mb-2">🎉 Parabéns, você tomou a decisão correta!</h3>
                  <p className="text-gray-600 mb-6">Clique abaixo para ir para revisão e finalizar o seu pagamento.</p>
                  <button
                    onClick={() => {
                      const selectedInsuranceCodes2 = Object.keys(selectedExtrasMap).filter(k => selectedExtrasMap[k] > 0);
                      const xrsEquipmentPayload2 = Object.entries(selectedEquipmentMap).filter(([, qty]) => qty > 0).map(([code, qty]) => {
                        const ep2 = equipmentPrices[code];
                        const meta2 = xrsEquipment.find((e: any) => e.code === code);
                        return { code, qty, name: meta2?.name || code, icon: meta2?.icon || '📦', price: ep2?.price || 0, priceBRL: ep2?.priceBRL || 0, currency: ep2?.currency || 'EUR' };
                      });
                      const xrsInsurancesPayload2 = selectedInsuranceCodes2.map(code => ({ code }));
                      const cidForTariff = selectedTariffType === 'ETO'
                        ? (zeroExcessUpgrade ? '56935495' : (selectedCar?._etoCID || '56935466'))
                        : (zeroExcessUpgrade ? '56935495' : (effectiveContractID || '57269673'));
                      const payload = { car: selectedCar, extras: selectedExtrasMap, xrsEquipment: xrsEquipmentPayload2, xrsInsurances: xrsInsurancesPayload2, pickupStation, returnStation, pickupDate, returnDate, pickupTime, returnTime, contractID: cidForTariff, tariffType: selectedTariffType, zeroExcess: zeroExcessUpgrade, driverCountry, driverCountryName, stationCountry };
                      sessionStorage.setItem("europcar_booking", JSON.stringify(payload));
                      window.location.href = "/checkout";
                    }}
                    className="bg-[#008d36] hover:bg-[#007530] text-white font-black py-4 px-10 rounded-lg text-lg uppercase tracking-wide shadow-lg transition-colors"
                  >
                    Ir para Revisão e Pagamento →
                  </button>
                  <div className="mt-6">
                    <button
                      onClick={() => {
                        setProtectionsSkipped(false);
                        if (zeroExcessUpgrade) {
                          setZeroExcessUpgrade(false);
                          const originalCar = cars.find(c => c.carCategoryCode === selectedCar?.carCategoryCode);
                          const originalEtoCar = etoCars.find(c => c.carCategoryCode === selectedCar?.carCategoryCode);
                          if (originalCar && originalEtoCar) {
                            const totalPriceETO = parseFloat(originalEtoCar.totalRateEstimate || "0") * (1 + etoMargin / 100);
                            const totalBRL_ETO = parseFloat(originalEtoCar.totalRateEstimateInBookingCurrency || "0") * (1 + etoMargin / 100);
                            setSelectedCar((prev: any) => ({
                              ...prev,
                              ...originalCar,
                              ...originalEtoCar,
                              totalRateEstimate: totalPriceETO.toFixed(2),
                              totalRateEstimateInBookingCurrency: totalBRL_ETO.toFixed(2),
                              optionalInsurances: originalCar.optionalInsurances,
                              imageUrl: prev.imageUrl,
                              _etoCID: '56935466'
                            }));
                          }
                        }
                      }}
                      className="text-[#008d36] text-sm font-bold hover:underline"
                    >
                      ← Rever opções de proteção e extras
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {/* 🛡️ Zero Excess Upsell — only for ETO tariff */}
                  {selectedTariffType === 'ETO' && (() => {
                    const code = selectedCar?.carCategoryCode;
                    const etoZeroCar = etoZeroCars.find(e => e.carCategoryCode === code);
                    if (!etoZeroCar) return null;
                    // selectedCar.totalRateEstimate already has etoMargin applied (set when user clicked "Pagar Agora")
                    // so we must apply the same margin to the Zero Excess price to get a consistent upgrade delta
                    const marginMultiplier = 1 + (etoMargin / 100);
                    const currentTotal = parseFloat(selectedCar?.totalRateEstimate || 0);
                    const zeroTotal_raw = parseFloat(etoZeroCar.totalRateEstimate || 0);
                    const zeroTotal = zeroTotal_raw * marginMultiplier;
                    const upgradeCost = zeroTotal - currentTotal;
                    const currency = selectedCar?.currency || 'EUR';
                    const currentBRL = parseFloat(selectedCar?.totalRateEstimateInBookingCurrency || 0);
                    const zeroBRL_raw = parseFloat(etoZeroCar.totalRateEstimateInBookingCurrency || 0);
                    const zeroBRL = zeroBRL_raw * marginMultiplier;
                    const upgradeBRL = zeroBRL - currentBRL;
                    if (upgradeCost <= 0) return null;
                    return (
                      <div className={`border-2 rounded-xl p-6 mb-8 transition-all ${zeroExcessUpgrade ? 'border-[#008d36] bg-green-50 shadow-lg shadow-green-100' : 'border-[#e67e00] bg-gradient-to-r from-orange-50 to-amber-50 hover:shadow-md'}`}>
                        <div className="flex items-start gap-5">
                          <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-[#e67e00] to-[#ff9800] flex items-center justify-center text-white text-2xl shrink-0 shadow-lg">🛡️</div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="font-black text-gray-900 text-lg">Proteção Premium — Franquia Zero</h3>
                              <span className="text-[9px] bg-[#e67e00] text-white px-2 py-0.5 rounded-full font-black uppercase">Recomendado</span>
                            </div>
                            <p className="text-sm text-gray-600 mb-3">Elimine completamente a franquia em caso de dano ou roubo. Viaje com tranquilidade total — você não paga <strong>nenhum valor adicional</strong> em caso de sinistro.</p>
                            <div className="flex items-center gap-6">
                              <div>
                                <span className="text-[10px] text-gray-400 uppercase font-bold block">Upgrade por apenas</span>
                                <span className="text-2xl font-black text-[#e67e00]">+ {currency} {fmtPrice(upgradeCost)}</span>
                                {upgradeBRL > 0 && <span className="text-xs text-gray-500 ml-2">(+ R$ {fmtPrice(upgradeBRL)})</span>}
                              </div>
                              <button
                                onClick={() => {
                                  if (zeroExcessUpgrade) { setZeroExcessUpgrade(false); }
                                  else {
                                    setZeroExcessUpgrade(true);
                                    setSelectedCar((prev: any) => ({
                                      ...prev,
                                      ...etoZeroCar,
                                      // Store margin-adjusted prices so totals downstream are consistent
                                      totalRateEstimate: zeroTotal.toFixed(2),
                                      totalRateEstimateInBookingCurrency: zeroBRL.toFixed(2),
                                      optionalInsurances: prev?.optionalInsurances,
                                      imageUrl: prev?.imageUrl,
                                      _etoCID: '56935495'
                                    }));
                                  }
                                }}
                                className={`font-bold py-3 px-8 rounded-lg text-sm transition-all ${zeroExcessUpgrade ? 'bg-[#008d36] text-white shadow-lg' : 'bg-[#e67e00] hover:bg-[#cc6f00] text-white shadow-lg shadow-[#e67e00]/25'}`}
                              >
                                {zeroExcessUpgrade ? '✓ Adicionado' : 'Adicionar Proteção'}
                              </button>
                            </div>
                            {zeroExcessUpgrade && (
                              <div className="mt-3 text-sm text-[#008d36] font-bold flex items-center gap-2">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>
                                Franquia zero ativada! Novo total: {currency} {fmtPrice(zeroTotal)}
                                {zeroBRL > 0 && <span className="text-gray-500 font-normal">(R$ {fmtPrice(zeroBRL)})</span>}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Proteções da API Europcar XRS — shown only for POA (pay at counter) */}
                  {!zeroExcessUpgrade && selectedTariffType === 'POA' && selectedCar?.optionalInsurances?.length > 0 ? (
                    <>
                      <h3 className="font-bold text-lg text-gray-900 mb-4">Proteções disponíveis</h3>
                      <div className="grid grid-cols-2 gap-4 mb-8">
                        {selectedCar.optionalInsurances.map((ins: any) => {
                          const insId = ins.code;
                          const sel = selectedExtrasMap[insId] > 0;
                          const priceEUR = parseFloat(ins.price || "0");
                          const priceBRL = parseFloat(ins.priceInBookingCurrency || "0");
                          const totalWithInsBRL = parseFloat(ins.rentalPriceInBookingCurrencyAI || "0");
                          const insNames: Record<string, string> = { TPL: "Seguro de Responsabilidade Civil", LDW: "Proteção contra Danos e Roubo (LDW)", CDW: "Proteção contra Danos por Colisão (CDW)", THW: "Proteção contra Roubo (THW)", SCDW: "Super Proteção CDW", SPCDW: "Super Proteção CDW Premium", STHW: "Super Proteção THW", SPTHW: "Super Proteção THW Premium", MEDIUM: "Cobertura Média", PREMIUM: "Cobertura Premium", PREMPRE: "Premium Pré-pago", PREMUP: "Upgrade Premium", RSA: "Assistência na Estrada (RSA)", APP: "Proteção de Aparência", PAI: "Proteção de Acidentes Pessoais (PAI)", PEP: "Proteção de Efeitos Pessoais (PEP)" };
                          const insDesc: Record<string, string> = { TPL: "Seguro obrigatório de Responsabilidade Civil perante terceiros.", LDW: `CDW + THW: limita responsabilidade. Franquia: ${selectedCar?.currency || 'EUR'} ${ins.excessWithPOM || "—"}.`, CDW: `Proteção contra Colisão. Franquia: ${selectedCar?.currency || 'EUR'} ${ins.excessWithPOM || "—"}.`, THW: `Proteção contra Roubo. Franquia: ${selectedCar?.currency || 'EUR'} ${ins.excessWithPOM || "—"}.`, SCDW: "Super CDW: franquia zero para danos.", SPCDW: "Super CDW Premium: franquia zero incluindo pneus e vidros.", STHW: "Super THW: franquia zero para roubo.", SPTHW: "Super THW Premium: franquia zero com cobertura estendida.", MEDIUM: `Cobertura Média com franquia reduzida. Franquia: ${selectedCar?.currency || 'EUR'} ${ins.excessWithPOM || "—"}.`, PREMIUM: "Cobertura Premium: proteção completa sem franquia.", PREMPRE: "Premium Pré-paga com desconto.", PREMUP: "Upgrade para proteção máxima.", RSA: "Assistência na Estrada 24h.", APP: "Cobre danos estéticos ao veículo.", PAI: "Cobre despesas médicas em acidentes.", PEP: "Cobre bagagens e pertences pessoais." };
                          return (
                            <div key={insId} className={`border-2 rounded-lg p-5 transition-colors ${sel ? "border-[#008d36] bg-green-50" : "border-gray-200 hover:border-[#008d36]"}`}>
                              <div className="flex justify-between items-start mb-2">
                                <h4 className="font-black text-gray-900">{insNames[insId] || insId}</h4>
                                {insId !== 'TPL' && ins.excessWithPOM && parseFloat(ins.excessWithPOM) === 0 && <span className="text-[10px] bg-green-100 text-green-700 font-bold px-2 py-0.5 rounded-full">SEM FRANQUIA</span>}
                              </div>
                              <div className="text-xl font-black text-gray-900 mb-1">{selectedCar?.currency || 'EUR'} {priceEUR.toFixed(2)}{priceBRL > 0 && selectedCar?.currency !== 'BRL' && <span className="text-sm font-normal text-gray-400 ml-1">(R$ {priceBRL.toFixed(2)})</span>}<span className="text-xs text-gray-400 font-normal"> /dia</span></div>
                              {totalWithInsBRL > 0 && <div className="text-xs text-green-700 font-bold mb-1">Total com proteção: R$ {totalWithInsBRL.toFixed(2)}</div>}
                              <p className="text-sm text-gray-500 mb-4">{insDesc[insId] || "Proteção adicional."}</p>
                              <button onClick={() => sel ? handleExtraQuantity(insId, -1) : handleExtraQuantity(insId, 1)} className={`w-full font-bold py-2 rounded text-sm transition-colors ${sel ? "bg-gray-100 text-gray-500" : "bg-[#ffcc00] hover:bg-[#e6b800] text-gray-900"}`}>{sel ? "Remover ✓" : "Adicionar"}</button>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  ) : selectedTariffType === 'POA' ? (
                    <p className="text-gray-400 text-sm py-4">Nenhuma proteção disponível para este veículo.</p>
                  ) : null}

                  {/* 🧳 Acessórios e Equipamentos (XRS API) */}
                  {xrsEquipment.length > 0 && (
                    <>
                      <h3 className="font-bold text-lg text-gray-900 mb-4 mt-8">Acessórios e Equipamentos</h3>
                      <p className="text-sm text-gray-500 mb-4">Máximo de 4 itens por reserva. Selecione os acessórios desejados.</p>
                      <div className="grid grid-cols-2 gap-4 mb-8">
                        {xrsEquipment.map((eq: any) => {
                          const qty = selectedEquipmentMap[eq.code] || 0;
                          const totalSelectedItems = Object.values(selectedEquipmentMap).reduce((a: number, b: number) => a + b, 0);
                          const canAdd = totalSelectedItems < 4;
                          const ep = equipmentPrices[eq.code];
                          const hasPrice = ep && ep.price > 0;
                          const isUnavailable = !loadingEquipment && !hasPrice;

                          return (
                            <div key={eq.code} className={`border-2 rounded-lg p-5 transition-colors ${isUnavailable ? 'border-gray-100 bg-gray-50 opacity-60' : qty > 0 ? 'border-[#008d36] bg-green-50' : 'border-gray-200 hover:border-[#008d36]'}`}>
                              <div className="flex items-start gap-3 mb-3">
                                <span className={`text-3xl ${isUnavailable ? 'grayscale' : ''}`}>{eq.icon}</span>
                                <div className="flex-1 min-w-0">
                                  <h4 className={`font-black text-sm ${isUnavailable ? 'text-gray-400' : 'text-gray-900'}`}>{eq.name}</h4>
                                  {eq.description && <p className="text-xs text-gray-500 mt-1">{eq.description}</p>}
                                </div>
                              </div>

                              {loadingEquipment ? (
                                <div className="flex items-center gap-2 text-sm text-gray-400 mb-3">
                                  <div className="w-3 h-3 border-2 border-[#e67e00] border-t-transparent rounded-full animate-spin"></div>
                                  Buscando preço...
                                </div>
                              ) : isUnavailable ? (
                                <div className="mb-3">
                                  <span className="text-xs bg-red-100 text-red-600 font-bold px-2 py-1 rounded-full">Indisponível para esta reserva</span>
                                </div>
                              ) : (
                                <>
                                  <div className="mb-3">
                                    <div className="text-xl font-black text-gray-900">
                                      {ep!.currency} {ep!.price.toFixed(2)}
                                      <span className="text-xs text-gray-400 font-normal"> /dia</span>
                                    </div>
                                    {ep!.priceBRL > 0 && (
                                      <div className="text-xs text-gray-500">R$ {ep!.priceBRL.toFixed(2)} /dia</div>
                                    )}
                                  </div>
                                  {eq.onRequest && <div className="text-[10px] bg-yellow-100 text-yellow-700 font-bold px-2 py-0.5 rounded-full mb-2 w-fit">Sob consulta — sujeito à disponibilidade</div>}
                                  <div className="flex items-center gap-3">
                                    <button
                                      onClick={() => handleEquipmentQuantity(eq.code, -1, eq.maxQty)}
                                      disabled={qty === 0}
                                      className={`w-9 h-9 rounded-lg font-bold text-lg flex items-center justify-center transition-colors ${qty > 0 ? 'bg-gray-200 hover:bg-gray-300 text-gray-700' : 'bg-gray-100 text-gray-300 cursor-not-allowed'}`}
                                    >−</button>
                                    <span className="font-black text-lg text-gray-900 w-6 text-center">{qty}</span>
                                    <button
                                      onClick={() => handleEquipmentQuantity(eq.code, 1, eq.maxQty)}
                                      disabled={!canAdd || qty >= eq.maxQty}
                                      className={`w-9 h-9 rounded-lg font-bold text-lg flex items-center justify-center transition-colors ${canAdd && qty < eq.maxQty ? 'bg-[#ffcc00] hover:bg-[#e6b800] text-gray-900' : 'bg-gray-100 text-gray-300 cursor-not-allowed'}`}
                                    >+</button>
                                    {qty > 0 && (
                                      <span className="text-xs text-[#008d36] font-bold ml-2">✓ {qty}x adicionado</span>
                                    )}
                                  </div>
                                </>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}

                  {/* ETO: Skip protections button */}
                  {selectedTariffType === 'ETO' && (
                    <div className="text-center mt-6">
                      <button onClick={() => setProtectionsSkipped(true)} className="bg-[#e67e00] hover:bg-[#cc6f00] text-white font-black py-4 px-10 rounded-lg text-base uppercase tracking-wide shadow-lg transition-colors">Continuar sem proteções adicionais →</button>
                    </div>
                  )}
                </>
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
