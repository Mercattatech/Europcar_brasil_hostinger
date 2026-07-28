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
  const [carCategoryOverrides, setCarCategoryOverrides] = useState<Record<string, string>>({});
  const [showMobileFilters, setShowMobileFilters] = useState(false);

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

    fetch('/api/cars/categories')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          const map = data.reduce((acc: any, item: any) => ({ ...acc, [item.carCode]: item.friendlyName }), {});
          setCarCategoryOverrides(map);
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

  // Calculate duration in days
  const bookingDurationDays = useMemo(() => {
    if (!pickupDate || !returnDate || pickupDate.length < 8 || returnDate.length < 8) return 1;
    const y1 = parseInt(pickupDate.slice(0, 4)), m1 = parseInt(pickupDate.slice(4, 6)) - 1, d1 = parseInt(pickupDate.slice(6, 8));
    const y2 = parseInt(returnDate.slice(0, 4)), m2 = parseInt(returnDate.slice(4, 6)) - 1, d2 = parseInt(returnDate.slice(6, 8));
    const dt1 = new Date(y1, m1, d1).getTime();
    const dt2 = new Date(y2, m2, d2).getTime();
    const diff = Math.ceil((dt2 - dt1) / (1000 * 3600 * 24));
    return diff > 0 ? diff : 1;
  }, [pickupDate, returnDate]);

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
  const [selectedProtectionPackage, setSelectedProtectionPackage] = useState<'none' | 'basic' | 'medium' | 'premium'>('none');
  const [expandedPackages, setExpandedPackages] = useState<Set<string>>(new Set());
  const [loadingExtras, setLoadingExtras] = useState(false);

  // XRS Equipment (accessories from API)
  const [xrsEquipment, setXrsEquipment] = useState<any[]>([]);
  const [selectedEquipmentMap, setSelectedEquipmentMap] = useState<Record<string, number>>({});
  const [loadingEquipment, setLoadingEquipment] = useState(false);
  // Equipment prices fetched from getQuote: { code: { price, priceBRL, currency } }
  const [equipmentPrices, setEquipmentPrices] = useState<Record<string, { price: number; priceBRL: number; totalBRL: number; currency: string; exchangeRate: number; onRequest: boolean }>>({});
  // Track if we already fetched Step 3 data for the selected car
  const [step3FetchedCarCategory, setStep3FetchedCarCategory] = useState<string | null>(null);
  // Quote insurances from getQuote API (real data for the selected vehicle)
  const [quoteInsurances, setQuoteInsurances] = useState<any[]>([]);
  // Quote mileage data from getQuote API
  const [quoteMileage, setQuoteMileage] = useState<{ includedKm: number; totalIncludedDist: number; extraKmPrice: number; extraKmPriceBRL: number; includedKmType: string; currency: string } | null>(null);

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

            let mileageType = "Controlado";
            let mileageLimit = "";
            let mileageUnit = "km";
            let extraMileageCost = "";

            // getMultipleRates returns mileage as root attributes on reservationRate
            const inclKm = attrs.includedKm || attrs.includedKmScr || "";
            const kmType = attrs.includedKmType || "D"; // D=per day, R=rental period
            const kmUnit = attrs.includedKmUnit || "K"; // K=km, M=miles

            if (inclKm === "UNLIMITED" || inclKm === "ILLIMITE" || inclKm === "ILIMITADO") {
              mileageType = "Livre";
            } else if (inclKm && inclKm !== "0") {
              mileageType = "Controlado";
              mileageLimit = inclKm;
              mileageUnit = kmUnit === "M" ? "milhas" : "km";
            } else {
              // Fallback: check distance child node
              const distanceRaw = r.distance;
              const distance = distanceRaw?.$ || distanceRaw;
              if (distance) {
                if (distance.unlimitedDistance === "Y" || distance.unlimited === "Y" || distance.unlimitedMileage === "Y") {
                  mileageType = "Livre";
                } else {
                  const distVal = distance.distanceValue || distance.includedDistance || distance.quantity || distance.freeDistance || distance.value || "";
                  if (distVal) mileageLimit = String(distVal);
                  mileageUnit = (distance.unit === "M" || distance.distUnit === "M") ? "milhas" : "km";
                }
                const extraRate = distance.extraDistanceRate || distance.extraMileageRate || distance.surchargeRate || "";
                if (extraRate) extraMileageCost = String(extraRate);
              }
            }


            // Extract deductible/excess from included insurances
            let deductibleAmount = "";
            let deductibleCurrency = "";
            const allInsForDeductible = insArr.map((ins: any) => ins.$ || ins);
            // Look for CDW or basic protection with deductible
            const cdwIns = allInsForDeductible.find((ins: any) => 
              (ins.code === "CDW" || ins.code === "TP" || ins.code === "TPC" || ins.type === "M") && ins.deductible
            );
            if (cdwIns) {
              deductibleAmount = cdwIns.deductible;
              deductibleCurrency = cdwIns.deductibleCurrency || attrs.currency || 'BRL';
            }
            // Fallback: check for any insurance with deductible
            if (!deductibleAmount) {
              const anyWithDeductible = allInsForDeductible.find((ins: any) => ins.deductible);
              if (anyWithDeductible) {
                deductibleAmount = anyWithDeductible.deductible;
                deductibleCurrency = anyWithDeductible.deductibleCurrency || attrs.currency || "BRL";
              }
            }


            // Extract ageLimit from the reservationRate node
            const ageLimit = r.ageLimit?.$ || r.ageLimit || {};
            const minAgeForCategory = ageLimit.minAgeForCategory || attrs.minAgeForCategory || '';

            // Build specs from the reservationRate attributes directly (all fields come from API)
            const specsFromRate = {
              carCategorySeats:           attrs.carCategorySeats || '',
              carCategoryDoors:           attrs.carCategoryDoors || '',
              carCategoryAirCond:         attrs.carCategoryAirCond || '',
              carCategoryAutomatic:       attrs.carCategoryAutomatic || '',
              carCategoryBaggageQuantity: attrs.carCategoryBaggageQuantity || '',
              carCategoryPowerHP:         attrs.carCategoryPowerHP || '',
              carCategoryPowerKW:         attrs.carCategoryPowerKW || '',
              carCategoryCO2Quantity:     attrs.carCategoryCO2Quantity || '',
              carCategoryType:            attrs.carCategoryType || '',
              carCategoryFuelType:        attrs.fuelTypeCode || '',
              carCategoryModelHeight:     attrs.carCategoryModelHeight || '',
              carCategoryModelLength:     attrs.carCategoryModelLength || '',
              carCategoryModelWidth:      attrs.carCategoryModelWidth || '',
              carCategoryModelGuaranteed: attrs.carCategoryModelGuaranteed || '',
              carCategoryMinDriverAge:    minAgeForCategory,
            };
            // Merge with catDetailsMap (fallback for any field not in reservationRate)
            const specs = { ...specsMap[attrs.carCategoryCode] || {}, ...specsFromRate };

            allRates.push({ 
              ...attrs, 
              imageUrl, 
              optionalInsurances, 
              includedInsurances,
              mileageType,
              mileageLimit,
              mileageUnit,
              mileageKmType: attrs.includedKmType || 'D', // D=per day, R=rental period
              extraMileageCost: extraMileageCost || attrs.extraKmPrice || '',
              deductibleAmount,
              deductibleCurrency,
              distanceRaw: '',
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
  }, [currentStep, dbExtras.length]);

  // ── Step 3: Load equipment + prices + insurances + mileage ─────────────────
  // Strategy:
  //  1. Call getEquipmentList (real API, stationID + dates) → what's available here
  //  2. Filter out "U" (Unavailable) → show "R" (On Request) with warning badge
  //  3. Call getQuote with chargesDetail="TRE" + correct prepaidMode → get prices
  //  4. Deduplicate prices: one price per item based on prepaidMode (NP vs PP)
  useEffect(() => {
    if (currentStep !== 3 || !selectedCar) return;
    const carCategory = selectedCar.carCategoryCode;
    if (!carCategory || !pickupStation || !pickupDate || !returnDate) return;
    if (step3FetchedCarCategory === carCategory) return;

    // Determine prepaidMode based on tariff type
    // POA (Pay on Arrival) → NP (Non-Prepaid)
    // ETO (prepaid corporate) → PP (Prepaid)
    const prepaidMode = selectedTariffType === 'ETO' ? 'PP' : 'NP';

    const cidForQuote = selectedTariffType === 'ETO'
      ? (selectedCar._etoCID || '56935466')
      : (effectiveContractID || '57269673');

    setLoadingEquipment(true);

    // ── Step 3a: getEquipmentList → available items for this station ─────────
    const equipListUrl = new URLSearchParams({
      station:     pickupStation,
      date:        pickupDate,
      returnDate:  returnDate,
      prepaidMode: prepaidMode,
    });

    fetch(`/api/europcar/getEquipmentList?${equipListUrl.toString()}`)
      .then(r => r.json())
      .then(async (listData) => {
        const apiEquipment: any[] = listData.equipment || [];

        // Equipment from API already filtered (U=unavailable removed)
        // Build the working list for this station
        const stationEquipment = apiEquipment.map((eq: any) => ({
          code:        eq.code,
          name:        eq.name,
          icon:        eq.icon        || '📦',
          description: eq.description || '',
          maxQty:      Math.min(eq.maxQty ?? 4, 4),
          onRequest:   eq.onRequest   || false,
          statusCode:  eq.statusCode  || 'F',
          // Prices from getEquipmentList (may be partial — enriched by getQuote below)
          priceFromList: eq.price     || 0,
        }));

        // ── Step 3b: getQuote with chargesDetail="TRE" ────────────────────
        // Send only the available codes (max 4) to get accurate per-item prices.
        // getQuote returns a single price per item based on the prepaidMode sent.
        const codesForQuote = stationEquipment
          .filter((eq: any) => !eq.onRequest) // exclude On-Request from pricing call
          .map((eq: any) => ({ code: eq.code, qty: 1 }));

        let quoteData: any = null;
        if (codesForQuote.length > 0) {
          try {
            const quoteRes = await fetch('/api/europcar/getQuote', {
              method:  'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                carCategory,
                pickupStation,
                returnStation: returnStation || pickupStation,
                pickupDate,
                returnDate,
                pickupTime,
                returnTime,
                contractID:  cidForQuote,
                prepaidMode,           // ← dynamic NP or PP
                equipmentList: codesForQuote,
              }),
            });
            quoteData = await quoteRes.json();
          } catch (err) {
            console.warn('[Step3] getQuote failed:', err);
          }
        }

        // ── Parse prices from getQuote response ──────────────────────────
        const prices: Record<string, { price: number; priceBRL: number; totalBRL: number; currency: string; exchangeRate: number; onRequest: boolean }> = {};

        if (quoteData) {
          const reservation = quoteData?.message?.serviceResponse?.reservation;
          const quote       = reservation?.quote;
          const quoteAttrs  = quote?.$ || quote || {};
          const exchRate    = parseFloat(quoteAttrs.exchangeRate || '1');

          const eqList = reservation?.equipmentList?.equipment;
          if (eqList) {
            const items = Array.isArray(eqList) ? eqList : [eqList];
            for (const item of items) {
              const a    = item.$ || item;
              const code = (a.code || '').toString().trim().toUpperCase();
              if (!code) continue;

              const itemPrice    = parseFloat(a.price                              || '0');
              const itemPriceBRL = parseFloat(a.priceInBookingCurrency             || '0');
              const itemTotalBRL = parseFloat(
                a.rentalPriceInBookingCurrencyAI ||
                a.rentalMaxInBookingCurrencyAI   ||
                a.priceInBookingCurrency         || '0'
              );

              // statusCode from getQuote also applies — re-check
              const sc = (a.statusCode || 'F').toString().trim().toUpperCase();
              if (sc === 'U') continue; // skip unavailable

              prices[code] = {
                price:        itemPrice,
                priceBRL:     itemPriceBRL,
                totalBRL:     itemTotalBRL,
                currency:     quoteAttrs.currency || 'EUR',
                exchangeRate: exchRate,
                onRequest:    sc === 'R',
              };
            }
          }

          // ── Insurance list from getQuote ────────────────────────────────
          const rawIns  = quote?.insuranceList?.insurance || [];
          const insArr  = Array.isArray(rawIns) ? rawIns : [rawIns];
          const parsedInsurances = insArr.map((ins: any) => {
            const a = ins.$ || ins;
            return {
              code:                          a.code                          || '',
              descr:                         a.descr                         || '',
              type:                          a.type                          || 'O',
              price:                         parseFloat(a.price              || '0'),
              priceInBookingCurrency:        parseFloat(a.priceInBookingCurrency || '0'),
              rentalPriceAI:                 parseFloat(a.rentalPriceAI      || '0'),
              rentalPriceInBookingCurrencyAI:parseFloat(a.rentalPriceInBookingCurrencyAI || '0'),
              excessWithPOM:                 parseFloat(a.excessWithPOM      || '0'),
              bkExcessWithPOM:               parseFloat(a.bkExcessWithPOM    || '0'),
            };
          }).filter((ins: any) => ins.code);
          setQuoteInsurances(parsedInsurances);

          // ── Mileage data ────────────────────────────────────────────────
          const includedKm     = parseInt(quoteAttrs.includedKm     || '0');
          const totalIncludedDist = parseInt(quoteAttrs.totalIncludedDist || '0');
          const extraKmPrice   = parseFloat(quoteAttrs.extraKmPrice  || '0');
          const exchangeRate   = parseFloat(quoteAttrs.exchangeRate  || '1');
          if (includedKm > 0 || totalIncludedDist > 0) {
            setQuoteMileage({
              includedKm,
              totalIncludedDist,
              extraKmPrice,
              extraKmPriceBRL: extraKmPrice * exchangeRate,
              includedKmType:  quoteAttrs.includedKmType || 'D',
              currency:        quoteAttrs.currency       || 'EUR',
            });
          }
        }

        setEquipmentPrices(prices);

        // ── Finalize equipment list with merged price data ─────────────────
        // Items from the API + enriched with getQuote prices.
        // Items that have no price from either source are still shown if
        // they came from getEquipmentList (statusCode F or R).
        const finalEquipment = stationEquipment.map((eq: any) => ({
          ...eq,
          // Override onRequest if getQuote also flags it
          onRequest: eq.onRequest || (prices[eq.code]?.onRequest ?? false),
        }));

        setXrsEquipment(finalEquipment);
        setStep3FetchedCarCategory(carCategory);
        console.log(`[Step3] Equipment loaded: ${finalEquipment.length} items, prepaidMode=${prepaidMode}`);
      })
      .catch(err => console.warn('[Step3] getEquipmentList failed:', err))
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
    setZeroExcessUpgrade(false);       // reset upgrade when changing car
    setEquipmentPrices({});            // reset equipment prices for new station/car
    setXrsEquipment([]);               // reset dynamic equipment list for new station
    setStep3FetchedCarCategory(null);  // reset fetch tracker
    setQuoteInsurances([]);            // reset insurances for new car
    setQuoteMileage(null);             // reset mileage for new car
    setSelectedEquipmentMap({});       // clear previous selections
    setCurrentStep(3);
    window.scrollTo({ top: 0, behavior: "smooth" });

    // Journey tracking — Step 2: Vehicle Selected
    try {
      const sessionId = sessionStorage.getItem("europcar_journey_session");
      if (sessionId) {
        fetch("/api/journey/track", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId,
            step: 2,
            selectedCar: car.carCategoryCode,
            selectedCarName: carCategoryOverrides[car.carCategoryCode] || car.carCategorySample || car.carCategoryCode,
            carPrice: parseFloat(car.totalRateEstimateInBookingCurrency || car.totalRateEstimate || "0"),
          }),
        }).catch(() => {});
      }
    } catch {}
  };

  const fmtPrice = (v: any) => parseFloat(String(v || 0)).toFixed(2).replace(".", ",");

  // ---- RENDER ----
  return (
    <div className="min-h-screen bg-[#f7f7f7] font-sans">
      {showLoginModal && <LoginModal onClose={() => setShowLoginModal(false)} />}

      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 h-14 md:h-20 flex justify-between items-center">
          <Link href="/">
            <img src="/logo.jpg" alt="Europcar" className="h-8 md:h-12 object-contain" />
          </Link>
          <div className="flex items-center gap-3 md:gap-6 text-xs md:text-sm font-bold text-gray-900">
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
        <div className="max-w-7xl mx-auto px-4 flex gap-2 md:gap-4 overflow-x-auto scroll-x-mobile pb-2 md:pb-0">
          {/* Step 1 */}
          <div className="min-w-[120px] md:min-w-0 flex-1 bg-white border border-gray-200 rounded p-2 md:p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="bg-[#008d36] text-white font-bold text-[10px] md:text-xs w-4 h-4 md:w-5 md:h-5 flex items-center justify-center rounded-sm">1</span>
              <span className="text-[9px] md:text-[11px] font-bold text-gray-500 uppercase">LOCAL</span>
            </div>
            <div className="flex justify-between text-[10px] md:text-xs">
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
          <div className={`min-w-[100px] md:min-w-0 flex-1 bg-white border-2 ${currentStep === 2 ? "border-[#008d36]" : "border-gray-200"} rounded p-2 md:p-4 relative`}>
            <div className="absolute -top-3 left-4 bg-white px-2 flex items-center gap-2">
              <span className="bg-[#008d36] text-white font-bold text-xs w-5 h-5 flex items-center justify-center rounded-sm">2</span>
              <span className="text-[11px] font-bold text-[#008d36] uppercase">VEÍCULO</span>
            </div>
            <p className="text-[13px] text-gray-500 mt-2">
              {selectedCar ? `${selectedCar.carCategorySample || carCategoryOverrides[selectedCar.carCategoryCode] || selectedCar.carCategoryName || selectedCar.carCategoryCode} ✓` : "Selecione um veículo abaixo."}
            </p>
          </div>
          {/* Step 3 */}
          <div className={`min-w-[100px] md:min-w-0 flex-1 bg-white border-2 ${currentStep === 3 ? "border-[#008d36]" : "border-gray-200"} rounded p-2 md:p-4 relative`}>
            <div className="absolute -top-3 left-4 bg-white px-2 flex items-center gap-2">
              <span className={`${currentStep === 3 ? "bg-[#008d36] text-white" : "bg-gray-200 text-gray-500"} font-bold text-xs w-5 h-5 flex items-center justify-center rounded-sm`}>3</span>
              <span className={`text-[11px] font-bold ${currentStep === 3 ? "text-[#008d36]" : "text-gray-400"} uppercase`}>PROTEÇÃO, EXTRAS</span>
            </div>
            <p className="text-[13px] text-gray-500 mt-2">{currentStep === 3 ? "Escolha extras opcionais." : "Disponível após selecionar veículo."}</p>
          </div>
          {/* Step 4 */}
          <div className="min-w-[80px] md:min-w-0 flex-1 bg-white border border-gray-200 rounded p-2 md:p-4">
            <div className="flex items-center gap-2">
              <span className="bg-gray-200 text-gray-500 font-bold text-xs w-5 h-5 flex items-center justify-center rounded-sm">4</span>
              <span className="text-[11px] font-bold text-gray-400 uppercase">REVISAR</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main */}
      <div className="max-w-7xl mx-auto px-4 py-4 md:py-8 flex flex-col md:flex-row gap-4 md:gap-8 items-start">
        {/* Mobile filter toggle */}
        {currentStep === 2 && (
          <button
            onClick={() => setShowMobileFilters(!showMobileFilters)}
            className="md:hidden flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-4 py-3 w-full justify-center text-sm font-bold text-gray-700"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" /></svg>
            {showMobileFilters ? 'Ocultar Filtros' : 'Mostrar Filtros'}
          </button>
        )}
        {/* Filters sidebar */}
        {currentStep === 2 && (
        <div className={`${showMobileFilters ? 'block' : 'hidden'} md:block w-full md:w-[260px] shrink-0 md:sticky md:top-4`}>
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
              <input
                type="range" min="2" max="7" value={minSeats}
                onChange={e => setMinSeats(Number(e.target.value))}
                className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
                style={{
                  background: `linear-gradient(to right, #d1d5db ${((minSeats - 2) / (7 - 2)) * 100}%, #008d36 ${((minSeats - 2) / (7 - 2)) * 100}%)`,
                }}
              />
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
                    const name = carCategoryOverrides[code] || car.carCategoryName || code;
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
                    const isBrazil = stationCountry === 'BR' || pickupStation.toUpperCase().startsWith('BR'); // Brazil: POA only; international: POA + ETO
                    const hasETO = !isBrazil && etoCar && totalPriceETO_raw > 0;
                    // Calculate discount % ETO vs POA
                    const discountPct = hasETO && totalPricePOA > 0 ? Math.round((1 - totalPriceETO / totalPricePOA) * 100) : 0;

                    const dailyBRL_POA = totalBRL_POA > 0 ? totalBRL_POA / bookingDurationDays : 0;
                    const dailyPOA = totalPricePOA > 0 ? totalPricePOA / bookingDurationDays : 0;

                    const isPremium = code.startsWith('U') || code.startsWith('L') || car.specs?.carCategoryType?.toLowerCase().includes('premium');

                    return (
                      <div key={`${code}-${idx}`} className={`bg-white rounded border flex flex-col transition-shadow ${isSelected ? "border-[#008d36] shadow-lg" : isPremium ? "border-[#c9a84c] hover:shadow-md" : "border-gray-200 hover:shadow-md"}`}>
                        
                        {/* Top row */}
                        <div className="flex flex-col sm:flex-row p-4 md:p-5 gap-4 md:gap-6">
                          {/* Image - gold background for premium */}
                          <div className={`w-full sm:w-[200px] md:w-[240px] shrink-0 flex items-center justify-center p-2 rounded-lg ${isPremium ? "bg-gradient-to-b from-[#f5ecd0] to-[#efe3c0]" : ""}`}>
                            <CarImage sample={sample} code={code} alt={sample || name} imageUrl={car.imageUrl} overrideUrl={carImageOverrides[code]} />
                          </div>

                          {/* Info */}
                          <div className="flex-1 flex flex-col justify-start">
                            {/* Car name: use sample (AUDI A3 SPORTBACK) as main title */}
                            <h2 className="text-lg md:text-[22px] font-black text-gray-900 uppercase tracking-tight">
                              {sample || name}
                            </h2>
                            
                            {/* Tags row with tooltips */}
                            <div className="mt-2 mb-4 flex flex-wrap gap-2">
                              {/* Premium or OU SIMILAR tag */}
                              {isPremium ? (
                                <span className="group relative inline-flex items-center gap-1.5 bg-gradient-to-r from-[#c9a84c] to-[#d4b85a] rounded-full px-3 py-1.5 text-[10px] font-black text-white uppercase cursor-help shadow-sm">
                                  <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M5 16L3 5l5.5 5L12 4l3.5 6L21 5l-2 11H5zm14 3c0 .6-.4 1-1 1H6c-.6 0-1-.4-1-1v-1h14v1z"/></svg>
                                  PREMIUM
                                  <svg className="w-3.5 h-3.5 bg-white/30 text-white rounded-full p-[2px]" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" /></svg>
                                  <span className="absolute top-full left-0 mt-2 w-72 bg-[#c9a84c] text-white text-[12px] font-medium normal-case rounded-lg p-4 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-xl leading-relaxed">
                                    Você receberá este modelo ou outro similar de uma marca Premium: BMW, Audi, Mercedes, Tesla, Jaguar, Land Rover, Lexus, Porsche, Volvo ou Alfa Romeo.
                                  </span>
                                </span>
                              ) : (
                                <span className="group relative inline-flex items-center gap-1.5 border border-gray-300 rounded-full px-3 py-1 text-[10px] font-black text-gray-900 uppercase cursor-help">
                                  OU SIMILAR {name.split(',')[0].split(' ')[0]}
                                  <svg className="w-3.5 h-3.5 bg-gray-300 text-white rounded-full p-[2px]" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" /></svg>
                                  <span className="absolute top-full left-0 mt-2 w-64 bg-gray-900 text-white text-[11px] font-normal normal-case rounded-lg p-3 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-xl">
                                    Você receberá este modelo ou um veículo similar da mesma categoria com características equivalentes.
                                  </span>
                                </span>
                              )}

                              {/* Category type tag from API */}
                              {car.specs?.carCategoryType && (
                                <span className="group relative inline-flex items-center gap-1.5 bg-gray-100 rounded-full px-3 py-1 text-[10px] font-black text-gray-600 uppercase cursor-help">
                                  {car.specs.carCategoryType}
                                  <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 bg-gray-900 text-white text-[11px] font-normal normal-case rounded-lg p-3 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-xl">
                                    Tipo de veículo: {car.specs.carCategoryType}
                                  </span>
                                </span>
                              )}

                              {/* Fuel type tag */}
                              {car.specs?.carCategoryFuelType && (
                                <span className="group relative inline-flex items-center gap-1.5 bg-blue-50 rounded-full px-3 py-1 text-[10px] font-black text-blue-700 uppercase cursor-help">
                                  {car.specs.carCategoryFuelType === 'D' ? 'Diesel' : car.specs.carCategoryFuelType === 'E' ? 'Elétrico' : car.specs.carCategoryFuelType === 'H' ? 'Híbrido' : 'Gasolina'}
                                  <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-40 bg-gray-900 text-white text-[11px] font-normal normal-case rounded-lg p-3 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-xl">
                                    Tipo de combustível do veículo
                                  </span>
                                </span>
                              )}

                              {/* Model Choice tag */}
                              {car.specs?.carCategoryModelGuaranteed === 'Y' && (
                                <span className="group relative inline-flex items-center gap-1.5 bg-purple-50 rounded-full px-3 py-1 text-[10px] font-black text-purple-700 uppercase cursor-help">
                                  Model Choice
                                  <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 bg-gray-900 text-white text-[11px] font-normal normal-case rounded-lg p-3 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-xl">
                                    Modelo garantido — você receberá exatamente este veículo.
                                  </span>
                                </span>
                              )}
                            </div>

                            {/* 2.2 Vehicle Specs Icons Row */}
                            <div className="flex items-center gap-4 text-sm font-black text-gray-900 flex-wrap">
                              <span className="flex items-center gap-1.5" title="Passageiros">
                                <svg className="w-[18px] h-[18px] text-gray-300" fill="currentColor" viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
                                {car.specs?.carCategorySeats || car.carCategorySeats || "?"}
                              </span>
                              <span className="flex items-center gap-1.5" title="Portas">
                                <svg className="w-[18px] h-[18px] text-gray-300" fill="currentColor" viewBox="0 0 24 24"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-8 12H9v-2h2v2zm0-4H9V9h2v2z"/></svg>
                                {car.specs?.carCategoryDoors || car.carCategoryDoors || "?"}
                              </span>
                              {car.specs?.carCategoryBaggageQuantity && (
                                <span className="flex items-center gap-1.5" title="Malas">
                                  <svg className="w-[18px] h-[18px] text-gray-300" fill="currentColor" viewBox="0 0 24 24"><path d="M17 6h-2V3c0-.55-.45-1-1-1h-4c-.55 0-1 .45-1 1v3H7c-1.1 0-2 .9-2 2v11c0 1.1.9 2 2 2h10c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-6-2h2v2h-2V4z"/></svg>
                                  {car.specs.carCategoryBaggageQuantity}
                                </span>
                              )}
                              <span className="flex items-center gap-1.5" title="Transmissão">
                                <svg className="w-[18px] h-[18px] text-gray-300" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v4h-2zm0 6h2v2h-2z"/></svg>
                                {car.specs?.carCategoryAutomatic === "Y" || car.carCategoryAutomatic === "Y" ? "A" : "M"}
                              </span>
                              {(car.specs?.carCategoryAirCond === "Y" || car.carCategoryAirCond === "Y") && (
                                <span className="flex items-center gap-1.5" title="Ar-condicionado">
                                  <svg className="w-[18px] h-[18px] text-gray-300" fill="currentColor" viewBox="0 0 24 24"><path d="M17.3 11l-3.3-3.3c-.4-.4-1-.4-1.4 0s-.4 1 0 1.4L14.2 10.7 13.5 10H10V6.5l.7.7c.4.4 1 .4 1.4 0s.4-1 0-1.4l-3.3-3.3c-.4-.4-1-.4-1.4 0l-3.3 3.3c-.4.4-.4 1 0 1.4s1 .4 1.4 0l.7-.7V10H2.8l1.6-1.6c.4-.4.4-1 0-1.4s-1-.4-1.4 0l-3.3 3.3c-.4.4-.4 1 0 1.4s1 .4 1.4 0L2.8 13h3.5v3.5l-.7-.7c-.4-.4-1-.4-1.4 0s-.4 1 0 1.4l3.3 3.3c.4.4 1 .4 1.4 0s.4-1 0-1.4l-.7-.7V13h3.5l-1.6 1.6c-.4.4-.4 1 0 1.4s1 .4 1.4 0l3.3-3.3c.3-.4.3-1-.1-1.4zM12 12c-.6 0-1-.4-1-1s.4-1 1-1 1 .4 1 1-.4 1-1 1z"/></svg>
                                  A/C
                                </span>
                              )}
                              <span className="flex items-center gap-1.5" title="Idade mínima do motorista">
                                <svg className="w-[18px] h-[18px] text-gray-300" fill="currentColor" viewBox="0 0 24 24"><path d="M21 3H3c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 14c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm7.5 3H4.5v-1c0-1.5 3-2.25 4.5-2.25s4.5.75 4.5 2.25v1z"/></svg>
                                {car.specs?.carCategoryMinDriverAge || "18"}
                              </span>
                            </div>

                            {/* Mileage + Protection Checks */}
                            <div className="flex flex-col gap-1 mt-4">
                              <div className="text-[#008d36] flex items-center gap-2 text-sm font-bold">
                                <svg className="w-[16px] h-[16px] text-[#008d36]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
                                {car.mileageType === "Livre" ? "Quilometragem ilimitada" : car.mileageLimit ? `${car.mileageLimit} ${car.mileageUnit || "km"} incluído` : "Quilometragem incluída"}
                              </div>
                              <div className="text-[#008d36] flex items-center gap-2 text-sm font-bold">
                                <svg className="w-[16px] h-[16px] text-[#008d36]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
                                Proteção básica incluída
                              </div>
                            </div>
                          </div>

                          {/* Price columns */}
                          <div className={`shrink-0 flex ${hasETO ? 'gap-4' : ''} items-stretch justify-end`}>
                            {/* POA - Pay at Counter */}
                            <div className={`${hasETO ? 'w-[180px]' : 'w-[200px]'} flex flex-col items-end justify-center text-right`}>
                              <span className="text-[10px] text-gray-800 font-medium uppercase tracking-wider mb-2">PAGAR NO BALCÃO</span>
                              <div className="flex flex-col items-end mb-1">
                                <div className="text-2xl font-black text-gray-900 leading-none whitespace-nowrap">
                                  {dailyBRL_POA > 0 ? `R$ ${fmtPrice(dailyBRL_POA)}` : `${currency} ${fmtPrice(dailyPOA)}`} <span className="text-xl font-normal text-gray-900">/ dia</span>
                                </div>
                                <div className="text-sm text-gray-400 font-medium mt-1">
                                  TOTAL {totalBRL_POA > 0 ? `R$ ${fmtPrice(totalBRL_POA)}` : `${currency} ${fmtPrice(totalPricePOA)}`}
                                </div>
                              </div>
                              <button
                                onClick={() => { setSelectedTariffType('POA'); handleSelectCar(car); }}
                                className="w-full mt-4 bg-[#FFD100] hover:bg-[#F2C700] text-black font-black py-3 px-4 rounded text-base transition-colors"
                              >
                                {isSelected && selectedTariffType === 'POA' ? "Selecionado" : "Selecionar"}
                              </button>
                            </div>

                            {/* ETO - Pay Now (with markup) */}
                            {hasETO && (() => {
                              const dailyBRL_ETO = totalBRL_ETO > 0 ? totalBRL_ETO / bookingDurationDays : 0;
                              const dailyETO = totalPriceETO > 0 ? totalPriceETO / bookingDurationDays : 0;
                              return (
                                <div className="w-[190px] flex flex-col items-end justify-center text-right bg-green-50 border border-green-200 rounded-lg p-3 relative">
                                  {discountPct > 0 && (
                                    <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-[#008d36] text-white text-[10px] font-black px-2 py-0.5 rounded-full whitespace-nowrap">
                                      {discountPct}% MAIS BARATO
                                    </span>
                                  )}
                                  <span className="text-[10px] text-[#008d36] font-bold uppercase tracking-wider mb-2">PAGAR AGORA</span>
                                  <div className="flex flex-col items-end mb-1">
                                    <div className="text-2xl font-black text-[#008d36] leading-none whitespace-nowrap">
                                      {dailyBRL_ETO > 0 ? `R$ ${fmtPrice(dailyBRL_ETO)}` : `${currency} ${fmtPrice(dailyETO)}`} <span className="text-xl font-normal text-[#008d36]">/ dia</span>
                                    </div>
                                    <div className="text-sm text-green-600 font-medium mt-1">
                                      TOTAL {totalBRL_ETO > 0 ? `R$ ${fmtPrice(totalBRL_ETO)}` : `${currency} ${fmtPrice(totalPriceETO)}`}
                                    </div>
                                  </div>
                                  <button
                                    onClick={() => {
                                      setSelectedTariffType('ETO');
                                      const merged = { ...car, ...etoCar, totalRateEstimate: totalPriceETO.toFixed(2), totalRateEstimateInBookingCurrency: totalBRL_ETO.toFixed(2), optionalInsurances: car.optionalInsurances, imageUrl: car.imageUrl, _etoCID: '56935466' };
                                      handleSelectCar(merged);
                                    }}
                                    className="w-full mt-4 bg-[#008d36] hover:bg-[#007530] text-white font-black py-3 px-4 rounded text-base transition-colors"
                                  >
                                    {isSelected && selectedTariffType === 'ETO' ? "Selecionado ✓" : "Pagar Agora"}
                                  </button>
                                </div>
                              );
                            })()}
                          </div>
                        </div>

                        {/* Expandable Details */}
                        <details className="group">
                          <summary className="list-none flex items-center gap-1 cursor-pointer text-[#008d36] text-[15px] font-bold pl-[284px] pb-5 select-none hover:underline">
                            <span className="group-open:hidden flex items-center gap-1">Mais detalhes <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 9l-7 7-7-7" /></svg></span>
                            <span className="hidden group-open:flex items-center gap-1">Menos detalhes <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 15l7-7 7 7" /></svg></span>
                          </summary>
                          <div className="bg-[#f9f9f9] p-8 flex flex-col gap-6">
                            <h3 className="text-[22px] font-black text-gray-900">Detalhes completos do veículo</h3>
                            
                            {/* Full specs row matching official site */}
                            <div className="flex items-center gap-x-8 gap-y-4 text-[15px] font-black text-gray-900 flex-wrap">
                              <span className="flex items-center gap-2">
                                <svg className="w-5 h-5 text-gray-300" fill="currentColor" viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
                                {car.specs?.carCategorySeats || car.carCategorySeats || "?"} pessoas
                              </span>
                              <span className="flex items-center gap-2">
                                <svg className="w-5 h-5 text-gray-300" fill="currentColor" viewBox="0 0 24 24"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-8 12H9v-2h2v2zm0-4H9V9h2v2z"/></svg>
                                {car.specs?.carCategoryDoors || car.carCategoryDoors || "?"} portas
                              </span>
                              {(car.specs?.carCategoryAirCond === "Y" || car.carCategoryAirCond === "Y") && (
                                <span className="flex items-center gap-2">
                                  <svg className="w-5 h-5 text-gray-300" fill="currentColor" viewBox="0 0 24 24"><path d="M22 11h-4.17l3.24-3.24-1.41-1.42L15 11h-2V9l4.66-4.66-1.42-1.41L13 6.17V2h-2v4.17L7.76 2.93 6.34 4.34 11 9v2H9L4.34 6.34 2.93 7.76 6.17 11H2v2h4.17l-3.24 3.24 1.41 1.42L9 13h2v2l-4.66 4.66 1.42 1.41L11 17.83V22h2v-4.17l3.24 3.24 1.42-1.41L13 15v-2h2l4.66 4.66 1.41-1.42L17.83 13H22z"/></svg>
                                  A/C
                                </span>
                              )}
                              {car.specs?.carCategoryPowerHP && (
                                <span className="flex items-center gap-2">
                                  <svg className="w-5 h-5 text-gray-300" fill="currentColor" viewBox="0 0 24 24"><path d="M7 2v11h3v9l7-12h-4l4-8z"/></svg>
                                  {car.specs.carCategoryPowerHP}CV
                                </span>
                              )}
                              {car.specs?.carCategoryBaggageQuantity && (
                                <span className="flex items-center gap-2">
                                  <svg className="w-5 h-5 text-gray-300" fill="currentColor" viewBox="0 0 24 24"><path d="M17 6h-2V3c0-.55-.45-1-1-1h-4c-.55 0-1 .45-1 1v3H7c-1.1 0-2 .9-2 2v11c0 1.1.9 2 2 2h10c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-6-2h2v2h-2V4z"/></svg>
                                  {car.specs.carCategoryBaggageQuantity} bagagens
                                </span>
                              )}
                              <span className="flex items-center gap-2">
                                <svg className="w-5 h-5 text-gray-300" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v4h-2zm0 6h2v2h-2z"/></svg>
                                {car.specs?.carCategoryAutomatic === "Y" || car.carCategoryAutomatic === "Y" ? "Automático" : "Manual"}
                              </span>
                              {car.specs?.carCategoryPowerKW && (
                                <span className="flex items-center gap-2">
                                  <svg className="w-5 h-5 text-gray-300" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>
                                  {car.specs.carCategoryPowerKW} kW
                                </span>
                              )}
                            </div>
                            
                            {/* CO2 + Age row */}
                            <div className="flex items-center gap-8 text-[15px] font-black text-gray-900 flex-wrap">
                              {car.specs?.carCategoryCO2Quantity && (
                                <span className="flex items-center gap-2">
                                  <span className="bg-[#FFD100] text-black text-[11px] font-black px-2 py-0.5 rounded">D</span>
                                  Emissão de CO2: {car.specs.carCategoryCO2Quantity} g/km
                                </span>
                              )}
                              <span className="flex items-center gap-2">
                                <svg className="w-5 h-5 text-gray-300" fill="currentColor" viewBox="0 0 24 24"><path d="M21 3H3c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 14c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm7.5 3H4.5v-1c0-1.5 3-2.25 4.5-2.25s4.5.75 4.5 2.25v1z"/></svg>
                                Idade mínima do motorista: {car.specs?.carCategoryMinDriverAge || "18"} anos
                              </span>
                            </div>
                            
                            {/* Incluídos - Quilometragem + Proteção blocks */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                              <div className="border-[2px] border-gray-100 bg-white rounded-xl p-5 flex flex-col justify-start">
                                <span className="text-[10px] font-black text-[#e4002b] uppercase tracking-wider mb-1">INCLUÍDO</span>
                                <h4 className="text-[17px] font-black text-gray-900 mb-4">Quilometragem</h4>
                                <div className="flex items-start gap-2 text-sm text-gray-700 font-bold mb-2">
                                  <svg className="w-4 h-4 text-[#008d36] mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
                                  <span>
                                    {car.mileageType === "Livre"
                                      ? "Quilometragem ilimitada"
                                      : car.mileageLimit
                                        ? `${car.mileageLimit} ${car.mileageUnit || "km"} incluído${car.mileageKmType === 'D' ? '/dia' : ''}`
                                        : "Quilometragem incluída"}
                                  </span>
                                </div>
                                {car.mileageType !== "Livre" && car.extraMileageCost && (
                                  <div className="text-sm text-gray-500 pl-6">
                                    Quilometragem adicional: {currency} {car.extraMileageCost}/{car.mileageUnit || "km"}
                                  </div>
                                )}
                              </div>

                              <div className="border-[2px] border-gray-100 bg-white rounded-xl p-5 flex flex-col justify-start">
                                <span className="text-[10px] font-black text-[#e4002b] uppercase tracking-wider mb-1">INCLUÍDO</span>
                                <h4 className="text-[17px] font-black text-gray-900 mb-2">Proteção básica</h4>
                                {car.deductibleAmount && (
                                  <div className="text-sm font-bold text-gray-900 mb-4">
                                    Excesso: {car.deductibleCurrency || currency} {parseFloat(car.deductibleAmount).toLocaleString("pt-BR", {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                                  </div>
                                )}
                                <div className="flex flex-col gap-2">
                                  {car.includedInsurances && car.includedInsurances.length > 0 ? (
                                    car.includedInsurances.map((ins: any, iIdx: number) => (
                                      <div key={iIdx} className="flex items-start gap-2 text-sm text-gray-700 font-bold">
                                        <svg className="w-4 h-4 text-[#008d36] mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
                                        <span>{ins.name || ins.description || ins.code || "Proteção incluída"}</span>
                                      </div>
                                    ))
                                  ) : (
                                    <>
                                      <div className="flex items-start gap-2 text-sm text-gray-700 font-bold">
                                        <svg className="w-4 h-4 text-[#008d36] mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
                                        <span>Proteção contra danos por colisão</span>
                                      </div>
                                      <div className="flex items-start gap-2 text-sm text-gray-700 font-bold">
                                        <svg className="w-4 h-4 text-[#008d36] mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
                                        <span>Proteção contra roubo</span>
                                      </div>
                                    </>
                                  )}
                                </div>
                                <div className="flex items-start gap-2 text-xs text-gray-400 mt-4">
                                  <svg className="w-4 h-4 text-gray-300 mt-0.5 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" /></svg>
                                  Você poderá fazer upgrade da proteção depois de selecionar este veículo
                                </div>
                              </div>
                            </div>

                          </div>
                        </details>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          ) : (
            /* Step 3 */
            <div className="bg-white rounded border border-gray-200 relative">
              {/* Step 3 Header bar */}
              <div className="border-b border-gray-200 p-6 flex items-center justify-between gap-6">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <button onClick={() => { setCurrentStep(2); setEquipmentPrices({}); setXrsEquipment([]); setQuoteInsurances([]); setQuoteMileage(null); setSelectedEquipmentMap({}); }} className="text-[#008d36] font-bold hover:underline text-sm">← Voltar</button>
                  </div>
                  <h2 className="text-2xl font-black text-gray-900">Escolha sua proteção e seus extras</h2>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-xs text-gray-500 uppercase font-bold">TOTAL</div>
                  <div className="text-3xl font-black text-gray-900">
                    R$ {fmtPrice(
                      (parseFloat(selectedCar?.totalRateEstimateInBookingCurrency || selectedCar?.totalRateEstimate || "0")) +
                      (selectedExtrasPricePerDay * bookingDurationDays)
                    )}
                  </div>
                </div>
                <button
                  onClick={() => {
                    const selectedInsuranceCodes = Object.keys(selectedExtrasMap).filter(k => selectedExtrasMap[k] > 0);
                    const xrsEquipmentPayload = Object.entries(selectedEquipmentMap).filter(([, qty]) => qty > 0).map(([code, qty]) => {
                      const ep = equipmentPrices[code];
                      const meta = xrsEquipment.find((e: any) => e.code === code);
                      return { code, qty, name: meta?.name || code, icon: meta?.icon || '📦', price: ep?.price || 0, priceBRL: ep?.priceBRL || 0, currency: ep?.currency || 'EUR' };
                    });
                    const xrsInsurancesPayload = selectedInsuranceCodes.map(code => {
                      const qi = quoteInsurances.find((i: any) => i.code === code);
                      const insNamesPT: Record<string, string> = { WWI: 'Proteção de para-brisas, vidros, faróis e pneus', THW: 'Proteção contra Roubo (THW)', STHW: 'Super Proteção contra Roubo', SPTHW: 'Proteção Total contra Roubo', SPCDW: 'Proteção Total contra Danos e Acidentes', SCDW: 'Super Proteção contra Danos', RSA: 'Assistência na estrada 24h', PREMPRE: 'Proteção Plus', PREMPLUS: 'Proteção Premium Plus', PREMIUM: 'Proteção Premium', PAI: 'Proteção para acidentes pessoais', MEDIUM: 'Proteção Média', INTERIOR: 'Cobertura de danos ao interior', AWC: 'Cobertura de estradas não pavimentadas', CDW: 'Proteção contra Danos por Colisão', LDW: 'Proteção Básica', TPL: 'Responsabilidade Civil', ECOLOGIC: 'Contribuição Ambiental', PEP: 'Proteção de Efeitos Pessoais', APP: 'Proteção de Aparência', LAF: 'Taxas e Impostos (Road Tax & License Fees)', HS: 'Adicional de Alta Temporada', HB: 'Seguro de Alto Risco', FP: 'Proteção contra Combustível', XCU: 'Proteção Estendida', RELOC: 'Taxa de Relocalização', YS: 'Sobretaxa Jovem Condutor', YOUNGDRI: 'Seguro Jovem Condutor', ONEWAY: 'Taxa de Viagem de Ida', DELIVER: 'Taxa de Entrega', COLLECT: 'Taxa de Coleta', REGFEE: 'Taxa Regulatória', AIRPORTFEE: 'Taxa de Aeroporto', CITYFEE: 'Taxa Municipal', NIGHTFEE: 'Taxa Fora de Horário', HOLIDAYFEE: 'Taxa de Feriado', ADMINFEE: 'Taxa Administrativa', SAFERETURN: 'Retorno Seguro' };
                      return { code, name: insNamesPT[code] || qi?.descr || code, price: qi?.rentalPriceAI || 0, priceBRL: qi?.rentalPriceInBookingCurrencyAI || 0 };
                    });
                    const cidForTariff = selectedTariffType === 'ETO'
                      ? (zeroExcessUpgrade ? '56935495' : (selectedCar?._etoCID || '56935466'))
                      : (effectiveContractID || '57269673');
                    const payload = { car: selectedCar, extras: selectedExtrasMap, xrsEquipment: xrsEquipmentPayload, xrsInsurances: xrsInsurancesPayload, pickupStation, returnStation, pickupDate, returnDate, pickupTime, returnTime, contractID: cidForTariff, tariffType: selectedTariffType, zeroExcess: zeroExcessUpgrade, driverCountry, driverCountryName, stationCountry, quoteMileage };
                    sessionStorage.setItem("europcar_booking", JSON.stringify(payload));
                    // Journey tracking — Step 3: Extras selected, going to checkout
                    try {
                      const sessionId = sessionStorage.getItem("europcar_journey_session");
                      if (sessionId) {
                        const extraNames = [...xrsEquipmentPayload.map((e: any) => e.name), ...xrsInsurancesPayload.map((e: any) => e.name)];
                        fetch("/api/journey/track", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            sessionId,
                            step: 3,
                            selectedExtras: extraNames.length > 0 ? extraNames : null,
                          }),
                        }).catch(() => {});
                      }
                    } catch {}
                    window.location.href = "/checkout";
                  }}
                  className="bg-[#008d36] hover:bg-[#007530] text-white font-black py-3 px-6 rounded shrink-0 text-sm"
                >
                  Ir para revisão e check-out →
                </button>
              </div>

              <div className="p-8">

              {/* Congrats message — show ONLY when ETO skipped protections */}
              {(selectedTariffType === 'ETO' && protectionsSkipped) ? (
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
                      const xrsInsurancesPayload2 = selectedInsuranceCodes2.map(code => {
                        const qi = quoteInsurances.find((i: any) => i.code === code);
                        const insNamesPT: Record<string, string> = { WWI: 'Proteção de para-brisas, vidros, faróis e pneus', THW: 'Proteção contra Roubo (THW)', STHW: 'Super Proteção contra Roubo', SPTHW: 'Proteção Total contra Roubo', SPCDW: 'Proteção Total contra Danos e Acidentes', SCDW: 'Super Proteção contra Danos', RSA: 'Assistência na estrada 24h', PREMPRE: 'Proteção Plus', PREMPLUS: 'Proteção Premium Plus', PREMIUM: 'Proteção Premium', PAI: 'Proteção para acidentes pessoais', MEDIUM: 'Proteção Média', INTERIOR: 'Cobertura de danos ao interior', AWC: 'Cobertura de estradas não pavimentadas', CDW: 'Proteção contra Danos por Colisão', LDW: 'Proteção Básica', TPL: 'Responsabilidade Civil', ECOLOGIC: 'Contribuição Ambiental', PEP: 'Proteção de Efeitos Pessoais', APP: 'Proteção de Aparência', LAF: 'Taxas e Impostos (Road Tax & License Fees)', HS: 'Adicional de Alta Temporada', HB: 'Seguro de Alto Risco', FP: 'Proteção contra Combustível', XCU: 'Proteção Estendida', RELOC: 'Taxa de Relocalização', YS: 'Sobretaxa Jovem Condutor', YOUNGDRI: 'Seguro Jovem Condutor', ONEWAY: 'Taxa de Viagem de Ida', DELIVER: 'Taxa de Entrega', COLLECT: 'Taxa de Coleta', REGFEE: 'Taxa Regulatória', AIRPORTFEE: 'Taxa de Aeroporto', CITYFEE: 'Taxa Municipal', NIGHTFEE: 'Taxa Fora de Horário', HOLIDAYFEE: 'Taxa de Feriado', ADMINFEE: 'Taxa Administrativa', SAFERETURN: 'Retorno Seguro' };
                        return { code, name: insNamesPT[code] || qi?.descr || code, price: qi?.rentalPriceAI || 0, priceBRL: qi?.rentalPriceInBookingCurrencyAI || 0 };
                      });
                      const cidForTariff = selectedTariffType === 'ETO'
                        ? (zeroExcessUpgrade ? '56935495' : (selectedCar?._etoCID || '56935466'))
                        : (zeroExcessUpgrade ? '56935495' : (effectiveContractID || '57269673'));
                      const payload = { car: selectedCar, extras: selectedExtrasMap, xrsEquipment: xrsEquipmentPayload2, xrsInsurances: xrsInsurancesPayload2, pickupStation, returnStation, pickupDate, returnDate, pickupTime, returnTime, contractID: cidForTariff, tariffType: selectedTariffType, zeroExcess: zeroExcessUpgrade, driverCountry, driverCountryName, stationCountry, quoteMileage };
                      sessionStorage.setItem("europcar_booking", JSON.stringify(payload));
                      // Journey tracking — Step 3: Extras selected (ETO path)
                      try {
                        const sessionId = sessionStorage.getItem("europcar_journey_session");
                        if (sessionId) {
                          const extraNames2 = [...xrsEquipmentPayload2.map((e: any) => e.name), ...xrsInsurancesPayload2.map((e: any) => e.name)];
                          fetch("/api/journey/track", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                              sessionId,
                              step: 3,
                              selectedExtras: extraNames2.length > 0 ? extraNames2 : null,
                            }),
                          }).catch(() => {});
                        }
                      } catch {}
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

                  {/* 🛡️ Proteções da API getQuote — Real data for selected vehicle */}
                  {/* For ETO (Pagar Agora) on international stations, hide the package cards —
                      only the Zero Excess banner above is shown. */}
                  {!(selectedTariffType === 'ETO' && stationCountry !== 'BR' && !pickupStation.toUpperCase().startsWith('BR')) && quoteInsurances.length > 0 ? (() => {
                    // Insurance name and description maps (Portuguese)
                    const insNamesPT: Record<string, string> = {
                      WWI: 'Proteção de para-brisas, vidros, faróis e pneus',
                      THW: 'Proteção contra Roubo (THW)',
                      STHW: 'Super Proteção contra Roubo',
                      SPTHW: 'Proteção Total contra Roubo',
                      SPCDW: 'Proteção Total contra Danos e Acidentes',
                      SL: 'Sem Proteção (Stand Liable)',
                      SCDW: 'Super Proteção contra Danos (SCDW)',
                      RSA: 'Assistência na estrada 24h',
                      PREMPRE: 'Proteção Plus',
                      PREMPLUS: 'Proteção Premium Plus',
                      PREMIUM: 'Proteção Premium',
                      PAI: 'Proteção para acidentes pessoais',
                      MEDIUM: 'Proteção Média',
                      INTERIOR: 'Cobertura de danos ao interior',
                      AWC: 'Cobertura de estradas não pavimentadas',
                      CDW: 'Proteção contra Danos por Colisão',
                      LDW: 'Proteção Básica (LDW)',
                      TPL: 'Responsabilidade Civil',
                      ECOLOGIC: 'Contribuição Ambiental',
                      PEP: 'Proteção de Efeitos Pessoais',
                      APP: 'Proteção de Aparência',
                      // ── Códigos adicionais frequentes na API XRS ──────────────
                      LAF: 'Taxas e Impostos (Road Tax & License Fees)',
                      HS:  'Adicional de Alta Temporada',
                      HB:  'Seguro de Alto Risco',
                      FP:  'Proteção contra Combustível',
                      XCU: 'Proteção Estendida',
                      RELOC: 'Taxa de Relocalização',
                      YS: 'Sobretaxa Jovem Condutor',
                      YOUNGDRI: 'Seguro Jovem Condutor',
                      ONEWAY: 'Taxa de Viagem de Ida',
                      DELIVER: 'Taxa de Entrega',
                      COLLECT: 'Taxa de Coleta',
                      REGFEE: 'Taxa Regulatória',
                      AIRPORTFEE: 'Taxa de Aeroporto',
                      CITYFEE: 'Taxa Municipal',
                      NIGHTFEE: 'Taxa Fora de Horário',
                      HOLIDAYFEE: 'Taxa de Feriado',
                      ADMINFEE: 'Taxa Administrativa',
                      SAFERETURN: 'Retorno Seguro',
                    };
                    const insDescPT: Record<string, string> = {
                      WWI: 'Reduz a zero a sua responsabilidade financeira por danos ao para-brisas, vidros, faróis e pneus.',
                      THW: 'Proteção contra roubo do veículo com franquia reduzida.',
                      STHW: 'Super proteção contra roubo com franquia ainda menor.',
                      SPTHW: 'Proteção total contra roubo — franquia zero.',
                      SPCDW: 'Proteção total contra danos e acidentes — franquia zero, cobertura completa.',
                      SL: 'Sem proteção adicional. Você assume toda a responsabilidade financeira.',
                      SCDW: 'Redução adicional da franquia em caso de danos ao veículo.',
                      RSA: 'Todo o caminho consigo, a qualquer hora, em qualquer dia. Com a assistência na estrada terá auxílio sempre que precisar.',
                      PREMPRE: 'Pacote de proteção completo com franquia zero para maiores de 23 anos.',
                      PREMPLUS: 'Pacote premium estendido com cobertura máxima e assistência.',
                      PREMIUM: 'Pacote Premium com proteção completa contra danos e roubo.',
                      PAI: 'Oferece indenização para motorista e passageiros em caso de morte ou lesão e cobertura para despesas médicas.',
                      MEDIUM: 'Pacote de proteção com franquia reduzida contra danos e roubo.',
                      INTERIOR: 'Cobertura de danos ao interior do veículo.',
                      AWC: 'Cobertura para condução em estradas não pavimentadas ou de terra.',
                      CDW: 'Proteção contra danos por colisão com franquia.',
                      LDW: 'Proteção básica incluindo danos e roubo com franquia padrão.',
                      TPL: 'Seguro obrigatório de responsabilidade civil.',
                      ECOLOGIC: 'Contribuição ambiental obrigatória.',
                      PEP: 'Cobertura para bagagens e pertences pessoais.',
                      APP: 'Proteção contra danos estéticos ao veículo.',
                    };
                    // Icon mapping using sprite sheet position (4x4 grid)
                    const insIconEmoji: Record<string, string> = {
                      WWI: '🔧', THW: '🔒', STHW: '🔐', SPTHW: '🛡️',
                      SPCDW: '✅', SL: '⚠️', SCDW: '🛡️', RSA: '🚑',
                      PREMPRE: '⭐', PREMPLUS: '👑', PREMIUM: '🏆',
                      PAI: '🩺', MEDIUM: '🛡️', INTERIOR: '💺', AWC: '🛤️',
                      CDW: '🚗', LDW: '📋', TPL: '📄', ECOLOGIC: '🌿',
                      PEP: '🧳', APP: '🎨',
                    };
                    // ── Tier classification of insurance codes ────────────────────────────
                    const MEDIUM_CODES = new Set(['RSA', 'WWI', 'APP', 'INTERIOR', 'AWC', 'PEP', 'THW', 'STHW', 'MEDIUM', 'PAI']);
                    const PREMIUM_CODES = new Set(['SCDW', 'SPCDW', 'SPTHW', 'PREMIUM', 'PREMPLUS', 'PREMPRE', 'ECOLOGIC']);

                    const includedIns  = quoteInsurances.filter((ins: any) => ins.type === 'I');
                    const optionalIns  = quoteInsurances.filter((ins: any) => ins.type === 'O' && ins.code !== 'SL');
                    const mediumMembers  = optionalIns.filter((ins: any) => MEDIUM_CODES.has(ins.code));
                    const premiumMembers = optionalIns.filter((ins: any) => PREMIUM_CODES.has(ins.code));
                    const premiumAll    = [...mediumMembers, ...premiumMembers];
                    const sumBRL = (list: any[]) => list.reduce((acc: number, ins: any) => acc + (ins.rentalPriceInBookingCurrencyAI || 0), 0);

                    const packages = [
                      { id: 'basic' as const, label: 'Básico', sublabel: 'Já incluído no veículo', badge: '', color: 'border-gray-300', headerBg: 'bg-gray-800', icon: '🛡️', members: [] as any[], extraMembers: includedIns, total: 0, isFree: true, description: 'Proteção mínima obrigatória incluída na tarifa do veículo.' },
                      { id: 'medium' as const, label: 'Médio', sublabel: 'Cobertura ampliada', badge: 'POPULAR', color: 'border-[#008d36]', headerBg: 'bg-[#008d36]', icon: '🛡️🛡️', members: mediumMembers, extraMembers: includedIns, total: sumBRL(mediumMembers), isFree: false, description: 'Amplia a proteção com coberturas adicionais como vidros, assistência e mais.' },
                      { id: 'premium' as const, label: 'Premium', sublabel: 'Cobertura máxima', badge: 'COMPLETO', color: 'border-yellow-400', headerBg: 'bg-yellow-500', icon: '🏆', members: premiumAll, extraMembers: includedIns, total: sumBRL(premiumAll), isFree: false, description: 'Máxima cobertura: sem franquia, proteção total contra danos e roubo.' },
                    ].filter(pkg => pkg.id === 'basic' || pkg.members.length > 0);

                    const handleSelectPackage = (pkgId: 'none' | 'basic' | 'medium' | 'premium', members: any[]) => {
                      setSelectedProtectionPackage(pkgId);
                      const newMap: Record<string, number> = { ...selectedExtrasMap };
                      for (const ins of quoteInsurances) { delete newMap[ins.code]; }
                      for (const ins of members) { if (ins.type === 'O') newMap[ins.code] = 1; }
                      setSelectedExtrasMap(newMap);
                    };

                     return (
                      <>
                        <h3 className="font-extrabold text-2xl text-gray-900 mb-2">Proteções</h3>
                        <p className="text-sm text-gray-500 mb-6">Selecione as proteções desejadas. Os valores são somados e incluídos no total.</p>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                          {quoteInsurances
                            .filter((ins: any) => ins.type !== 'M' && ins.code !== 'SL')
                            .map((ins: any) => {
                              const insId = ins.code;
                              const sel = selectedExtrasMap[insId] > 0;
                              const isIncluded = ins.type === 'I';
                              const totalBRL = ins.rentalPriceInBookingCurrencyAI || 0;
                              const isAvailable = totalBRL > 0 || isIncluded;
                              const excessBRL = ins.bkExcessWithPOM || 0;
                              const name = insNamesPT[insId] || ins.descr || insId;
                              const desc = insDescPT[insId] || ins.descr || 'Proteção adicional.';
                              const icon = insIconEmoji[insId] || '🛡️';
                              const TRUNCATE_AT = 90;
                              const isLong = desc.length > TRUNCATE_AT;
                              const shortDesc = isLong ? desc.slice(0, TRUNCATE_AT) + '...' : desc;
                              return (
                                <article
                                  key={insId}
                                  className={`bg-white p-5 flex flex-col justify-between h-full rounded-lg transition-shadow duration-200 cursor-default
                                    ${sel ? 'border-2 border-[#008d36] shadow-md' : 'border border-gray-200 hover:shadow-md'}`}
                                >
                                  {/* Top content */}
                                  <div className="flex flex-col">
                                    {/* Icon + Title + Code tag */}
                                    <div className="flex items-start gap-3 mb-3">
                                      <div className="w-14 h-14 flex-shrink-0 flex items-center justify-center text-3xl bg-gray-50 rounded-lg border border-gray-100">
                                        {icon}
                                      </div>
                                      <div className="flex flex-col flex-1 min-w-0">
                                        <h2 className="text-[0.95rem] font-bold leading-tight text-gray-900 mb-1">{name}</h2>
                                        {/* Code tag */}
                                        <span className="self-start text-[10px] font-black uppercase tracking-widest bg-gray-100 text-gray-500 px-2 py-0.5 rounded border border-gray-200">
                                          {insId}
                                        </span>
                                      </div>
                                    </div>
                                    {/* Description */}
                                    <div className="text-gray-500 text-xs leading-relaxed mb-3">
                                      <p>{shortDesc}</p>
                                    </div>
                                    {/* Excess / zero excess badge */}
                                    {excessBRL > 0 && !isIncluded && (
                                      <p className="text-xs text-gray-400 mb-1">Franquia: R$ {fmtPrice(excessBRL)}</p>
                                    )}
                                    {ins.excessWithPOM === 0 && !isIncluded && insId !== 'RSA' && insId !== 'PAI' && (
                                      <span className="text-[10px] bg-green-100 text-green-700 font-bold px-2 py-0.5 rounded-full mb-2 self-start uppercase tracking-wide">Sem franquia</span>
                                    )}
                                  </div>

                                  {/* Bottom: price + button */}
                                  <div className="mt-auto">
                                    <div className="mb-3">
                                      {isIncluded ? (
                                        <span className="text-base font-extrabold text-[#008d36]">Incluída</span>
                                      ) : isAvailable ? (
                                        <>
                                          <span className="text-xl font-extrabold text-gray-900">R$ {fmtPrice(totalBRL)}</span>
                                          <span className="text-gray-500 font-medium text-sm"> / total</span>
                                        </>
                                      ) : (
                                        <span className="text-sm font-bold text-orange-400">Indisponível</span>
                                      )}
                                    </div>
                                    {isIncluded ? (
                                      <div className="w-full text-center font-bold py-2.5 rounded-md text-sm bg-green-100 text-[#008d36]">
                                        ✓ Incluída
                                      </div>
                                    ) : isAvailable ? (
                                      <button
                                        onClick={() => sel ? handleExtraQuantity(insId, -1) : handleExtraQuantity(insId, 1)}
                                        className={`w-full py-2.5 rounded-md font-bold text-sm transition-colors
                                          ${sel ? 'bg-[#008d36] text-white' : 'bg-[#FFD100] hover:bg-[#f2c800] text-black'}`}
                                      >
                                        {sel ? '✓ Adicionado — Remover' : 'Adicionar'}
                                      </button>
                                    ) : (
                                      <div className="w-full text-center font-bold py-2.5 rounded-md text-sm bg-gray-100 text-gray-400">
                                        Indisponível
                                      </div>
                                    )}
                                  </div>
                                </article>
                              );
                            })}
                        </div>
                      </>
                    );
                  })() : (
                    <p className="text-gray-400 text-sm py-4">Carregando proteções disponíveis...</p>
                  )}

                  {/* 🚗 Quilometragem Incluída */}
                  {quoteMileage && (
                    <>
                      <h3 className="font-black text-lg text-gray-900 mb-4 mt-2">Quilometragem</h3>
                      <div className="border border-gray-200 rounded-xl p-5 mb-8 flex items-center gap-5">
                        <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-yellow-400 to-amber-500 flex items-center justify-center text-2xl shrink-0 shadow-md">🛣️</div>
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-1">
                            <div className="flex items-center gap-2">
                              <svg className="w-5 h-5 text-[#008d36]" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                              <span className="font-bold text-gray-900">{quoteMileage.totalIncludedDist.toLocaleString('pt-BR')} km</span>
                            </div>
                            <span className="text-sm text-gray-500">
                              ({quoteMileage.includedKm} km/{quoteMileage.includedKmType === 'D' ? 'dia' : 'período'})
                            </span>
                          </div>
                          <div className="text-sm text-gray-500">
                            Quilometragem adicional: <span className="font-bold text-gray-700">R$ {fmtPrice(quoteMileage.extraKmPriceBRL)}/km</span>
                            <span className="text-xs text-gray-400 ml-1">({quoteMileage.currency} {fmtPrice(quoteMileage.extraKmPrice)}/km)</span>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="text-sm font-bold text-[#008d36]">Incluído</span>
                        </div>
                      </div>
                    </>
                  )}

                  {/* 🧳 Extras disponíveis (XRS API) */}
                  <div className="mt-10">
                    <h3 className="font-black text-xl text-gray-900 mb-6">Extras disponíveis</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                      {xrsEquipment.slice().sort((a: any, b: any) => {
                        const epA = equipmentPrices[a.code];
                        const fbA = parseFloat(a.priceFromList) || 0;
                        const hasPriceA = (epA && (epA.price > 0 || epA.priceBRL > 0 || epA.totalBRL > 0)) || fbA > 0;
                        const isUnavailableA = !loadingEquipment && !hasPriceA;

                        const epB = equipmentPrices[b.code];
                        const fbB = parseFloat(b.priceFromList) || 0;
                        const hasPriceB = (epB && (epB.price > 0 || epB.priceBRL > 0 || epB.totalBRL > 0)) || fbB > 0;
                        const isUnavailableB = !loadingEquipment && !hasPriceB;

                        if (isUnavailableA && !isUnavailableB) return 1;
                        if (!isUnavailableA && isUnavailableB) return -1;
                        return 0;
                      }).map((eq: any) => {
                        const qty = selectedEquipmentMap[eq.code] || 0;
                        const totalSelectedItems = Object.values(selectedEquipmentMap).reduce((a: number, b: number) => a + b, 0);
                        const canAdd = totalSelectedItems < 4;
                        const fallbackPrice = parseFloat(eq.priceFromList) || 0;
                        const ep = equipmentPrices[eq.code];
                        const hasPrice = (ep && (ep.price > 0 || ep.priceBRL > 0 || ep.totalBRL > 0)) || fallbackPrice > 0;
                        const isUnavailable = !loadingEquipment && !hasPrice;
                        const isOnRequest = ep?.onRequest || eq.onRequest;
                        // Use totalBRL (rentalPriceInBookingCurrencyAI) = total for the period in BRL
                        const priceBRL = ep && ep.totalBRL > 0
                          ? ep.totalBRL
                          : ep && ep.priceBRL > 0
                            ? ep.priceBRL * bookingDurationDays
                            : ep && ep.price > 0
                              ? ep.price * (ep.exchangeRate || 1) * bookingDurationDays
                              : fallbackPrice * parseFloat(selectedCar?.exchangeRate || '1') * bookingDurationDays;

                        return (
                          <div
                            key={eq.code}
                            className={`bg-white border rounded-lg p-5 flex flex-col h-full transition-all duration-200 relative
                              ${isUnavailable ? 'opacity-60 cursor-not-allowed' : qty > 0 ? 'ring-2 ring-[#008d36] border-transparent shadow-sm' : 'border-gray-200 hover:border-[#008d36]'}`}
                          >
                            {/* "Limitado" badge for on-request items */}
                            {isOnRequest && !isUnavailable && (
                              <div className="absolute -top-3 left-3 bg-gray-900 text-white text-[10px] font-bold px-2 py-1 rounded flex items-center gap-1 uppercase">
                                Sob Consulta ℹ️
                              </div>
                            )}

                            {/* Header: icon + title + code tag */}
                             <div className="flex gap-3 mb-3 mt-1">
                              <div className={`w-12 h-12 shrink-0 flex items-center justify-center rounded-lg text-3xl bg-gray-50 border border-gray-100 ${isUnavailable ? 'opacity-40 grayscale' : ''}`}>
                                {eq.icon || '📦'}
                              </div>
                              <div className="flex flex-col flex-1 min-w-0">
                                <h4 className={`text-sm font-bold leading-tight mb-1 ${isUnavailable ? 'text-gray-400' : 'text-gray-900'}`}>
                                {eq.name}
                                </h4>
                                <span className="self-start text-[10px] font-black uppercase tracking-widest bg-gray-100 text-gray-500 px-2 py-0.5 rounded border border-gray-200">
                                  {eq.code}
                                </span>
                              </div>
                            </div>

                            {/* Description */}
                            {eq.description && (
                              <p className={`text-xs mb-3 line-clamp-3 ${isUnavailable ? 'text-gray-400' : 'text-gray-500'}`}>
                                {eq.description}
                              </p>
                            )}

                            {/* Price + Controls */}
                            <div className="mt-auto">
                              {loadingEquipment ? (
                                <div className="flex items-center gap-2 text-sm text-gray-400 mb-3">
                                  <div className="w-3 h-3 border-2 border-[#008d36] border-t-transparent rounded-full animate-spin" />
                                  Buscando preço...
                                </div>
                              ) : isUnavailable ? (
                                <span className="inline-block text-xs bg-red-50 text-red-500 font-bold px-3 py-1 rounded-full border border-red-200 mt-1">
                                  Indisponível
                                </span>
                              ) : (
                                <>
                                  {/* Price */}
                                  <div className="text-xl font-black text-gray-900 mb-4">
                                    R$ {priceBRL.toFixed(2).replace('.', ',')}
                                    <span className="text-xs font-normal text-gray-400 ml-1">/ total</span>
                                  </div>

                                  {/* Controls: +/- or Adicionar */}
                                  {eq.maxQty > 1 ? (
                                    <div className="flex items-center justify-between border border-gray-200 rounded-lg p-1">
                                      <button
                                        onClick={() => handleEquipmentQuantity(eq.code, -1, eq.maxQty)}
                                        disabled={qty === 0}
                                        className={`w-10 h-10 flex items-center justify-center rounded text-lg font-bold transition-colors
                                          ${qty > 0 ? 'bg-gray-100 text-gray-700 hover:bg-gray-200' : 'bg-gray-50 text-gray-300 cursor-not-allowed'}`}
                                      >−</button>
                                      <span className="font-black text-base text-gray-900">{qty}</span>
                                      <button
                                        onClick={() => handleEquipmentQuantity(eq.code, 1, eq.maxQty)}
                                        disabled={!canAdd || qty >= eq.maxQty}
                                        className={`w-10 h-10 flex items-center justify-center rounded text-lg font-bold transition-colors
                                          ${canAdd && qty < eq.maxQty ? 'border border-[#008d36] text-[#008d36] hover:bg-green-50' : 'bg-gray-50 text-gray-300 cursor-not-allowed'}`}
                                      >+</button>
                                    </div>
                                  ) : (
                                    <button
                                      onClick={() => qty > 0
                                        ? handleEquipmentQuantity(eq.code, -1, eq.maxQty)
                                        : handleEquipmentQuantity(eq.code, 1, eq.maxQty)
                                      }
                                      className={`w-full font-bold py-3 rounded-lg text-sm transition-all
                                        ${qty > 0
                                          ? 'bg-[#008d36] text-white hover:bg-[#007a2d]'
                                          : 'bg-[#ffcc00] hover:bg-[#e6b800] text-gray-900'
                                        }`}
                                    >
                                      {qty > 0 ? '✓ Selecionado — Remover' : 'Adicionar'}
                                    </button>
                                  )}
                                </>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* ETO: Skip protections button */}
                  {selectedTariffType === 'ETO' && (
                    <div className="text-center mt-6">
                      <button onClick={() => setProtectionsSkipped(true)} className="bg-[#e67e00] hover:bg-[#cc6f00] text-white font-black py-4 px-10 rounded-lg text-base uppercase tracking-wide shadow-lg transition-colors">Continuar sem proteções adicionais →</button>
                    </div>
                  )}
                </>
              )}
              </div> {/* close p-8 wrapper */}
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
