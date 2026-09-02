import axios from 'axios';
import { parseStringPromise } from 'xml2js';
import prisma from '@/lib/prisma';

// ── CID Constants (Contract IDs) ──────────────────────────────
// POA = tarifas públicas padrão
export const DEFAULT_POA_CID = '57269673';
export const SECONDARY_POA_CID = '55138134';
export const POA_CIDS = ['57269673', '55138134'];
// ETO = tarifas corporativas com desconto
export const ETO_CID_LIQUIDO = '56935466';       // Líquido (Excesso) — BA 73675595
export const ETO_CID_INTERNACIONAL = '56935495';  // Internacional (Excesso Zero) — BA 73804373
// EXO = voucher de agência
export const EXO_CID = '57269673';                // Mesmo CID da POA, IATA: 02170722

export interface DynamicXRSContractConfig {
  poaCid: string;
  etoZeroExcessCid: string;
  etoZeroExcessBa: string;
  etoExcessCid: string;
  etoExcessBa: string;
  exoCid: string;
  exoIata: string;
}

export async function getDynamicXRSContractConfig(): Promise<DynamicXRSContractConfig> {
  const defaults: DynamicXRSContractConfig = {
    poaCid: DEFAULT_POA_CID,
    etoZeroExcessCid: ETO_CID_INTERNACIONAL,
    etoZeroExcessBa: '73804373',
    etoExcessCid: ETO_CID_LIQUIDO,
    etoExcessBa: '73675595',
    exoCid: EXO_CID,
    exoIata: '02170722',
  };

  try {
    const dbConfig = await prisma.xRSConfig.findFirst();
    if (!dbConfig) return defaults;
    return {
      poaCid: dbConfig.poaCid || defaults.poaCid,
      etoZeroExcessCid: dbConfig.etoZeroExcessCid || defaults.etoZeroExcessCid,
      etoZeroExcessBa: dbConfig.etoZeroExcessBa || defaults.etoZeroExcessBa,
      etoExcessCid: dbConfig.etoExcessCid || defaults.etoExcessCid,
      etoExcessBa: dbConfig.etoExcessBa || defaults.etoExcessBa,
      exoCid: dbConfig.exoCid || defaults.exoCid,
      exoIata: dbConfig.exoIata || defaults.exoIata,
    };
  } catch {
    return defaults;
  }
}

export interface XRSConfig {
  callerCode: string;
  password: string;
  endpointUrl?: string;
  sourceFile?: string; // name of the calling route file
  action?: string;     // XRS action name (e.g. "getMultipleRates")
}

export interface XRSResponse {
  [key: string]: any;
}

export async function callXRS(
  xmlRequest: string,
  config: XRSConfig
): Promise<XRSResponse> {
  const url = config.endpointUrl || process.env.XRS_ENDPOINT_URL || 'https://applications-ptn.europcar.com/xrs/resxml';
  const action = config.action || detectAction(xmlRequest);
  const sourceFile = config.sourceFile || 'unknown';

  const payload = new URLSearchParams();
  payload.append('callerCode', config.callerCode);
  payload.append('password', config.password);
  payload.append('XML-Request', xmlRequest);

  console.log(`[XRS] [${action}] → ${url}`);

  const startTime = Date.now();
  let rawResponse = '';
  let httpStatus = 0;
  let hasError = false;
  let parsedData: any = {};

  try {
    const response = await axios.post(url, payload.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      timeout: 20000,
    });

    httpStatus = response.status;
    rawResponse = typeof response.data === 'string' ? response.data : JSON.stringify(response.data);
    const durationMs = Date.now() - startTime;

    console.log(`[XRS] [${action}] ← HTTP ${httpStatus} (${durationMs}ms)`);

    parsedData = await parseStringPromise(rawResponse, { explicitArray: false });

    const errors = getXRSErrors(parsedData);
    if (errors) {
      console.warn(`[XRS] [${action}] ERRO DE NEGÓCIO:`, JSON.stringify(errors));
      hasError = true;
    }

    // Fire-and-forget: NUNCA bloquear a resposta da API por causa do log
    // Se o Supabase estiver fora, a reserva continua funcionando normalmente
    saveLog({ action, sourceFile, endpoint: url, xmlRequest: maskSensitiveXml(xmlRequest), xmlResponse: maskSensitiveXml(rawResponse), httpStatus, durationMs, hasError })
      .catch(e => console.warn('[XRS] Log não salvo:', e.message));

    return parsedData;

  } catch (error: any) {
    const durationMs = Date.now() - startTime;
    httpStatus = error.response?.status || 0;
    rawResponse = error.response?.data || error.message || 'Erro desconhecido';
    hasError = true;

    console.error(`[XRS] [${action}] FALHA:`, error.message);

    // Save error log too
    await saveLog({ action, sourceFile, endpoint: url, xmlRequest: maskSensitiveXml(xmlRequest), xmlResponse: maskSensitiveXml(String(rawResponse)), httpStatus, durationMs, hasError });

    throw new Error('Serviço de Reservas Europcar indisponível. Tente novamente em instantes.');
  }
}

/**
 * Mascara dados sensíveis (número do cartão e código de segurança) antes de
 * persistir o XML no LogXRS. O XRS em si sempre recebe o dado real — só a
 * cópia gravada no banco é mascarada, análogo ao mascaramento já feito nos
 * logs da Cielo (LogCielo).
 */
function maskSensitiveXml(xml: string): string {
  if (!xml) return xml;
  return xml
    .replace(/cardNumber="(\d{4})\d+(\d{4})"/gi, 'cardNumber="$1********$2"')
    .replace(/(securityCode|cvv|cvc)="[^"]*"/gi, '$1="***"');
}

async function saveLog(data: {
  action: string;
  sourceFile: string;
  endpoint: string;
  xmlRequest: string;
  xmlResponse: string;
  httpStatus: number;
  durationMs: number;
  hasError: boolean;
}) {
  try {
    await prisma.logXRS.create({
      data: {
        action:      data.action,
        sourceFile:  data.sourceFile,
        endpoint:    data.endpoint,
        xmlRequest:  data.xmlRequest,
        xmlResponse: data.xmlResponse,
        httpStatus:  data.httpStatus,
        durationMs:  data.durationMs,
        hasError:    data.hasError,
      }
    });
  } catch (e) {
    // Never let logging crash the main flow
    console.error('[XRS] Falha ao salvar log:', e);
  }
}

function detectAction(xmlRequest: string): string {
  const match = xmlRequest.match(/<Action>([^<]+)<\/Action>/i);
  if (match) return match[1];
  if (xmlRequest.includes('serviceParameters')) return 'getMultipleRates';
  return 'unknown';
}

function getXRSErrors(parsedData: any): any {
  if (parsedData?.Errors) return parsedData.Errors;
  if (parsedData?.Response?.Errors) return parsedData.Response.Errors;
  if (parsedData?.Envelope?.Body?.Fault) return parsedData.Envelope.Body.Fault;
  return null;
}

// =============================
// XRS Station lookup helpers
// =============================

export interface Station {
  prestige: string;
  stationCode: string;
  stationName: string;
  truckAvailable: string;
  // optional extended fields from getStation response
  address1?: string;
  address2?: string;
  areaType?: string;
  cityName?: string;
  collection?: string;
  countryCode?: string;
  countryName?: string;
  county?: string;
  delivery?: string;
  email?: string;
  latitude?: string;
  longitude?: string;
  phoneAreaCode?: string;
  phoneCountryCode?: string;
  phoneNumber?: string;
  phoneWithInternationalDialling?: string;
  postalCode?: string;
  leadTime?: string;
  // ... add more as needed
}

/**
 * Retrieve list of stations for a given country code.
 * Example: getStations('BR')
 */
export async function getStations(countryCode: string, language: string = 'pt_BR'): Promise<Station[]> {
  const xml = `
<message>
  <serviceRequest serviceCode="getStations">
    <serviceContext>
      <localisation active="true">
        <language code="${language}"/>
      </localisation>
    </serviceContext>
    <serviceParameters>
      <station countryCode="${countryCode}"/>
    </serviceParameters>
  </serviceRequest>
</message>`;

  const response = await callXRS(xml, {
    callerCode: process.env.XRS_CALLER_CODE || '',
    password: process.env.XRS_PASSWORD || '',
    action: 'getStations',
    sourceFile: 'xrsClient.ts',
  });

  // Parse response structure safely
  const stations = response?.message?.serviceResponse?.stationList?.station;
  if (!stations) return [];
  // The API may return a single object or an array
  const list = Array.isArray(stations) ? stations : [stations];
  return list.map((s: any) => ({
    prestige: s.$?.prestige ?? s.prestige,
    stationCode: s.$?.stationCode ?? s.stationCode,
    stationName: s.$?.stationName ?? s.stationName,
    cityName: s.$?.cityName ?? s.cityName,
    truckAvailable: s.$?.truckAvailable ?? s.truckAvailable,
  } as Station));
}

/**
 * Retrieve detailed information for a specific station code.
 */
export async function getStation(stationCode: string, language: string = 'pt_BR'): Promise<Station | null> {
  const xml = `
<message>
  <serviceRequest serviceCode="getStation">
    <serviceContext>
      <localisation active="true">
        <language code="${language}"/>
      </localisation>
    </serviceContext>
    <serviceParameters>
      <station stationCode="${stationCode}"/>
    </serviceParameters>
  </serviceRequest>
</message>`;

  const response = await callXRS(xml, {
    callerCode: process.env.XRS_CALLER_CODE || '',
    password: process.env.XRS_PASSWORD || '',
    action: 'getStation',
    sourceFile: 'xrsClient.ts',
  });

  const station = response?.message?.serviceResponse?.station;
  if (!station) return null;
  const s = station;
  return {
    prestige: s.$?.prestige ?? s.prestige,
    stationCode: s.$?.stationCode ?? s.stationCode,
    stationName: s.$?.stationName ?? s.stationName,
    truckAvailable: s.$?.truckAvailable ?? s.truckAvailable,
    address1: s.$?.address1 ?? s.address1,
    address2: s.$?.address2 ?? s.address2,
    areaType: s.$?.areaType ?? s.areaType,
    cityName: s.$?.cityName ?? s.cityName,
    collection: s.$?.collection ?? s.collection,
    countryCode: s.$?.countryCode ?? s.countryCode,
    countryName: s.$?.countryName ?? s.countryName,
    county: s.$?.county ?? s.county,
    delivery: s.$?.delivery ?? s.delivery,
    email: s.$?.email ?? s.email,
    latitude: s.$?.latitude ?? s.latitude,
    longitude: s.$?.longitude ?? s.longitude,
    phoneAreaCode: s.$?.phoneAreaCode ?? s.phoneAreaCode,
    phoneCountryCode: s.$?.phoneCountryCode ?? s.phoneCountryCode,
    phoneNumber: s.$?.phoneNumber ?? s.phoneNumber,
    phoneWithInternationalDialling: s.$?.phoneWithInternationalDialling ?? s.phoneWithInternationalDialling,
    postalCode: s.$?.postalCode ?? s.postalCode,
    leadTime: s.$?.leadTime ?? s.leadTime,
  } as Station;
}
