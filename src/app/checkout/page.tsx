"use client";

import { useState, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import LoginModal from "@/components/auth/LoginModal";

export default function CheckoutPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [booking, setBooking] = useState<any>(null);
  const [carCategoryOverrides, setCarCategoryOverrides] = useState<Record<string, string>>({});

  // Condutor
  const [nome, setNome] = useState("");
  const [sobrenome, setSobrenome] = useState("");
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState("");
  const [telefone, setTelefone] = useState("");
  const [cpf, setCpf] = useState("");
  const [loyaltyProgramId, setLoyaltyProgramId] = useState("");
  const [loyaltyProgramName, setLoyaltyProgramName] = useState("");
  const [loyaltyPrograms, setLoyaltyPrograms] = useState<any[]>([]);
  const [loyaltyId, setLoyaltyId] = useState("");
  const [flightNumber, setFlightNumber] = useState("");

  // Mascaras e Validações
  const maskPhone = (value: string) => {
    let r = value.replace(/\D/g, "");
    if (r.length > 13) r = r.substring(0, 13);

    // +55 (11) 99999-9999
    if (r.length > 11) {
      return `+${r.substring(0, 2)} (${r.substring(2, 4)}) ${r.substring(4, 9)}-${r.substring(9, 13)}`;
    } else if (r.length > 7) {
      return `+${r.substring(0, 2)} (${r.substring(2, 4)}) ${r.substring(4, 8)}-${r.substring(8, 12)}`;
    } else if (r.length > 4) {
      return `+${r.substring(0, 2)} (${r.substring(2, 4)}) ${r.substring(4)}`;
    } else if (r.length > 2) {
      return `+${r.substring(0, 2)} (${r.substring(2)}`;
    } else if (r.length > 0) {
      return `+${r}`;
    }
    return r;
  };

  const validateEmail = (email: string) => {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
  };

  // Pagamento
  const [paymentMethod, setPaymentMethod] = useState<"BALCAO" | "CREDIT" | "PIX" | "VOUCHER_ETO" | "VOUCHER_EXO">("BALCAO");
  const [ccName, setCcName] = useState("");
  const [ccNumber, setCcNumber] = useState("");
  const [ccValidity, setCcValidity] = useState("");
  const [ccCvv, setCcCvv] = useState("");

  const [threeDsReady, setThreeDsReady] = useState(false); // script MPI carregado
  const [threeDsAccessToken, setThreeDsAccessToken] = useState(""); // token Braspag MPI
  const [threeDsProcessing, setThreeDsProcessingState] = useState(false); // aguardando desafio/resposta do banco
  // Ref espelhando threeDsProcessing — os callbacks do bpmpi_config (montados uma vez, fora
  // do ciclo de render) precisam checar o valor ATUAL, não uma closure velha do state.
  const threeDsProcessingRef = useRef(false);
  const setThreeDsProcessing = (val: boolean) => { threeDsProcessingRef.current = val; setThreeDsProcessingState(val); };
  // MerchantOrderId gerado no cliente quando o método é CREDIT — precisa ser o MESMO
  // valor usado na autenticação 3DS (bpmpi_ordernumber) e depois na venda na Cielo,
  // senão o banco emissor pode recusar por inconsistência entre auth e cobrança.
  const [ccOrderNumber, setCcOrderNumber] = useState("");
  // Ref sempre atualizada com a função de submissão mais recente — necessária porque
  // window.bpmpi_config() é lida pelo script UMA vez no carregamento; os callbacks
  // precisam chamar a versão atual do handler (com o estado atual do formulário),
  // não a closure capturada no momento em que o script carregou.
  const submitReservationRef = useRef<(threeDsAuth?: any) => void>(() => { });
  // Ref direta pro campo oculto do access token — usada para escrever um token recém-buscado
  // no DOM na hora (síncrono), sem esperar o próximo render do React.
  const accessTokenInputRef = useRef<HTMLInputElement>(null);

  // Status
  const [loading, setLoading] = useState(false);
  const [pixQrCode, setPixQrCode] = useState<string | null>(null);
  const [resNumber, setResNumber] = useState<string | null>(null);
  const [accountCreated, setAccountCreated] = useState(false);
  const [merchantOrderId, setMerchantOrderId] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState(180);

  const [imgSrcIdx, setImgSrcIdx] = useState(0);
  const [extrasDetails, setExtrasDetails] = useState<any[]>([]);

  // ✅ standardQuote = preço cheio sem contractID (via getQuote); comparado com car price (já contratado)
  const [standardQuote, setStandardQuote] = useState<any>(null);
  const [loadingQuote, setLoadingQuote] = useState(false);

  // On Request state
  const [isOnRequest, setIsOnRequest] = useState(false);
  const [onRequestItems, setOnRequestItems] = useState<any[]>([]);

  // Terms & Conditions
  const [acceptTermsReserva, setAcceptTermsReserva] = useState(false);
  const [acceptTermsPais, setAcceptTermsPais] = useState(false);
  const [termsAvailable, setTermsAvailable] = useState<{ reserva: boolean, pais: boolean, paisUrl: string, brasil: boolean }>({ reserva: false, pais: false, paisUrl: '', brasil: false });


  useEffect(() => {
    const data = sessionStorage.getItem("europcar_booking");
    if (data) {
      const parsed = JSON.parse(data);
      setBooking(parsed);
      // ETO tariff: force payment method to CREDIT (no Balcão allowed)
      if (parsed.tariffType === 'ETO' && paymentMethod === 'BALCAO') {
        setPaymentMethod('CREDIT');
      }
      // Journey tracking — Step 4: Reached checkout
      try {
        const sessionId = sessionStorage.getItem("europcar_journey_session");
        if (sessionId) {
          fetch("/api/journey/track", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              sessionId,
              step: 4,
              userId: undefined, // will be set once session loads
            }),
          }).catch(() => { });
        }
      } catch { }
    }
  }, []);

  // Fetch loyalty programs for dropdown
  useEffect(() => {
    fetch('/api/loyalty-programs')
      .then(r => r.json())
      .then(data => setLoyaltyPrograms(Array.isArray(data) ? data : []))
      .catch(() => { });

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

  // Carrega o script Braspag MPI para autenticação 3DS 2.2.
  //
  // Contrato real do BP.Mpi.3ds20.min.js (confirmado no exemplo oficial da Braspag):
  // - window.bpmpi_config() precisa existir ANTES do script carregar e retorna os
  //   callbacks (onSuccess/onFailure/onUnenrolled/onDisabled/onError/onUnsupportedBrand)
  //   + Environment ("SDB"/"PRD") + Debug.
  // - A autenticação só roda quando window.bpmpi_authenticate() é chamada explicitamente
  //   (não há interceptação automática do submit do form).
  // - Os callbacks recebem os dados direto no objeto (e.Cavv, e.Xid, e.Eci, ...), sem
  //   CustomEvent/.detail — a versão anterior deste código escutava eventos que o script
  //   nunca dispara, por isso o 3DS nunca completava (nenhum alerta de confirmação surgia).
  useEffect(() => {
    if (paymentMethod !== 'CREDIT') return;

    const scriptId = 'braspag-mpi-3ds';
    if (document.getElementById(scriptId)) { setThreeDsReady(true); return; }

    // MerchantOrderId gerado uma única vez ao entrar no modo CREDIT — precisa estar
    // pronto bem antes do clique em "Finalizar", pois é lido do DOM (bpmpi_ordernumber)
    // no momento da autenticação, e reaproveitado depois na cobrança real na Cielo.
    setCcOrderNumber(prev => prev || ('ORD' + Date.now()));

    let cancelled = false;

    // IMPORTANTE: busca o Access Token e a config admin ANTES de anexar o <script>.
    // O script roda uma checagem própria assim que carrega (antes de qualquer clique do
    // usuário) e já lê o campo oculto bpmpi_accesstoken nesse momento — se as duas buscas
    // rodassem em paralelo com o script sendo anexado assim que a config (mais rápida)
    // resolvesse, o script podia começar a rodar com o token AINDA vazio (a busca do token
    // depende de uma chamada externa à Braspag, mais lenta), causando 401 imediato ao
    // carregar a página, antes mesmo do formulário ser preenchido.
    (async () => {
      try {
        const [tokenRes, configRes] = await Promise.all([
          fetch('/api/cielo/get3dsToken', { method: 'POST' }),
          fetch('/api/admin/config/cielo'),
        ]);
        const tokenData = await tokenRes.json();
        const configData = await configRes.json();
        if (cancelled) return;

        if (tokenData.accessToken) {
          setThreeDsAccessToken(tokenData.accessToken);
          // Grava direto no DOM — garante que o valor já está lá quando o script
          // carregar, sem depender do próximo ciclo de render do React.
          if (accessTokenInputRef.current) accessTokenInputRef.current.value = tokenData.accessToken;
        } else {
          console.warn('[3DS] Sem access token:', tokenData.error);
        }

        const isSandboxEnv = configData.isSandbox !== false;

        // window.bpmpi_config() precisa existir antes do <script> executar — é lida pelo
        // próprio script no carregamento. Os callbacks disparam a submissão real via ref
        // (sempre aponta para a versão mais atual de submitReservation, com o estado
        // corrente do formulário — o config em si só é montado uma vez).
        (window as any).bpmpi_config = function () {
          return {
            onReady: function () {
              setThreeDsReady(true);
              console.log('[3DS] Script MPI pronto.');
            },
            onSuccess: function (e: any) {
              setThreeDsProcessing(false);
              console.log('[3DS] Autenticado com sucesso! ECI:', e?.Eci);
              submitReservationRef.current({
                cavv: e?.Cavv || '', xid: e?.Xid || '', eci: e?.Eci || '',
                version: e?.Version || '2', referenceId: e?.ReferenceId || '',
              });
            },
            onFailure: function (e: any) {
              setThreeDsProcessing(false);
              console.warn('[3DS] Autenticação falhou — prosseguindo sem Liability Shift:', e);
              submitReservationRef.current(undefined);
            },
            onUnenrolled: function (e: any) {
              setThreeDsProcessing(false);
              console.warn('[3DS] Cartão não elegível para 3DS — prosseguindo sem Liability Shift:', e);
              submitReservationRef.current(undefined);
            },
            onDisabled: function () {
              setThreeDsProcessing(false);
              console.warn('[3DS] Autenticação desabilitada (bpmpi_auth=false) — prosseguindo sem 3DS.');
              submitReservationRef.current(undefined);
            },
            // onError/onUnsupportedBrand: o script pode disparar isso na checagem interna
            // de carregamento, antes do usuário sequer clicar em "Finalizar" — só mostra o
            // alerta bloqueante quando o erro acontece DURANTE uma tentativa real (usuário
            // já clicou e threeDsProcessingRef está true); fora disso, só loga no console.
            onError: function (e: any) {
              const wasUserInitiated = threeDsProcessingRef.current;
              setThreeDsProcessing(false);
              console.error('[3DS] Erro sistêmico na autenticação:', e);
              if (wasUserInitiated) {
                alert('Não foi possível validar o cartão com o banco (erro no sistema de segurança 3DS). Tente novamente em instantes.\n\n' + (e?.ReturnMessage || ''));
                setLoading(false);
              }
            },
            onUnsupportedBrand: function (e: any) {
              const wasUserInitiated = threeDsProcessingRef.current;
              setThreeDsProcessing(false);
              console.error('[3DS] Bandeira não suportada pelo 3DS:', e);
              if (wasUserInitiated) {
                alert('A bandeira deste cartão não é suportada pela autenticação 3DS.\n\n' + (e?.ReturnMessage || ''));
                setLoading(false);
              }
            },
            Environment: isSandboxEnv ? 'SDB' : 'PRD',
            Debug: true,
          };
        };

        const script = document.createElement('script');
        script.id = scriptId;
        script.src = isSandboxEnv
          ? 'https://mpisandbox.braspag.com.br/Scripts/BP.Mpi.3ds20.min.js'
          : 'https://mpi.braspag.com.br/Scripts/BP.Mpi.3ds20.min.js';
        script.async = true;
        document.head.appendChild(script);
      } catch (err: any) {
        console.warn('[3DS] Falha ao preparar autenticação 3DS:', err.message);
      }
    })();

    return () => { cancelled = true; };
  }, [paymentMethod]);


  // Fetch available terms documents
  useEffect(() => {
    fetch('/api/admin/terms')
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) {
          const paisDoc = data.find((d: any) => d.type === 'PAIS');
          setTermsAvailable({
            reserva: data.some((d: any) => d.type === 'RESERVA'),
            pais: !!paisDoc,
            paisUrl: paisDoc?.mimeType === 'text/uri-list' ? paisDoc.fileName : '/api/terms/pais',
            brasil: data.some((d: any) => d.type === 'BRASIL_ONLINE'),
          });
        }
      })
      .catch(() => { });
  }, []);

  // When booking loads, resolve selected extras from xrsInsurances (real getQuote data)
  useEffect(() => {
    if (!booking) return;
    const extrasMap: Record<string, number> = booking.extras || {};
    const selectedCodes = Object.keys(extrasMap).filter(k => extrasMap[k] > 0);
    if (selectedCodes.length === 0) { setExtrasDetails([]); return; }

    // xrsInsurances now has { code, name, price, priceBRL } from getQuote
    const xrsIns: any[] = booking.xrsInsurances || [];
    // Fallback: optionalInsurances from booking.car (old format)
    const allInsurances: any[] = booking.car?.optionalInsurances || [];
    const resolved = selectedCodes.map(code => {
      const qi = xrsIns.find((i: any) => i.code === code);
      const ins = allInsurances.find((i: any) => i.code === code);
      const priceBRL = qi?.priceBRL || parseFloat(ins?.priceInBookingCurrency || ins?.price || "0");
      return {
        id: code,
        name: qi?.name || code,
        pricePerDay: priceBRL, // total price (rentalPriceInBookingCurrencyAI is already total)
        pricePerDayEUR: qi?.price || parseFloat(ins?.price || "0"),
        qty: extrasMap[code],
        isTotal: !!qi, // if from quoteInsurances, priceBRL is already total (not per day)
        ins: ins || qi,
      };
    }).filter(Boolean);
    setExtrasDetails(resolved);
  }, [booking]);

  // ETO CIDs have their own separate flow — no price-comparison getQuote
  const ETO_CIDS = ['56935466', '56935495'];

  // Tariff type from booking (POA or ETO)
  const tariffType: string = booking?.tariffType || 'POA';
  const stationCountry: string = booking?.stationCountry || '';

  // ✅ Buscar preço SEM contrato via getQuote para calcular economia real
  // O preço COM contrato já está em booking.car (veio do getMultipleRates com contractID)
  useEffect(() => {
    if (!booking) return;
    const contractID = booking.contractID;
    if (!contractID) return;
    if (ETO_CIDS.includes(contractID)) return; // ETO flow has its own getQuote — skip CC comparison

    const fetchStandardPrice = async () => {
      setLoadingQuote(true);
      try {
        const res = await fetch("/api/europcar/getQuote", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            carCategory: booking.car?.carCategoryCode,
            pickupStation: booking.pickupStation,
            returnStation: booking.returnStation || booking.pickupStation,
            pickupDate: booking.pickupDate,
            returnDate: booking.returnDate,
            pickupTime: booking.pickupTime || "1000",
            returnTime: booking.returnTime || "1000",
            // ⚠️ SEM contractID → retorna preço de tabela (sem desconto)
          }),
        });
        const data = await res.json();

        // xml2js com explicitArray:false → atributos XML ficam em $
        // Estrutura: data.message.serviceResponse.reservation.$
        const resNode = data?.message?.serviceResponse?.reservation;
        const attrs = resNode?.$ ?? resNode ?? null;

        console.log("[checkout] getQuote SEM contrato - attrs:", JSON.stringify(attrs)?.slice(0, 300));

        if (attrs?.totalRateEstimate) {
          setStandardQuote(attrs);
        } else {
          console.warn("[checkout] getQuote não retornou totalRateEstimate. Estrutura:", JSON.stringify(data)?.slice(0, 500));
        }
      } catch (e) {
        console.error("[checkout] Falha ao buscar preço padrão:", e);
      } finally {
        setLoadingQuote(false);
      }
    };

    fetchStandardPrice();
  }, [booking]);

  // --- Auto-fill when logged in (login still optional) ---
  const [showLogin, setShowLogin] = useState(false);

  useEffect(() => {
    if (status === "authenticated" && session?.user?.email) {
      // Fetch full profile to get phone, city, cpf
      fetch("/api/auth/me")
        .then(r => r.json())
        .then(user => {
          if (user.name) {
            const parts = user.name.split(" ");
            setNome(parts[0]);
            if (parts.length > 1) setSobrenome(parts.slice(1).join(" "));
          }
          if (user.email) setEmail(user.email);
          if (user.phone) setTelefone(user.phone);
          if (user.cpf) setCpf(user.cpf);
        })
        .catch(console.error);
    }
  }, [status, session]);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (merchantOrderId && !resNumber && paymentMethod === "PIX") {
      timer = setInterval(() => {
        setTimeLeft(prev => {
          const t = prev - 1;
          if (t <= 0) clearInterval(timer);
          if (t % 5 === 0 && t > 0) {
            fetch(`/api/reservas/pix-status?orderId=${merchantOrderId}`)
              .then(r => r.json())
              .then(d => {
                if (d.status === "PAID" && d.resNumber) {
                  setResNumber(d.resNumber);
                  // Journey tracking — Step 5: PIX payment confirmed
                  try {
                    const sessionId = sessionStorage.getItem("europcar_journey_session");
                    if (sessionId) {
                      fetch("/api/journey/track", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ sessionId, step: 5, resNumber: d.resNumber, paymentMethod: "PIX", status: "COMPLETED" }),
                      }).catch(() => { });
                      sessionStorage.removeItem("europcar_journey_session");
                    }
                  } catch { }
                }
              })
              .catch(() => { });
          }
          return t;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [merchantOrderId, resNumber, paymentMethod]);

  // Allow rendering even when session is still loading — guests don't need a session
  // Only show loading spinner if status===loading AND we haven't loaded the booking data yet
  // (prevents flash for logged-in users whose data auto-fills)

  if (!booking) return (
    <div className="min-h-screen bg-[#f7f7f7] flex items-center justify-center">
      <p className="font-bold text-gray-600">Carregando reserva... Se não aparecer, volte e selecione um veículo.</p>
    </div>
  );

  // --- Extract values from XRS car object ---
  const car = booking.car || {};
  const carCode = car.carCategoryCode || "";
  const carName = car.carCategorySample || carCategoryOverrides[carCode] || car.carCategoryName || car.name || "Veículo não identificado";
  const carCategoryDesc = car.carCategoryName || "";
  const carSample = car.carCategorySample || "";
  const currency = car.currency || "EUR";


  // Pickup/return info
  const pickupStation = booking.pickupStation || car.pickupLoc || "";
  const returnStation = booking.returnStation || booking.pickupStation || "";
  const pickupDate = booking.pickupDate || "";
  const returnDate = booking.returnDate || "";
  const driverCountry = booking.driverCountry || "BR";
  const driverCountryName = booking.driverCountryName || "Brasil";
  const formatDate = (d: string) => d?.length === 8 ? `${d.slice(6, 8)}/${d.slice(4, 6)}/${d.slice(0, 4)}` : d;

  // --- Calculate prices ---
  const contractID = booking?.contractID || "";
  const bookingCurrency = car.bookingCurrencyOfTotalRateEstimate || "";

  // ✅ Preço do carro JÁ É o preço contratado (veio de getMultipleRates com contractID)
  const totalRateXRS = parseFloat(car.totalRateEstimate || car.total || 0);
  const totalBRL = parseFloat(car.totalRateEstimateInBookingCurrency || 0);

  // Preço de tabela SEM contrato (do getQuote chamado sem contractID)
  const standardTotalXRS = standardQuote
    ? parseFloat(standardQuote.totalRateEstimate || standardQuote.totalRate || 0)
    : 0;
  const standardTotalBRL = standardQuote
    ? parseFloat(standardQuote.totalRateEstimateInBookingCurrency || standardQuote.totalRateInBookingCurrency || 0)
    : 0;

  // Economia = preço cheio (standardQuote) − preço contratado (car)
  const discountXRS = standardTotalXRS > 0 && totalRateXRS > 0 ? standardTotalXRS - totalRateXRS : 0;
  const discountBRL = standardTotalBRL > 0 && totalBRL > 0 ? standardTotalBRL - totalBRL : 0;
  const hasContract = contractID !== "";  // tag aparece SEMPRE quando há contrato
  const hasDiscountValue = discountXRS > 0.01; // valor exato só quando getQuote funcionou






  // Calculate days
  const calcDays = () => {
    if (pickupDate?.length === 8 && returnDate?.length === 8) {
      const co = new Date(parseInt(pickupDate.slice(0, 4)), parseInt(pickupDate.slice(4, 6)) - 1, parseInt(pickupDate.slice(6, 8)));
      const ci = new Date(parseInt(returnDate.slice(0, 4)), parseInt(returnDate.slice(4, 6)) - 1, parseInt(returnDate.slice(6, 8)));
      const diff = Math.round((ci.getTime() - co.getTime()) / 86400000);
      return diff > 0 ? diff : 1;
    }
    return 1;
  };
  const days = calcDays();

  // Build car image URL
  const carImgUrl = car.imageUrl
    || (carCode ? `https://static.europcar.com/carvisuals/partners/835x557/${carCode}_IT.png` : "")
    || `https://placehold.co/400x200/f5f5f5/008d36?text=${carCode || "CAR"}`;

  // ── Valor a cobrar online — EXCLUSIVAMENTE via payerList do XRS ──────────────
  // O XRS retorna payerList quando chargesDetail="TRE" está ativo:
  //   driverDueBRL  → cobrado AGORA via Cielo (tarifa do motorista)
  //   businessDueBRL → faturado separado para conta corporativa (NÃO vai para a Cielo)
  // Não há fallback — o checkout exige que este dado esteja disponível.
  const payerSplit = booking?.payerSplit ?? null;

  // Sobretaxa de aeroporto exibida na UI — vem dos quoteInsurances (apenas para display)
  const airportSurchargeBRL = (() => {
    const fees = (booking?.quoteInsurances || []).filter((i: any) => {
      const d = (i.descr || '').toLowerCase();
      return d.includes('aeroporto') || d.includes('airport') ||
        d.includes('ferroviária') || d.includes('railway') ||
        d === 'sobretaxa de aeroporto/estação ferroviária';
    });
    return fees.reduce((sum: number, ins: any) => {
      const val = ins.rentalPriceInBookingCurrencyAI > 0
        ? ins.rentalPriceInBookingCurrencyAI
        : (ins.priceInBookingCurrency > 0 ? ins.priceInBookingCurrency : ins.price);
      return sum + (parseFloat(val) || 0);
    }, 0);
  })();

  // VALOR REAL A COBRAR: driverDueBRL do payerList (obrigatório)
  const amountInCents = payerSplit ? Math.round(payerSplit.driverDueBRL * 100) : 0;

  // Envia a reserva de fato para o backend. threeDsAuth vem preenchido quando o
  // callback onSuccess do BP.Mpi trouxe CAVV/ECI; undefined nos demais casos
  // (falha, não elegível, desabilitado) — a cobrança segue sem Liability Shift.
  const submitReservation = async (threeDsAuth?: { cavv: string; xid: string; eci: string; version: string; referenceId: string }) => {
    try {
      const res = await fetch("/api/reservas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookingData: booking,
          customerData: { nome, sobrenome, email, telefone, cpf, loyaltyProgramId, loyaltyProgramName, loyaltyId, flightNumber },
          paymentData: {
            method: paymentMethod,
            amountInCents,
            // Reaproveita o mesmo MerchantOrderId autenticado no 3DS — evita
            // inconsistência entre a autenticação e a cobrança na Cielo.
            merchantOrderId: paymentMethod === "CREDIT" ? ccOrderNumber : undefined,
            creditCard: paymentMethod === "CREDIT" ? {
              name: ccName,
              number: ccNumber,
              validity: ccValidity,
              cvv: ccCvv,
              threeDsAuth,
            } : undefined,
          },
          xrsEquipment: booking?.xrsEquipment || [],
          xrsInsurances: booking?.xrsInsurances || [],
          voucherData: undefined,
        }),
      });
      const json = await res.json();
      if (res.ok) {
        if (paymentMethod === "PIX" && json.pixData) {
          setPixQrCode(json.pixData.qrCodeString);
          setMerchantOrderId(json.merchantOrderId);
        } else if (json.onRequest) {
          setIsOnRequest(true);
          setOnRequestItems(json.onRequestItems || []);
          setResNumber(json.resNumber);
          if (json.accountCreated) setAccountCreated(true);
          // Journey tracking — Step 5: Reservation completed (on-request)
          try {
            const sessionId = sessionStorage.getItem("europcar_journey_session");
            if (sessionId) {
              fetch("/api/journey/track", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ sessionId, step: 5, resNumber: json.resNumber, paymentMethod, status: "COMPLETED", userId: session?.user?.email || undefined }),
              }).catch(() => { });
              sessionStorage.removeItem("europcar_journey_session");
            }
          } catch { }
        } else {
          setResNumber(json.resNumber);
          if (json.accountCreated) setAccountCreated(true);
          // Journey tracking — Step 5: Reservation completed (credit/balcão)
          try {
            const sessionId = sessionStorage.getItem("europcar_journey_session");
            if (sessionId) {
              fetch("/api/journey/track", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ sessionId, step: 5, resNumber: json.resNumber, paymentMethod, status: "COMPLETED", userId: session?.user?.email || undefined }),
              }).catch(() => { });
              sessionStorage.removeItem("europcar_journey_session");
            }
          } catch { }
        }
      } else {
        alert("Erro ao finalizar reserva: " + (json.error || "Desconhecido"));
      }
    } catch {
      alert("Falha de conexão.");
    } finally {
      setLoading(false);
    }
  };

  // Ref sempre com a versão mais atual de submitReservation — os callbacks do BP.Mpi
  // (montados uma vez em window.bpmpi_config) chamam submitReservationRef.current(...).
  // Atribuição direta (não useEffect): este ponto do componente fica DEPOIS de vários
  // "return" condicionais acima (status==="loading", !booking, ...) — um useEffect aqui
  // violaria a ordem de hooks entre renders (React error #310) porque nem sempre seria
  // alcançado. Atribuição de ref durante o render é segura e não tem essa restrição.
  submitReservationRef.current = submitReservation;

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!booking) return;
    if (!validateEmail(email)) {
      setEmailError("Por favor, insira um e-mail válido.");
      return;
    }
    setEmailError("");
    setLoading(true);

    // Cartão de crédito precisa autenticar 3DS ANTES de cobrar — a submissão real
    // acontece dentro dos callbacks do BP.Mpi (onSuccess/onFailure/onUnenrolled/...),
    // chamados via submitReservationRef depois que window.bpmpi_authenticate() resolver.
    if (paymentMethod === "CREDIT") {
      if (!threeDsReady || typeof (window as any).bpmpi_authenticate !== 'function') {
        alert("O sistema de segurança 3DS ainda está carregando. Aguarde alguns segundos e tente novamente.");
        setLoading(false);
        return;
      }

      // Busca um Access Token 3DS FRESCO agora — o token buscado ao entrar no modo Cartão
      // pode ter expirado enquanto o cliente preenchia o resto do formulário, causando 401
      // em mpi.braspag.com.br/v2/3ds/init. Escreve direto no DOM (ref) para o script ler o
      // valor correto imediatamente, sem esperar o próximo render do React.
      try {
        const tokenRes = await fetch('/api/cielo/get3dsToken', { method: 'POST' });
        const tokenData = await tokenRes.json();
        if (!tokenData.accessToken) {
          alert("Não foi possível iniciar a autenticação 3DS: " + (tokenData.error || "token indisponível") + ". Tente novamente.");
          setLoading(false);
          return;
        }
        setThreeDsAccessToken(tokenData.accessToken);
        if (accessTokenInputRef.current) accessTokenInputRef.current.value = tokenData.accessToken;
      } catch {
        alert("Falha ao preparar a autenticação 3DS. Verifique sua conexão e tente novamente.");
        setLoading(false);
        return;
      }

      setThreeDsProcessing(true);
      (window as any).bpmpi_authenticate();
      return;
    }

    // PIX / BALCÃO / VOUCHER não passam por 3DS — envia direto.
    await submitReservation();
  };

  // ---- On Request confirmation screen ----
  if (resNumber && isOnRequest) {
    return (
      <div className="min-h-screen bg-[#f7f7f7] flex flex-col items-center justify-center p-4 gap-6">
        <div className="bg-[#008d36] px-6 py-3 rounded-md shadow-md">
          <img src="/logo.jpg" alt="Europcar" className="h-10 object-contain" />
        </div>
        <div className="bg-white p-10 rounded-lg shadow-xl max-w-lg w-full text-center border-t-8 border-yellow-400">
          <div className="w-20 h-20 bg-yellow-100 text-yellow-600 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h1 className="text-2xl font-black text-gray-900 mb-2">Reserva em Análise</h1>
          <p className="text-gray-600 mb-4 text-sm">
            Um ou mais itens da sua reserva precisam de confirmação pela estação. A Europcar entrará em contato em até <strong>8 horas úteis</strong>.
          </p>
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 mb-6">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-widest block mb-1">Código de Reserva</span>
            <span className="text-3xl font-black text-[#008d36] tracking-widest">{resNumber}</span>
            <span className="block mt-2 text-xs text-yellow-700 font-bold bg-yellow-50 border border-yellow-200 rounded px-2 py-1">
              Status: Aguardando Confirmação (On Request)
            </span>
          </div>
          {onRequestItems.length > 0 && (
            <div className="text-left mb-6">
              <p className="text-xs font-bold text-gray-500 uppercase mb-2">Itens aguardando aprovação:</p>
              <ul className="space-y-1">
                {onRequestItems.map((item: any, i: number) => (
                  <li key={i} className="text-sm text-gray-700 flex items-center gap-2">
                    <span className="w-2 h-2 bg-yellow-400 rounded-full inline-block" />
                    {item.description || item.code || JSON.stringify(item)}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <p className="text-xs text-gray-400 mb-6">
            Guarde o código acima. Se a solicitação não for confirmada, a reserva será cancelada automaticamente e você será contatado para alternativas.
          </p>
          <button onClick={() => window.location.href = "/"} className="font-bold text-[#008d36] hover:underline">
            Voltar para o início
          </button>
        </div>
      </div>
    );
  }

  // ---- Confirmation screen ----
  if (resNumber) {
    return (
      <div className="min-h-screen bg-[#f7f7f7] flex flex-col items-center justify-center p-4 gap-6">
        {/* Logo */}
        <div className="bg-[#008d36] px-6 py-3 rounded-md shadow-md">
          <img src="/logo.jpg" alt="Europcar" className="h-10 object-contain" />
        </div>

        <div className="bg-white p-10 rounded-lg shadow-xl max-w-lg w-full text-center border-t-8 border-[#008d36]">
          <div className="w-20 h-20 bg-green-100 text-[#008d36] rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>
          </div>
          <h1 className="text-3xl font-black text-gray-900 mb-2">Reserva Confirmada!</h1>
          <p className="text-gray-600 mb-8">Anote seu código de reserva para apresentar no balcão.</p>
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 mb-8">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-widest block mb-1">Código de Reserva</span>
            <span className="text-4xl font-black text-[#008d36] tracking-widest">{resNumber}</span>
          </div>

          {/* Account creation notice */}
          {accountCreated && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 text-left">
              <p className="text-blue-800 font-bold text-sm mb-1">🎉 Conta criada automaticamente!</p>
              <p className="text-blue-700 text-sm">
                Enviamos um e-mail para <strong>{email}</strong> com seu login e senha temporária.
                Use-os para acessar suas reservas em qualquer momento.
              </p>
            </div>
          )}

          <button onClick={() => window.location.href = "/"} className="font-bold text-[#008d36] hover:underline">Voltar para o início</button>
        </div>
      </div>
    );
  }

  // ---- PIX QR screen ----
  if (merchantOrderId && !resNumber && paymentMethod === "PIX") {
    const minutes = Math.floor(Math.max(0, timeLeft) / 60);
    const seconds = Math.max(0, timeLeft) % 60;

    // Compute total for summary
    const extrasSumBRL = extrasDetails.reduce((s: number, e: any) => s + e.pricePerDay * e.qty, 0) * days;
    const equipSumBRL = (booking?.xrsEquipment || []).reduce((s: number, eq: any) => {
      const p = parseFloat(eq.priceBRL || 0);
      return s + p * (eq.qty || 1) * days;
    }, 0);
    const baseBRL = payerSplit ? payerSplit.driverDueBRL : (totalBRL > 0 ? totalBRL : totalRateXRS);
    // Proteções e acessórios são pagos na loja de destino — o valor cobrado
    // agora (amountInCents) é só o driverDueBRL do payerList XRS.
    const extrasAndEquipTotal = extrasSumBRL + equipSumBRL;

    // Bloqueia o checkout se payerSplit não estiver disponível
    if (!payerSplit) {
      return (
        <div className="min-h-screen bg-[#f7f7f7] flex flex-col items-center justify-center p-6">
          <div className="bg-white rounded-xl shadow-md p-8 max-w-md text-center">
            <div className="text-4xl mb-4">⚠️</div>
            <h2 className="text-xl font-bold text-gray-800 mb-2">Dados de pagamento incompletos</h2>
            <p className="text-gray-600 text-sm mb-6">
              Não foi possível calcular o valor exato da sua reserva. Por favor, volte e selecione o veículo novamente.
            </p>
            <a href="/" className="inline-block bg-[#008d36] text-white font-bold px-6 py-3 rounded-lg hover:bg-[#007a2f] transition">
              Voltar à busca
            </a>
          </div>
        </div>
      );
    }

    const insNames: Record<string, string> = {
      TPL: "Resp. Civil (TPL)", LDW: "Danos e Roubo (LDW)",
      CDW: "Colisão (CDW)", THW: "Roubo (THW)",
      SCDW: "Super CDW", SPCDW: "Super CDW Premium",
      STHW: "Super THW", SPTHW: "Super THW Premium",
      MEDIUM: "Cobertura Média", PREMIUM: "Cobertura Premium",
      PREMPRE: "Premium Pré-pago", PREMUP: "Upgrade Premium",
      RSA: "Assistência 24h", APP: "Proteção Aparência",
      PAI: "Acidentes Pessoais", PEP: "Efeitos Pessoais",
    };

    return (
      <div className="min-h-screen bg-[#f7f7f7] flex flex-col items-center justify-center p-6 gap-6">
        {/* Logo */}
        <div className="bg-[#008d36] px-6 py-3 rounded-md shadow-md">
          <img src="/logo.jpg" alt="Europcar" className="h-10 object-contain" />
        </div>

        {/* Card — two columns on md+ */}
        <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl overflow-hidden border-t-8 border-[#1b75bb]">
          <div className="flex flex-col md:flex-row">

            {/* Left — QR Code */}
            <div className="flex-1 flex flex-col items-center justify-center p-10 border-b md:border-b-0 md:border-r border-gray-100">
              <h1 className="text-2xl font-black text-gray-900 mb-1">Pague via PIX</h1>
              <p className="text-xs text-gray-500 mb-6 text-center">
                Pedido <strong className="text-gray-700">{merchantOrderId}</strong>.<br />Escaneie o QR Code para confirmar.
              </p>

              <div className="bg-gray-50 rounded-lg p-4 mb-5">
                {timeLeft > 0 ? (
                  <>
                    {pixQrCode ? (
                      <img
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(pixQrCode)}`}
                        alt="QR Code PIX"
                        className="w-48 h-48 mx-auto"
                      />
                    ) : (
                      <div className="w-48 h-48 bg-gray-200 animate-pulse flex items-center justify-center text-xs text-gray-500">Gerando...</div>
                    )}
                  </>
                ) : (
                  <div className="w-48 h-48 flex flex-col items-center justify-center text-red-500">
                    <span className="font-bold text-lg">QR Code Expirado</span>
                    <span className="text-xs text-gray-500 mt-1">Refaça a reserva.</span>
                  </div>
                )}
              </div>

              {/* Countdown */}
              {timeLeft > 0 && (
                <div className="flex items-center gap-2 text-[#1b75bb] mb-6">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-xl font-black tabular-nums">
                    {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
                  </span>
                  <span className="text-xs text-gray-400">para expirar</span>
                </div>
              )}

              <button
                onClick={() => window.location.href = "/"}
                className="w-full bg-[#ffcc00] hover:bg-[#e6b800] text-gray-900 font-bold py-3 rounded text-sm transition-colors"
              >
                Já paguei / Voltar
              </button>
            </div>

            {/* Right — Booking Summary */}
            <div className="w-full md:w-[280px] shrink-0 bg-gray-50 p-8 flex flex-col gap-4">
              <h2 className="text-xs font-black text-gray-500 uppercase tracking-widest border-b border-gray-200 pb-3">
                Resumo do Pagamento
              </h2>

              {/* Vehicle */}
              <div className="flex flex-col gap-0.5">
                <span className="text-[10px] font-bold text-[#008d36] uppercase tracking-wider">Veículo</span>
                <span className="font-black text-gray-900 text-sm uppercase leading-tight">{carName}</span>
                {carCategoryDesc && <span className="text-xs text-gray-400">{carCategoryDesc}</span>}
                {carCode && (
                  <span className="text-[10px] bg-gray-200 text-gray-600 font-bold px-2 py-0.5 rounded-full w-fit mt-0.5">{carCode}</span>
                )}
              </div>

              {/* Locations */}
              <div className="flex flex-col gap-1 border-t border-gray-200 pt-3">
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500 font-bold">Retirada</span>
                  <span className="font-black text-gray-900 text-right">
                    {pickupStation}<br />
                    <span className="font-normal text-gray-500">{formatDate(pickupDate)}</span>
                  </span>
                </div>
                <div className="flex justify-between text-xs mt-1">
                  <span className="text-gray-500 font-bold">Devolução</span>
                  <span className="font-black text-gray-900 text-right">
                    {returnStation || pickupStation}<br />
                    <span className="font-normal text-gray-500">{formatDate(returnDate)}</span>
                  </span>
                </div>
                <div className="flex justify-between text-xs mt-1">
                  <span className="text-gray-500 font-bold">Duração</span>
                  <span className="font-black text-gray-900">{days} {days === 1 ? "dia" : "dias"}</span>
                </div>
              </div>

              {/* Price breakdown */}
              <div className="flex flex-col gap-1 border-t border-gray-200 pt-3 text-xs">
                <div className="flex justify-between">
                  <span className="text-gray-500">Aluguel ({currency})</span>
                  <span className="font-bold text-gray-900">{currency} {totalRateXRS.toFixed(2).replace(".", ",")}</span>
                </div>
                {totalBRL > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Em BRL</span>
                    <span className="font-bold text-gray-900">R$ {totalBRL.toFixed(2).replace(".", ",")}</span>
                  </div>
                )}

                {/* Extras */}
                {extrasDetails.length > 0 && (
                  <>
                    <div className="text-[10px] font-bold text-[#008d36] uppercase mt-2 mb-1">Proteções adicionadas</div>
                    {extrasDetails.map((extra: any) => (
                      <div key={extra.id} className="flex justify-between">
                        <span className="text-gray-500">{insNames[extra.id] || extra.id}</span>
                        <span className="font-bold text-gray-900">
                          R$ {(extra.pricePerDay * extra.qty * days).toFixed(2).replace(".", ",")}
                        </span>
                      </div>
                    ))}
                  </>
                )}

                {/* XRS Equipment / Accessories */}
                {booking?.xrsEquipment?.length > 0 && (
                  <>
                    <div className="text-[10px] font-bold text-[#e67e00] uppercase mt-2 mb-1">Acessórios</div>
                    <div className="text-[9px] text-gray-400 mb-1 leading-tight">Pagamento na loja de destino.</div>
                    {booking.xrsEquipment.map((eq: any) => {
                      const eqName = eq.name || eq.code;
                      const eqIcon = eq.icon || '📦';
                      const eqPriceBRL = parseFloat(eq.priceBRL || 0);
                      const eqPriceEUR = parseFloat(eq.price || 0);
                      const eqCurrency = eq.currency || 'EUR';
                      const eqTotal = eqPriceBRL > 0 ? eqPriceBRL * eq.qty * days : eqPriceEUR * eq.qty * days;
                      return (
                        <div key={eq.code} className="flex justify-between items-center">
                          <span className="text-gray-500">{eqIcon} {eqName} ×{eq.qty}</span>
                          <span className="font-bold text-gray-900">
                            {eqPriceBRL > 0
                              ? `R$ ${eqTotal.toFixed(2).replace(".", ",")}`
                              : `${eqCurrency} ${eqTotal.toFixed(2)}`
                            }
                          </span>
                        </div>
                      );
                    })}
                  </>
                )}
              </div>

              {/* Grand total */}
              <div className="bg-[#008d36] rounded-lg p-4 mt-auto">
                <div className="text-[10px] font-bold text-green-200 uppercase mb-1">Total a pagar (PIX)</div>
                <div className="text-2xl font-black text-white">
                  R$ {baseBRL.toFixed(2).replace(".", ",")}
                </div>
                <div className="text-[10px] text-green-200 mt-0.5">Taxas e impostos incluídos</div>
                {extrasAndEquipTotal > 0 && (
                  <div className="text-[10px] text-green-100 mt-1 pt-1 border-t border-white/20">
                    + R$ {extrasAndEquipTotal.toFixed(2).replace(".", ",")} em proteções/acessórios, pago na loja de destino
                  </div>
                )}
              </div>
            </div>

          </div>
        </div>
      </div>
    );
  }


  // ---- Main checkout ----
  return (
    <div className="min-h-screen bg-[#f7f7f7] font-sans pb-20">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 h-14 md:h-20 flex justify-between items-center text-sm font-bold text-gray-900">
          <button onClick={() => window.history.back()} className="flex items-center gap-2 hover:text-[#008d36]">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" /></svg>
            Voltar
          </button>
          <img src="/logo.jpg" alt="Europcar" className="h-10 object-contain" />
          <div className="flex items-center gap-2">PAGAMENTO 🔒</div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-6 md:py-10 flex flex-col-reverse md:flex-row gap-6 md:gap-8">
        {/* Form */}
        <div className="flex-1">
          <form onSubmit={handleCheckout} className="space-y-8">
            {/* Dados condutor */}
            <div className="bg-white rounded-lg border border-gray-200 p-5 md:p-8 shadow-sm">
              <h2 className="text-lg md:text-xl font-black text-gray-900 mb-4 md:mb-6">1. Dados do Condutor Principal</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Nome</label>
                  <input required value={nome} onChange={e => setNome(e.target.value)} className="w-full border rounded p-3 outline-none focus:border-[#008d36]" placeholder="João" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Sobrenome</label>
                  <input required value={sobrenome} onChange={e => setSobrenome(e.target.value)} className="w-full border rounded p-3 outline-none focus:border-[#008d36]" placeholder="Silva" />
                </div>
              </div>
              <div className="mb-4">
                <label className="block text-xs font-bold text-gray-700 mb-1">E-mail</label>
                <input
                  required
                  type="email"
                  value={email}
                  onChange={e => {
                    setEmail(e.target.value);
                    if (emailError) setEmailError("");
                  }}
                  onBlur={() => {
                    if (email && !validateEmail(email)) setEmailError("E-mail inválido");
                  }}
                  className={`w-full border rounded p-3 outline-none focus:border-[#008d36] ${emailError ? 'border-red-500' : ''}`}
                  placeholder="exemplo@email.com"
                />
                {emailError && <span className="text-red-500 text-[10px] font-bold mt-1">{emailError}</span>}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Telefone / Celular</label>
                  <input
                    required
                    value={telefone}
                    onChange={e => setTelefone(maskPhone(e.target.value))}
                    className="w-full border rounded p-3 outline-none focus:border-[#008d36]"
                    placeholder="+55 (11) 99999-9999"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">CPF</label>
                  <input required value={cpf} onChange={e => setCpf(e.target.value)} className="w-full border rounded p-3 outline-none focus:border-[#008d36]" placeholder="000.000.000-00" />
                </div>
              </div>

              {/* Programa de Fidelidade e Voo */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4 pt-4 border-t border-gray-100">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Programa de Fidelidade <span className="text-gray-400 font-normal">(Opcional)</span></label>
                  <select
                    value={loyaltyProgramId}
                    onChange={e => {
                      setLoyaltyProgramId(e.target.value);
                      const prog = loyaltyPrograms.find(p => p.code === e.target.value);
                      setLoyaltyProgramName(prog?.name || '');
                    }}
                    className="w-full border rounded p-3 outline-none focus:border-[#008d36] bg-white text-gray-900"
                  >
                    <option value="">Selecione um programa</option>
                    {loyaltyPrograms.map(p => (
                      <option key={p.id} value={p.code}>{p.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Número Fidelidade <span className="text-gray-400 font-normal">(Opcional)</span></label>
                  <input value={loyaltyId} onChange={e => setLoyaltyId(e.target.value)} className="w-full border rounded p-3 outline-none focus:border-[#008d36]" placeholder="Ex: 12345678" />
                </div>
              </div>
              <div className="mt-4">
                <label className="block text-xs font-bold text-gray-700 mb-1">Número do Voo <span className="text-gray-400 font-normal">(Opcional)</span></label>
                <input value={flightNumber} onChange={e => setFlightNumber(e.target.value.toUpperCase())} className="w-full border rounded p-3 outline-none focus:border-[#008d36]" placeholder="Ex: LA3212" />
              </div>
            </div>

            {/* Pagamento */}
            <div className="bg-white rounded-lg border border-gray-200 p-5 md:p-8 shadow-sm">
              <h2 className="text-xl font-black text-gray-900 mb-6">2. Forma de Pagamento</h2>
              <div className="space-y-4">
                {/* Balcão — only for POA tariff */}
                {tariffType !== 'ETO' && (
                  <label className={`block border-2 rounded-lg p-5 cursor-pointer flex items-center gap-4 transition-colors ${paymentMethod === "BALCAO" ? "border-[#008d36] bg-green-50" : "border-gray-200 hover:border-gray-300"}`}>
                    <input type="radio" checked={paymentMethod === "BALCAO"} onChange={() => setPaymentMethod("BALCAO")} className="w-5 h-5 accent-[#008d36]" />
                    <div>
                      <span className="font-bold text-gray-900 block">Pagar no balcão da loja</span>
                      <span className="text-xs text-gray-500">Pague apenas no momento de retirada do veículo.</span>
                    </div>
                  </label>
                )}

                {/* Tariff type indicator */}


                <label className={`block border-2 rounded-lg p-5 cursor-pointer flex items-center gap-4 transition-colors ${paymentMethod === "PIX" ? "border-[#008d36] bg-green-50" : "border-gray-200 hover:border-gray-300"}`}>
                  <input type="radio" checked={paymentMethod === "PIX"} onChange={() => setPaymentMethod("PIX")} className="w-5 h-5 accent-[#008d36]" />
                  <div>
                    <span className="font-bold text-gray-900 flex items-center gap-2">
                      Pagar Online via PIX
                      <span className="bg-[#1b75bb] text-white text-[10px] px-2 py-0.5 rounded font-bold">RÁPIDO</span>
                    </span>
                    <span className="text-xs text-gray-500">Aprovação imediata.</span>
                  </div>
                </label>


                <div className={`border-2 rounded-lg overflow-hidden transition-colors ${paymentMethod === "CREDIT" ? "border-[#008d36]" : "border-gray-200"}`}>
                  <label className={`block p-5 cursor-pointer flex items-center gap-4 ${paymentMethod === "CREDIT" ? "bg-green-50 border-b border-[#008d36]" : "hover:bg-gray-50"}`}>
                    <input type="radio" checked={paymentMethod === "CREDIT"} onChange={() => setPaymentMethod("CREDIT")} className="w-5 h-5 accent-[#008d36]" />
                    <div>
                      <span className="font-bold text-gray-900 block">Pagar Online com Cartão de Crédito</span>
                      <span className="text-xs text-gray-500">100% seguro via Cielo.</span>
                    </div>
                  </label>
                  {paymentMethod === "CREDIT" && (
                    <div className="p-6 space-y-4">
                      {/* Campos ocultos obrigatórios para o script Braspag MPI 3DS 2.2 —
                          nomes de classe conferidos com o exemplo oficial da Braspag
                          (github.com/Braspag/braspag.github.io, _posts/emv3ds/exemplo.html) */}
                      <input type="hidden" className="bpmpi_auth" value="true" readOnly />
                      <input type="hidden" className="bpmpi_auth_notifyonly" value="false" readOnly />
                      <input ref={accessTokenInputRef} type="hidden" className="bpmpi_accesstoken" value={threeDsAccessToken} readOnly />
                      <input type="hidden" className="bpmpi_ordernumber" value={ccOrderNumber} readOnly />
                      <input type="hidden" className="bpmpi_currency" value="BRL" readOnly />
                      <input type="hidden" className="bpmpi_totalamount" value={amountInCents} readOnly />
                      <input type="hidden" className="bpmpi_paymentmethod" value="Credit" readOnly />
                      <input type="hidden" className="bpmpi_installments" value="1" readOnly />

                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">Nome no Cartão</label>
                        <input
                          required
                          id="cc-holder-name"
                          value={ccName}
                          onChange={e => setCcName(e.target.value)}
                          className="w-full border rounded p-3 outline-none focus:border-[#008d36]"
                          placeholder="NOME DO TITULAR"
                          autoComplete="cc-name"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">Número do Cartão</label>
                        <input
                          required
                          id="cc-number"
                          value={ccNumber}
                          onChange={e => setCcNumber(e.target.value)}
                          className="bpmpi_cardnumber w-full border rounded p-3 outline-none focus:border-[#008d36] tracking-widest"
                          placeholder="0000 0000 0000 0000"
                          maxLength={19}
                          autoComplete="cc-number"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-bold text-gray-700 mb-1">Validade (MM/AAAA)</label>
                          <input
                            required
                            id="cc-expiry"
                            value={ccValidity}
                            onChange={e => { let v = e.target.value.replace(/\D/g, ""); if (v.length >= 2) v = v.slice(0, 2) + "/" + v.slice(2, 6); setCcValidity(v); }}
                            className="w-full border rounded p-3 outline-none focus:border-[#008d36]"
                            placeholder="12/2030"
                            maxLength={7}
                            autoComplete="cc-exp"
                          />
                          {/* O script MPI espera mês/ano separados em 2 dígitos (MM e YY), não um campo combinado */}
                          <input type="hidden" className="bpmpi_cardexpirationmonth" value={ccValidity.split('/')[0] || ''} readOnly />
                          <input type="hidden" className="bpmpi_cardexpirationyear" value={(ccValidity.split('/')[1] || '').slice(-2)} readOnly />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-gray-700 mb-1">CVV</label>
                          <input
                            required
                            id="cc-cvv"
                            value={ccCvv}
                            onChange={e => setCcCvv(e.target.value)}
                            className="w-full border rounded p-3 outline-none focus:border-[#008d36]"
                            placeholder="123"
                            maxLength={4}
                            autoComplete="cc-csc"
                          />
                        </div>
                      </div>
                      {threeDsProcessing ? (
                        <p className="text-xs text-blue-600 flex items-center gap-2 font-bold">
                          <span className="w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin inline-block" />
                          Aguardando confirmação do seu banco — se aparecer uma tela ou notificação de aprovação, confirme para continuar.
                        </p>
                      ) : threeDsReady ? (
                        <p className="text-[10px] text-gray-400 flex items-center gap-1">
                          <svg className="w-3 h-3 text-green-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                          Proteção 3DS 2.2 ativa — autenticação segura pelo seu banco
                        </p>
                      ) : null}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Terms & Conditions Checkboxes */}
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-6 mb-6 space-y-4">
              <h4 className="text-sm font-black text-gray-900 uppercase tracking-wide flex items-center gap-2">
                <svg className="w-5 h-5 text-[#008d36]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                Termos e Condições
              </h4>

              <label className="flex items-start gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={acceptTermsReserva}
                  onChange={e => setAcceptTermsReserva(e.target.checked)}
                  className="mt-1 w-5 h-5 accent-[#008d36] rounded cursor-pointer shrink-0"
                />
                <span className="text-sm text-gray-700 group-hover:text-gray-900 transition-colors">
                  Li e aceito os{' '}
                  <a href="/api/terms/reserva" target="_blank" rel="noopener noreferrer" className="text-[#008d36] font-bold underline hover:text-[#006d28]">
                    Termos e Condições da Reserva
                  </a>
                </span>
              </label>

              <label className="flex items-start gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={acceptTermsPais}
                  onChange={e => setAcceptTermsPais(e.target.checked)}
                  className="mt-1 w-5 h-5 accent-[#008d36] rounded cursor-pointer shrink-0"
                />
                <span className="text-sm text-gray-700 group-hover:text-gray-900 transition-colors">
                  Li e aceito os{' '}
                  <a href={termsAvailable.paisUrl || "/api/terms/pais"} target="_blank" rel="noopener noreferrer" className="text-[#008d36] font-bold underline hover:text-[#006d28]">
                    Termos e Condições do País
                  </a>
                  {' '}onde a reserva está sendo realizada
                </span>
              </label>

              {!acceptTermsReserva || !acceptTermsPais ? (
                <p className="text-xs text-red-500 font-medium flex items-center gap-1">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" /></svg>
                  Você precisa aceitar ambos os termos para finalizar a reserva.
                </p>
              ) : null}
            </div>

            <div className="text-right">
              <button disabled={loading || !acceptTermsReserva || !acceptTermsPais} type="submit" className="w-full md:w-auto bg-[#008d36] hover:bg-[#007a2d] text-white font-black py-4 md:py-5 px-8 md:px-10 rounded-lg shadow-lg uppercase tracking-wide text-base md:text-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors touch-target">
                {loading ? "Processando..." : "Finalizar e Reservar Agora"}
              </button>
            </div>
          </form>
        </div>

        {/* Resumo */}
        <div className="w-full md:w-[380px] shrink-0">
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm sticky top-8">
            <div className="bg-gray-50 border-b border-gray-200 p-6">
              <h3 className="font-black text-gray-900 text-lg mb-1">Resumo da Reserva</h3>
              <p className="text-xs text-gray-500 font-bold uppercase">{days} {days === 1 ? "dia" : "dias"} de aluguel</p>
            </div>
            <div className="p-6">
              {/* Car image + name */}
              <div className="mb-5 flex flex-col items-center">
                {(() => {
                  const sources = [
                    car.imageUrl || null,
                    carCode ? `https://static.europcar.com/carvisuals/partners/835x557/${carCode}_IT.png` : null,
                    carSample ? `https://www.europcar.com/vehicles/images/223/cars/${carSample.split(" ")[0].toLowerCase()}/${carSample.split(" ").slice(1, 3).join("-").toLowerCase().replace(/[^a-z0-9-]/g, "")}.png` : null,
                    `https://placehold.co/400x200/f5f5f5/008d36?text=${carCode || "CAR"}`,
                  ].filter(Boolean) as string[];
                  return (
                    <img
                      src={sources[imgSrcIdx] || sources[0]}
                      alt={carSample || carName}
                      onError={() => { if (imgSrcIdx < sources.length - 1) setImgSrcIdx(i => i + 1); }}
                      className="w-48 h-28 object-contain mix-blend-multiply"
                    />
                  );
                })()}
                <h4 className="font-black text-lg text-gray-900 text-center uppercase mt-2">{carName}</h4>
                {carCode && <span className="text-xs bg-gray-100 text-gray-500 font-bold px-2 py-0.5 rounded-full mt-1">{carCode}</span>}
                {carCategoryDesc && <span className="text-xs text-gray-400 mt-0.5">{carCategoryDesc}</span>}
              </div>

              {/* Locations + dates */}
              <div className="border-t border-b border-gray-100 py-4 my-4 space-y-3 text-sm">
                <div className="flex justify-between items-start">
                  <span className="text-gray-500 font-bold">Retirada</span>
                  <span className="font-black text-gray-900 text-right text-xs uppercase">
                    {pickupStation}<br />{formatDate(pickupDate)}
                  </span>
                </div>
                <div className="flex justify-between items-start">
                  <span className="text-gray-500 font-bold">Devolução</span>
                  <span className="font-black text-gray-900 text-right text-xs uppercase">
                    {returnStation || pickupStation}<br />{formatDate(returnDate)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-500 font-bold">País de residência</span>
                  <span className="font-black text-gray-900 text-right text-xs flex items-center gap-1">
                    <span className="bg-gray-100 text-gray-600 font-bold px-1.5 py-0.5 rounded text-[10px]">{driverCountry}</span>
                    {driverCountryName}
                  </span>
                </div>
                {loyaltyProgramName && (
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500 font-bold">Fidelidade</span>
                    <span className="font-bold text-[#e67e00] text-right text-xs">✈️ {loyaltyProgramName}</span>
                  </div>
                )}
              </div>

              {/* Price breakdown */}
              <div className="space-y-2 mb-4 text-sm">

                {/* Preço original riscado se houver desconto confirmado */}
                {hasDiscountValue ? (
                  <>
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-400 line-through">Preço sem contrato ({currency})</span>
                      <span className="text-gray-400 line-through">{currency} {standardTotalXRS.toFixed(2).replace(".", ",")}</span>
                    </div>
                    {standardTotalBRL > 0 && (
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-400 line-through">Preço sem contrato (BRL)</span>
                        <span className="text-gray-400 line-through">R$ {standardTotalBRL.toFixed(2).replace(".", ",")}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-xs font-bold text-green-700 bg-green-50 rounded px-2 py-1">
                      <span>💰 Economia com contrato</span>
                      <span>- {currency} {discountXRS.toFixed(2).replace(".", ",")}{discountBRL > 0 ? ` / -R$ ${discountBRL.toFixed(2).replace(".", ",")}` : ""}</span>
                    </div>
                    <div className="flex justify-between font-bold text-green-800">
                      <span>Total com tarifa ({currency})</span>
                      <span>{currency} {totalRateXRS.toFixed(2).replace(".", ",")}</span>
                    </div>
                    {totalBRL > 0 && bookingCurrency && (
                      <div className="flex justify-between font-bold text-green-800">
                        <span>Total com tarifa ({bookingCurrency})</span>
                        <span>{bookingCurrency} {totalBRL.toFixed(2).replace(".", ",")}</span>
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <div className="flex justify-between">
                      <span className="text-gray-500 font-medium">Total período ({currency})</span>
                      <span className="font-bold text-gray-900">{currency} {totalRateXRS.toFixed(2).replace(".", ",")}</span>
                    </div>
                    {totalBRL > 0 && bookingCurrency && (
                      <div className="flex justify-between">
                        <span className="text-gray-500 font-medium">Em {bookingCurrency}</span>
                        <span className="font-bold text-gray-900">{bookingCurrency} {totalBRL.toFixed(2).replace(".", ",")}</span>
                      </div>
                    )}
                  </>
                )}
                {car.exchangeRate && (
                  <div className="flex justify-between text-xs text-gray-400">
                    <span>Câmbio</span>
                    <span>1 {currency} = {bookingCurrency} {parseFloat(car.exchangeRate).toFixed(4)}</span>
                  </div>
                )}
                {/* O QUE ESTÁ INCLUÍDO? */}
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <div className="flex justify-between text-xs font-bold text-gray-700 mb-2">
                    <span className="uppercase text-[#008d36] text-[10px]">O que está incluído?</span>
                  </div>
                  <div className="space-y-1.5">
                    {/* Quilometragem */}
                    <div className="flex justify-between text-[10px] text-gray-500">
                      <span>Quilometragem {car?.mileageType === 'Livre' ? 'Ilimitada' : 'Limitada'}</span>
                      <span className="text-gray-400">Incluída</span>
                    </div>
                    {/* Itens inclusos da API — excluindo sobretaxa de aeroporto (exibida separadamente) */}
                    {booking?.quoteInsurances?.filter((i: any) => {
                      const d = (i.descr || '').toLowerCase();
                      const isAirport = d.includes('aeroporto') || d.includes('airport') ||
                        d.includes('ferroviária') || d.includes('railway') ||
                        d === 'sobretaxa de aeroporto/estação ferroviária';
                      return !isAirport && (i.type === 'M' || i.type === 'I' || i.includedInTotal === 'Y');
                    }).map((ins: any, idx: number) => (
                      <div key={idx} className="flex justify-between text-[10px] text-gray-500">
                        <span>{ins.descr || ins.code}</span>
                        <span className="text-gray-400">Incluída</span>
                      </div>
                    ))}
                  </div>
                </div>
                {/* Sobretaxa de aeroporto/estação ferroviária — box destacado com valor */}
                {(() => {
                  const airportFees = booking?.quoteInsurances?.filter((i: any) => {
                    const d = (i.descr || '').toLowerCase();
                    return d.includes('aeroporto') || d.includes('airport') ||
                      d.includes('ferroviária') || d.includes('railway') ||
                      d === 'sobretaxa de aeroporto/estação ferroviária';
                  }) || [];
                  if (airportFees.length === 0) return null;
                  return (
                    <div className="mt-3 flex flex-col gap-1 bg-orange-50 border border-orange-200 rounded-lg p-2.5">
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className="text-[10px] font-bold text-orange-700 uppercase tracking-wide">✈ Sobretaxa de aeroporto/estação ferroviária</span>
                      </div>
                      {airportFees.map((ins: any, idx: number) => {
                        const val = ins.rentalPriceInBookingCurrencyAI > 0
                          ? ins.rentalPriceInBookingCurrencyAI
                          : (ins.priceInBookingCurrency > 0 ? ins.priceInBookingCurrency : ins.price);
                        const curr = bookingCurrency || currency || 'EUR';
                        return (
                          <div key={idx} className="flex justify-between text-[10px] text-orange-800">
                            <span className="flex-1 pr-2">{ins.descr || ins.code}</span>
                            {val > 0 ? (
                              <span className="font-bold whitespace-nowrap">{curr} {val.toFixed(2).replace('.', ',')}</span>
                            ) : (
                              <span className="text-orange-500 italic">Verificar na retirada</span>
                            )}
                          </div>
                        );
                      })}
                      <p className="text-[9px] text-orange-600 mt-1 leading-tight border-t border-orange-200 pt-1">
                        ⓘ Este valor é cobrado diretamente pela Europcar no balcão de retirada.
                      </p>
                    </div>
                  );
                })()}
                {parseFloat(car?.amountToPayOnArrivalInBookingCurrency || car?.amountToPayOnArrival || '0') > 0 && (
                  <div className="flex flex-col text-xs font-bold text-[#e67e00] mt-1 bg-[#fff8f0] p-2 rounded">
                    <div className="flex justify-between">
                      <span>A ser pago na Estação (Taxas Locais)</span>
                      <span>
                        {(car?.amountToPayOnArrivalInBookingCurrency ? bookingCurrency : currency) || 'BRL'}{' '}
                        {parseFloat(car?.amountToPayOnArrivalInBookingCurrency || car?.amountToPayOnArrival || '0').toFixed(2).replace('.', ',')}
                      </span>
                    </div>
                    {booking?.quoteInsurances?.filter((i: any) => i.type === 'M' && ['APF', 'APT', 'AIRPORTFEE', 'CITYFEE', 'LOC', 'PRM', 'YSC'].includes(i.code)).map((ins: any, idx: number) => (
                      <div key={idx} className="text-[10px] text-gray-500 font-normal flex justify-between mt-1.5 border-t border-[#e67e00]/10 pt-1.5">
                        <span className="flex-1 truncate pr-2">- {ins.descr || 'Suplemento de Estação Premium'} ({ins.code})</span>
                        {ins.rentalPriceInBookingCurrencyAI > 0 && (
                          <span className="whitespace-nowrap">{(car?.amountToPayOnArrivalInBookingCurrency ? bookingCurrency : currency) || 'BRL'} {ins.rentalPriceInBookingCurrencyAI.toFixed(2).replace('.', ',')}</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Extras selecionados */}
              {extrasDetails.length > 0 && (
                <div className="border border-[#008d36]/20 rounded-lg bg-green-50 p-4 mt-4 mb-4">
                  <h5 className="text-xs font-bold text-[#008d36] uppercase mb-1">Proteções & Extras</h5>
                  <p className="text-[10px] text-gray-500 mb-3 leading-tight">Opcionais reservados. O pagamento destes itens é feito na loja de destino.</p>
                  <div className="space-y-2">
                    {extrasDetails.map((extra: any) => {
                      const insNames: Record<string, string> = {
                        PREMIUM: "Cobertura Premium", PREMPRE: "Premium Pré-pago", PREMUP: "Premium Plus",
                        SPCDW: "Super Proteção CDW", SPTHW: "Super Proteção THW", STHW: "Proteção THW+",
                        SCDW: "Proteção CDW+", MEDIUM: "Cobertura Média", RSA: "Assistência na Estrada",
                        APP: "Proteção de Aparência",
                      };
                      return (
                        <div key={extra.id} className="flex justify-between items-center text-sm">
                          <div className="flex items-center gap-2">
                            {extra.qty > 1 && (
                              <span className="bg-[#008d36] text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center">{extra.qty}</span>
                            )}
                            <span className="text-gray-700 font-medium">{insNames[extra.id] || extra.id}</span>
                          </div>
                          <span className="font-bold text-gray-900">
                            BRL {(extra.pricePerDay * extra.qty).toFixed(2).replace(".", ",")}
                            <span className="text-xs text-gray-400 font-normal"> /dia</span>
                          </span>
                        </div>
                      );
                    })}
                    <div className="flex justify-between items-center text-sm border-t border-green-200 pt-2 mt-2">
                      <span className="font-bold text-gray-600">Total extras ({days} dias)</span>
                      <span className="font-black text-[#008d36]">
                        R$ {(extrasDetails.reduce((sum: number, e: any) => sum + e.pricePerDay * e.qty, 0) * days).toFixed(2).replace(".", ",")}
                      </span>
                    </div>
                  </div>
                </div>
              )}



              {/* Total */}
              <div className="bg-gray-50 -mx-6 -mb-6 p-6 border-t border-gray-200">

                {/* Equipment section in main form */}
                {booking?.xrsEquipment?.length > 0 && (
                  <div className="mb-4 pb-3 border-b border-gray-200">
                    <div className="text-[10px] font-bold text-[#e67e00] uppercase mb-1">Acessórios</div>
                    <p className="text-[10px] text-gray-500 mb-2 leading-tight">Opcionais reservados. O pagamento destes itens é feito na loja de destino.</p>
                    {booking.xrsEquipment.map((eq: any) => {
                      const eqPriceBRL = parseFloat(eq.priceBRL || 0);
                      const eqTotal = eqPriceBRL * (eq.qty || 1) * days;
                      return (
                        <div key={eq.code} className="flex justify-between items-center text-sm mb-1">
                          <span className="text-gray-700">{eq.icon || '📦'} {eq.name || eq.code} ×{eq.qty}</span>
                          <span className="font-bold text-gray-900">R$ {eqTotal.toFixed(2).replace(".", ",")}</span>
                        </div>
                      );
                    })}
                  </div>
                )}

                <div className="flex justify-between items-end">
                  <span className="text-xs font-bold text-gray-500 uppercase">Total a pagar agora</span>
                  <div className="text-right">
                    <span className="text-2xl font-black text-gray-900">
                      {(() => {
                        const cur = totalBRL > 0 ? bookingCurrency : currency;
                        return `${cur} ${baseAmountBRL.toFixed(2).replace(".", ",")}`;
                      })()}
                    </span>
                  </div>
                </div>
                {airportSurchargeBRL > 0 && (
                  <div className="flex justify-between items-center text-xs text-orange-600 mt-1">
                    <span>✈ Sobretaxa de aeroporto (pago no balcão)</span>
                    <span className="font-bold">{totalBRL > 0 ? bookingCurrency : currency} {airportSurchargeBRL.toFixed(2).replace('.', ',')}</span>
                  </div>
                )}
                {(extrasDetails.length > 0 || booking?.xrsEquipment?.length > 0) && (() => {
                  const extrasVal = extrasDetails.reduce((s: number, e: any) => s + e.pricePerDay * e.qty, 0) * days;
                  const equipVal = (booking?.xrsEquipment || []).reduce((s: number, eq: any) => s + parseFloat(eq.priceBRL || 0) * (eq.qty || 1) * days, 0);
                  const total = extrasVal + equipVal;
                  if (total <= 0) return null;
                  return (
                    <div className="flex justify-between items-center text-xs text-gray-500 mt-2 pt-2 border-t border-gray-200">
                      <span>+ Proteções/acessórios (pago na loja de destino)</span>
                      <span className="font-bold">R$ {total.toFixed(2).replace(".", ",")}</span>
                    </div>
                  );
                })()}

              </div>



            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
