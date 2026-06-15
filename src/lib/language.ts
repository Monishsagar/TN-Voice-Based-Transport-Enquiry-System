// ============================================================
// LANGUAGE & PLACE-NAME NORMALIZATION
// Handles English, Tamil script, and Tanglish (Tamil typed in
// Latin letters) inputs for place matching.
// ============================================================

/**
 * Common Tanglish/English transliteration variants mapped to a
 * canonical English place name. This is a deterministic lookup —
 * extend this table as more places are added to the DB.
 */
export const PLACE_ALIASES: Record<string, string> = {
  chennai: "Chennai",
  chenai: "Chennai",
  chennais: "Chennai",
  madras: "Chennai",
  sennai: "Chennai",
  kovai: "Coimbatore",
  coimbatore: "Coimbatore",
  cbe: "Coimbatore",
  madurai: "Madurai",
  trichy: "Tiruchirappalli",
  tiruchi: "Tiruchirappalli",
  tiruchirappalli: "Tiruchirappalli",
  salem: "Salem",
  nellai: "Tirunelveli",
  tirunelveli: "Tirunelveli",
  vellore: "Vellore",
  erode: "Erode",
  tanjore: "Thanjavur",
  thanjavur: "Thanjavur",
  kanchi: "Kanchipuram",
  kanchipuram: "Kanchipuram",
  pondy: "Puducherry",
  pondicherry: "Puducherry",
  puducherry: "Puducherry",
  tirupur: "Tiruppur",
  tiruppur: "Tiruppur",
  tambaram: "Tambaram",
  guindy: "Guindy",
  chromepet: "Chromepet",
  pallavaram: "Pallavaram",
  padappai: "Padappai",
  purisai: "Purisai",
};

/**
 * Detects whether the input string is primarily Tamil script.
 */
export function isTamilScript(text: string): boolean {
  return /[\u0B80-\u0BFF]/.test(text);
}

/**
 * Basic Tamil-script transliteration map for common place name
 * fragments → Latin equivalents. This is intentionally small and
 * deterministic; for full transliteration, a dedicated library
 * would be wired in here.
 */
const TAMIL_TO_LATIN_FRAGMENTS: [RegExp, string][] = [
  [/சென்னை/g, "chennai"],
  [/கோயம்புத்தூர்/g, "coimbatore"],
  [/மதுரை/g, "madurai"],
  [/திருச்சி/g, "tiruchirappalli"],
  [/சேலம்/g, "salem"],
  [/திருநெல்வேலி/g, "tirunelveli"],
  [/வேலூர்/g, "vellore"],
  [/ஈரோடு/g, "erode"],
  [/தஞ்சாவூர்/g, "thanjavur"],
  [/காஞ்சிபுரம்/g, "kanchipuram"],
  [/புதுச்சேரி/g, "puducherry"],
  [/திருப்பூர்/g, "tiruppur"],
];

/**
 * Normalizes a free-text place name (English, Tamil, or Tanglish)
 * into a canonical search term suitable for DB lookup / geocoding.
 */
export function normalizePlaceName(input: string): string {
  let text = input.trim().toLowerCase();

  if (isTamilScript(input)) {
    for (const [pattern, replacement] of TAMIL_TO_LATIN_FRAGMENTS) {
      text = text.replace(pattern, replacement);
    }
  }

  // Strip common filler words from voice input
  text = text
    .replace(/\b(to|from|going|near|station|bus stand|please|enna|irukku)\b/gi, "")
    .trim();

  // Apply alias mapping if there's a direct or partial match
  const directMatch = PLACE_ALIASES[text];
  if (directMatch) return directMatch;

  // Try matching any alias as a substring (handles "kovai bus stand" etc.)
  for (const [alias, canonical] of Object.entries(PLACE_ALIASES)) {
    if (text.includes(alias)) return canonical;
  }

  // Fall back to title-cased input
  return input
    .trim()
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

/**
 * Parses a natural-language query like "Chennai to Madurai" or
 * "சென்னை இருந்து மதுரை" or "chennai la irundhu madurai ku eppadi"
 * into source/destination strings. Returns null if it can't
 * confidently split the query.
 */
export function parseSourceDestination(
  query: string
): { source: string; destination: string } | null {
  const text = query.trim();

  // Patterns: "X to Y", "X -> Y", "X se Y", Tanglish "X la irundhu Y ku"
  const patterns = [
    /^(.+?)\s+(?:to|->|→)\s+(.+)$/i,
    /^(.+?)\s+(?:la\s+)?irundhu\s+(.+?)\s*(?:ku|kku)?$/i,
    /^(.+?)\s+இருந்து\s+(.+?)\s*(?:க்கு)?$/i,
    /^(.+?)\s+(?:from)\s+(.+)$/i, // "Madurai from Chennai" → reversed below
  ];

  for (let i = 0; i < patterns.length; i++) {
    const match = text.match(patterns[i]);
    if (match) {
      const [, a, b] = match;
      // The "from" pattern is reversed: destination first
      if (i === 3) {
        return { source: b.trim(), destination: a.trim() };
      }
      return { source: a.trim(), destination: b.trim() };
    }
  }

  return null;
}

/**
 * UI string dictionary for instant English/Tamil switching.
 */
export const UI_STRINGS: Record<"en" | "ta", Record<string, string>> = {
  en: {
    appName: "TN Transport Enquiry",
    searchPlaceholder: "e.g. Chennai to Madurai",
    source: "From",
    destination: "To",
    search: "Search Routes",
    voiceSearch: "Voice Search",
    listening: "Listening...",
    bestChoice: "Best Choice",
    cheapest: "Cheapest",
    fastest: "Fastest",
    leastWalking: "Least Walking",
    transfers: "Transfers",
    distance: "Distance",
    duration: "Duration",
    fare: "Estimated Fare",
    confidence: "Confidence",
    chatPlaceholder: "Ask about this route...",
    noResults: "No verified route data found for this pair yet.",
    dataUncertain: "Data confidence is low for this segment.",
  },
  ta: {
    appName: "தமிழ்நாடு போக்குவரத்து விசாரணை",
    searchPlaceholder: "எ.கா. சென்னை முதல் மதுரை",
    source: "இருந்து",
    destination: "வரை",
    search: "வழிகளைத் தேடு",
    voiceSearch: "குரல் தேடல்",
    listening: "கேட்கிறது...",
    bestChoice: "சிறந்த தேர்வு",
    cheapest: "மிகக் குறைந்த விலை",
    fastest: "வேகமானது",
    leastWalking: "குறைந்த நடைபயணம்",
    transfers: "இடமாற்றங்கள்",
    distance: "தொலைவு",
    duration: "கால அளவு",
    fare: "மதிப்பிடப்பட்ட கட்டணம்",
    confidence: "நம்பகத்தன்மை",
    chatPlaceholder: "இந்த வழி பற்றி கேளுங்கள்...",
    noResults: "இந்த இரு இடங்களுக்கும் சரிபார்க்கப்பட்ட தரவு இல்லை.",
    dataUncertain: "இந்தப் பகுதிக்கான தரவு நம்பகத்தன்மை குறைவு.",
  },
};

export type UILanguage = keyof typeof UI_STRINGS;
