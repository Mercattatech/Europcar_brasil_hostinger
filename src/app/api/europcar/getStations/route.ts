import { NextResponse } from 'next/server';
import { getStations } from '@/lib/europcar/xrsClient';
export const dynamic = 'force-dynamic';

// In-memory cache: { key: countryCode, value: { stations, timestamp } }
const stationsCache: Record<string, { stations: any[]; ts: number }> = {};
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

// Main countries available in the Europcar network
const ALL_COUNTRIES = [
  'BR', // Brasil
  'AR', // Argentina
  'US', // Estados Unidos
  'CA', // Canadá
  'MX', // México
  'FR', // França
  'DE', // Alemanha
  'ES', // Espanha
  'IT', // Itália
  'GB', // Reino Unido
  'PT', // Portugal
  'BE', // Bélgica
  'NL', // Países Baixos
  'CH', // Suíça
  'AT', // Áustria
  'IE', // Irlanda
  'GR', // Grécia
  'HR', // Croácia
  'CZ', // República Checa
  'DK', // Dinamarca
  'FI', // Finlândia
  'HU', // Hungria
  'NO', // Noruega
  'PL', // Polônia
  'RO', // Romênia
  'SE', // Suécia
  'TR', // Turquia
  'BG', // Bulgária
  'IS', // Islândia
  'AU', // Austrália
  'NZ', // Nova Zelândia
];

// Country name lookup for display
const COUNTRY_NAMES: Record<string, string> = {
  BR: 'Brasil', AR: 'Argentina', US: 'Estados Unidos', CA: 'Canadá', MX: 'México',
  FR: 'França', DE: 'Alemanha', ES: 'Espanha', IT: 'Itália', GB: 'Reino Unido',
  PT: 'Portugal', BE: 'Bélgica', NL: 'Países Baixos', CH: 'Suíça', AT: 'Áustria',
  IE: 'Irlanda', GR: 'Grécia', HR: 'Croácia', CZ: 'Rep. Checa', DK: 'Dinamarca',
  FI: 'Finlândia', HU: 'Hungria', NO: 'Noruega', PL: 'Polônia', RO: 'Romênia',
  SE: 'Suécia', TR: 'Turquia', BG: 'Bulgária', IS: 'Islândia', AU: 'Austrália',
  NZ: 'Nova Zelândia',
};

/**
 * Fetch stations for a single country, using in-memory cache.
 */
async function getCachedStations(countryCode: string): Promise<any[]> {
  const cached = stationsCache[countryCode];
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
    return cached.stations;
  }

  try {
    const stations = await getStations(countryCode);
    // Tag each station with its country code
    const tagged = stations.map(s => ({ ...s, countryCode }));
    stationsCache[countryCode] = { stations: tagged, ts: Date.now() };
    return tagged;
  } catch (e) {
    console.error(`[getStations] Falha para ${countryCode}:`, e);
    return cached?.stations || []; // Return stale cache if available
  }
}

// Well-known city → country mapping for eager fetching
const CITY_COUNTRY_MAP: Record<string, string[]> = {
  'roma': ['IT'], 'rome': ['IT'], 'milano': ['IT'], 'milan': ['IT'], 'firenze': ['IT'], 'florence': ['IT'],
  'napoli': ['IT'], 'naples': ['IT'], 'venezia': ['IT'], 'venice': ['IT'], 'torino': ['IT'], 'turin': ['IT'], 'bologna': ['IT'],
  'paris': ['FR'], 'lyon': ['FR'], 'marseille': ['FR'], 'nice': ['FR'], 'toulouse': ['FR'], 'bordeaux': ['FR'],
  'madrid': ['ES'], 'barcelona': ['ES'], 'sevilla': ['ES'], 'seville': ['ES'], 'valencia': ['ES'], 'malaga': ['ES'], 'bilbao': ['ES'],
  'london': ['GB'], 'londres': ['GB'], 'manchester': ['GB'], 'edinburgh': ['GB'], 'birmingham': ['GB'], 'glasgow': ['GB'],
  'berlin': ['DE'], 'munich': ['DE'], 'munchen': ['DE'], 'frankfurt': ['DE'], 'hamburg': ['DE'], 'cologne': ['DE'],
  'lisboa': ['PT'], 'lisbon': ['PT'], 'porto': ['PT'], 'faro': ['PT'],
  'amsterdam': ['NL'], 'rotterdam': ['NL'],
  'bruxelas': ['BE'], 'brussels': ['BE'], 'bruxelles': ['BE'],
  'zurich': ['CH'], 'zurique': ['CH'], 'geneva': ['CH'], 'genebra': ['CH'], 'bern': ['CH'],
  'vienna': ['AT'], 'viena': ['AT'], 'salzburg': ['AT'],
  'dublin': ['IE'],
  'atenas': ['GR'], 'athens': ['GR'],
  'zagreb': ['HR'],
  'praga': ['CZ'], 'prague': ['CZ'],
  'copenhague': ['DK'], 'copenhagen': ['DK'],
  'helsinki': ['FI'],
  'budapeste': ['HU'], 'budapest': ['HU'],
  'oslo': ['NO'],
  'varsovia': ['PL'], 'warsaw': ['PL'], 'cracovia': ['PL'], 'krakow': ['PL'],
  'bucareste': ['RO'], 'bucharest': ['RO'],
  'estocolmo': ['SE'], 'stockholm': ['SE'],
  'istambul': ['TR'], 'istanbul': ['TR'],
  'reykjavik': ['IS'],
  'new york': ['US'], 'los angeles': ['US'], 'miami': ['US'], 'chicago': ['US'], 'orlando': ['US'],
  'buenos aires': ['AR'],
  'sydney': ['AU'], 'melbourne': ['AU'],
  'auckland': ['NZ'],
};

const SYNONYMS: Record<string, string[]> = {
  'roma': ['rome'], 'rome': ['roma'],
  'milano': ['milan'], 'milan': ['milano'],
  'firenze': ['florence'], 'florence': ['firenze'],
  'napoli': ['naples'], 'naples': ['napoli'],
  'venezia': ['venice'], 'venice': ['venezia'],
  'torino': ['turin'], 'turin': ['torino'],
  'londres': ['london'], 'london': ['londres'],
  'lisboa': ['lisbon'], 'lisbon': ['lisboa'],
  'munich': ['munchen'], 'munchen': ['munich'],
  'bruxelas': ['brussels', 'bruxelles'], 'brussels': ['bruxelas', 'bruxelles'], 'bruxelles': ['bruxelas', 'brussels'],
  'zurique': ['zurich'], 'zurich': ['zurique'],
  'genebra': ['geneva'], 'geneva': ['genebra'],
  'viena': ['vienna'], 'vienna': ['viena'],
  'atenas': ['athens'], 'athens': ['atenas'],
  'praga': ['prague'], 'prague': ['praga'],
  'copenhague': ['copenhagen'], 'copenhagen': ['copenhague'],
  'budapeste': ['budapest'], 'budapest': ['budapeste'],
  'varsovia': ['warsaw'], 'warsaw': ['varsovia'],
  'cracovia': ['krakow'], 'krakow': ['cracovia'],
  'bucareste': ['bucharest'], 'bucharest': ['bucareste'],
  'estocolmo': ['stockholm'], 'stockholm': ['estocolmo'],
  'istambul': ['istanbul'], 'istanbul': ['istambul'],
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get('q') ?? '').trim().toLowerCase();
  const countryParam = searchParams.get('country')?.toUpperCase();

  if (!q || q.length < 2) {
    return NextResponse.json({ stations: [] });
  }

  let allStations: any[] = [];

  if (countryParam && countryParam !== 'ALL') {
    // Single country search
    allStations = await getCachedStations(countryParam);
  } else {
    // Priority: always include Brazil first (fast)
    allStations = await getCachedStations('BR');

    // Eagerly fetch countries that match the city query
    const priorityCountries = new Set<string>();
    for (const [cityKey, countryCodes] of Object.entries(CITY_COUNTRY_MAP)) {
      if (cityKey.includes(q) || q.includes(cityKey)) {
        countryCodes.forEach(cc => priorityCountries.add(cc));
      }
    }

    // Also check if the query matches a country name
    for (const [cc, name] of Object.entries(COUNTRY_NAMES)) {
      if (name.toLowerCase().includes(q)) {
        priorityCountries.add(cc);
      }
    }

    // Eagerly fetch priority countries (await these!)
    if (priorityCountries.size > 0) {
      const priorityResults = await Promise.all(
        [...priorityCountries].filter(cc => cc !== 'BR').map(cc => getCachedStations(cc))
      );
      for (const stations of priorityResults) {
        allStations.push(...stations);
      }
    }

    // Include other countries that are already cached (instant)
    for (const cc of ALL_COUNTRIES) {
      if (cc === 'BR' || priorityCountries.has(cc)) continue;
      const cached = stationsCache[cc];
      if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
        allStations.push(...cached.stations);
      }
    }

    // Trigger background pre-warm for uncached countries (fire-and-forget)
    const uncached = ALL_COUNTRIES.filter(cc => {
      const c = stationsCache[cc];
      return !c || Date.now() - c.ts >= CACHE_TTL_MS;
    });
    if (uncached.length > 0) {
      Promise.all(uncached.slice(0, 10).map(c => getCachedStations(c))).catch(() => {});
    }
  }

  // Deduplicate by station code (XRS sometimes returns duplicates)
  const seenCodes = new Set<string>();
  const uniqueStations = allStations.filter((s) => {
    const code = (s.stationCode ?? s.code ?? '').toUpperCase();
    if (!code || seenCodes.has(code)) return false;
    seenCodes.add(code);
    return true;
  });

  // Helper to match term at the beginning of any word
  const matchWordStart = (text: string, term: string): boolean => {
    const escaped = term.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    const regex = new RegExp(`(^|[^\\p{L}\\p{N}]+)${escaped}`, 'ui');
    return regex.test(text);
  };

  // Apply text filter
  const searchTerms = [q, ...(SYNONYMS[q] || [])];
  const filtered = uniqueStations.filter((s) => {
    const code = s.stationCode ?? s.code ?? '';
    const name = s.stationName ?? s.name ?? '';
    const city = s.cityName ?? s.city ?? '';
    const country = COUNTRY_NAMES[s.countryCode] ?? s.countryCode ?? '';
    return searchTerms.some(term => 
      matchWordStart(code, term) || 
      matchWordStart(name, term) || 
      matchWordStart(city, term) || 
      matchWordStart(country, term)
    );
  });

  // Sort: exact city match first, then station name match, then others
  filtered.sort((a, b) => {
    const cityA = (a.cityName ?? a.city ?? '').toLowerCase();
    const cityB = (b.cityName ?? b.city ?? '').toLowerCase();
    const nameA = (a.stationName ?? a.name ?? '').toLowerCase();
    const nameB = (b.stationName ?? b.name ?? '').toLowerCase();

    // Exact city match gets priority
    const aCityExact = searchTerms.some(term => cityA === term) ? 0 : searchTerms.some(term => cityA.startsWith(term)) ? 1 : 2;
    const bCityExact = searchTerms.some(term => cityB === term) ? 0 : searchTerms.some(term => cityB.startsWith(term)) ? 1 : 2;
    if (aCityExact !== bCityExact) return aCityExact - bCityExact;

    // Then station name match
    const aNameMatch = searchTerms.some(term => nameA.includes(term)) ? 0 : 1;
    const bNameMatch = searchTerms.some(term => nameB.includes(term)) ? 0 : 1;
    if (aNameMatch !== bNameMatch) return aNameMatch - bNameMatch;

    return nameA.localeCompare(nameB);
  });

  // Limit results for performance
  const limited = filtered.slice(0, 30);

  // Shape payload for frontend autocomplete
  const payload = limited.map((s) => ({
    code: s.stationCode ?? s.code,
    name: s.stationName ?? s.name,
    city: s.cityName ?? s.city ?? '',
    country: COUNTRY_NAMES[s.countryCode] ?? s.countryCode ?? '',
    countryCode: s.countryCode ?? '',
    type: s.prestige === 'Y' ? 'airport' : s.type ?? 'city',
    address: s.address1 ?? s.address ?? '',
    features: s.features ?? [],
    hours: s.hours ?? [],
  }));

  return NextResponse.json({ stations: payload });
}

