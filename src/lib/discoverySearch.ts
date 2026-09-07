const SEARCH_EQUIVALENTS: Record<string, string[]> = {
  berber: ["barber"],
  parukeri: ["hair", "salon"],
  floke: ["hair"],
  thonj: ["nail", "nails"],
  tatuazh: ["tattoo"],
  bukuri: ["beauty"],
  stomatolog: ["dentist", "dental"],
  dentare: ["dentist", "dental"],
  dhembe: ["teeth", "dental"],
  palester: ["gym", "fitness"],
  masazh: ["massage"],
  fizioterapi: ["physio", "physiotherapy"],
  evente: ["event", "events"],
  dasma: ["wedding"],
  kurs: ["course", "class"],
  kurse: ["course", "class"],
  mesim: ["lesson", "learning"],
  gjuhe: ["language"],
  shkolle: ["school"],
  tur: ["tour"],
  ture: ["tour"],
  aktivitet: ["activity"],
  aktivitete: ["activity"],
  skaf: ["boat", "tour"],
  ekskursion: ["excursion", "tour"],
  varke: ["boat"],
  qira: ["rental", "hire"],
  "makine me qira": ["car rental", "rent a car", "car hire"],
  muze: ["museum"],
  kala: ["castle"],
  atraksion: ["attraction"],
  restorant: ["restaurant"],
  kafe: ["cafe", "coffee"],
  ushqim: ["food"],
  apartament: ["apartment", "accommodation"],
  akomodim: ["accommodation", "hotel"],
};

export function normalizeDiscoverySearch(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function discoverySearchTerms(value: string) {
  const normalized = normalizeDiscoverySearch(value);
  if (!normalized) return [];

  const expanded = new Set([normalized]);
  const exactEquivalents = SEARCH_EQUIVALENTS[normalized] || [];
  exactEquivalents.forEach((term) => expanded.add(term));

  const paddedQuery = ` ${normalized} `;
  for (const [albanian, equivalents] of Object.entries(SEARCH_EQUIVALENTS)) {
    if (!paddedQuery.includes(` ${albanian} `)) continue;

    equivalents.forEach((term) => {
      expanded.add(normalized.replace(albanian, term));
    });
  }

  return Array.from(expanded, normalizeDiscoverySearch).filter(Boolean);
}

export function discoveryServerSearchTerm(value: string) {
  const [, firstEquivalent] = discoverySearchTerms(value);
  return firstEquivalent || value.trim();
}

const DISCOVERY_CITIES = [
  "Tiranë",
  "Durrës",
  "Vlorë",
  "Sarandë",
  "Shkodër",
  "Korçë",
  "Himarë",
  "Berat",
  "Gjirokastër",
  "Elbasan",
  "Fier",
  "Lezhë",
  "Dhërmi",
  "Ksamil",
];

const CITY_ALIASES: Record<string, string> = {
  tirana: "Tiranë",
  durazzo: "Durrës",
  vlora: "Vlorë",
  saranda: "Sarandë",
  shkodra: "Shkodër",
  korca: "Korçë",
  himara: "Himarë",
  gjirokastra: "Gjirokastër",
};

export function canonicalDiscoveryCity(value: string) {
  const normalized = normalizeDiscoverySearch(value);
  return (
    CITY_ALIASES[normalized] ||
    DISCOVERY_CITIES.find(
      (city) => normalizeDiscoverySearch(city) === normalized,
    ) ||
    value.trim()
  );
}

export function matchesDiscoveryCity(city: string, query: string) {
  return (
    normalizeDiscoverySearch(canonicalDiscoveryCity(city)) ===
    normalizeDiscoverySearch(canonicalDiscoveryCity(query))
  );
}

export function matchesDiscoverySearch(searchText: string, query: string) {
  const normalizedText = normalizeDiscoverySearch(searchText);
  const terms = discoverySearchTerms(query);

  return (
    terms.length === 0 || terms.some((term) => normalizedText.includes(term))
  );
}
