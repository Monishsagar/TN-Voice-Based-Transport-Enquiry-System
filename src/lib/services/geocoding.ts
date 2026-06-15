import { Place } from "@/types";
import { normalizePlaceName } from "@/lib/language";
import { createClient } from "@/lib/supabase/server";

const NOMINATIM_URL =
  process.env.NEXT_PUBLIC_NOMINATIM_URL || "https://nominatim.openstreetmap.org";
const ORS_KEY = process.env.ORS_API_KEY || process.env.NEXT_PUBLIC_ORS_API_KEY || null;

const REQUEST_TIMEOUT_MS = 8000;

const TN_BOUNDS = {
  minLat: 8.0,
  maxLat: 13.6,
  minLng: 76.0,
  maxLng: 80.5,
};

const FALLBACK_PLACES: Place[] = [
  { name: "Chennai", lat: 13.0827, lng: 80.2707, district: "Chennai", place_type: "city" },
  { name: "Coimbatore", lat: 11.0168, lng: 76.9558, district: "Coimbatore", place_type: "city" },
  { name: "Madurai", lat: 9.9252, lng: 78.1198, district: "Madurai", place_type: "city" },
  { name: "Trichy", lat: 10.7905, lng: 78.7047, district: "Tiruchirappalli", place_type: "city" },
  { name: "Tiruchirappalli", lat: 10.7905, lng: 78.7047, district: "Tiruchirappalli", place_type: "city" },
  { name: "Salem", lat: 11.6643, lng: 78.146, district: "Salem", place_type: "city" },
  { name: "Tirunelveli", lat: 8.7139, lng: 77.7567, district: "Tirunelveli", place_type: "city" },
  { name: "Vellore", lat: 12.9165, lng: 79.1325, district: "Vellore", place_type: "city" },
  { name: "Erode", lat: 11.341, lng: 77.7172, district: "Erode", place_type: "city" },
  { name: "Thanjavur", lat: 10.787, lng: 79.1378, district: "Thanjavur", place_type: "city" },
  { name: "Kanchipuram", lat: 12.8342, lng: 79.7036, district: "Kanchipuram", place_type: "town" },
  { name: "Pondicherry", lat: 11.9416, lng: 79.8083, district: "Puducherry", place_type: "city" },
  { name: "Puducherry", lat: 11.9416, lng: 79.8083, district: "Puducherry", place_type: "city" },
  { name: "Tambaram", lat: 12.9249, lng: 80.1, district: "Chengalpattu", place_type: "town" },
  { name: "Guindy", lat: 13.0067, lng: 80.2206, district: "Chennai", place_type: "landmark" },
  { name: "Chromepet", lat: 12.9516, lng: 80.1462, district: "Chengalpattu", place_type: "town" },
  { name: "Pallavaram", lat: 12.9675, lng: 80.1491, district: "Chengalpattu", place_type: "town" },
  { name: "Padappai", lat: 12.8932, lng: 80.0395, district: "Kanchipuram", place_type: "town" },
  { name: "Purisai", lat: 12.6682, lng: 79.6507, district: "Tiruvannamalai", place_type: "village" },
  { name: "Tiruppur", lat: 11.1085, lng: 77.3411, district: "Tiruppur", place_type: "city" },
  { name: "Kumbakonam", lat: 10.9602, lng: 79.3845, district: "Thanjavur", place_type: "town" },
  { name: "Sivakasi", lat: 9.4496, lng: 77.7975, district: "Virudhunagar", place_type: "town" },
  { name: "Rameswaram", lat: 9.2876, lng: 79.3129, district: "Ramanathapuram", place_type: "town" },
  { name: "Kodaikanal", lat: 10.2381, lng: 77.4892, district: "Dindigul", place_type: "town" },
  { name: "Mahabalipuram", lat: 12.6269, lng: 80.1927, district: "Chengalpattu", place_type: "town" },
  { name: "Yercaud", lat: 11.7753, lng: 78.2095, district: "Salem", place_type: "village" },
  { name: "Karaikudi", lat: 10.0738, lng: 78.7868, district: "Sivaganga", place_type: "town" },
  { name: "Pollachi", lat: 10.6589, lng: 77.0083, district: "Coimbatore", place_type: "town" },
  { name: "Dindigul", lat: 10.3624, lng: 77.9695, district: "Dindigul", place_type: "city" },
  { name: "Nagercoil", lat: 8.1833, lng: 77.4119, district: "Kanyakumari", place_type: "town" },
];

/**
 * Resolves a free-text place name to coordinates, in this order:
 * 1. Local Supabase `places` table (fast, curated TN data — fuzzy match)
 * 2. Nominatim geocoding restricted to Tamil Nadu, India
 *
 * Returns null if neither source can confidently resolve the place.
 */
export async function resolvePlace(rawInput: string): Promise<Place | null> {
  const normalized = normalizePlaceName(rawInput);

  // 1. Try local curated DB first (fast + accurate for known stops)
  const dbResult = await withTimeout(searchLocalPlaces(normalized), 1800, null);
  if (dbResult) return dbResult;

  // 2. Use bundled major-place coordinates if the database is unavailable.
  const fallbackResult = searchFallbackPlaces(normalized);
  if (fallbackResult) return fallbackResult;

  // 3. Use OpenRouteService geocoding when configured. It is often better for small localities.
  const orsResult = await searchOpenRouteService(normalized, rawInput);
  if (orsResult) return orsResult;

  // 4. Fallback to Nominatim, scoped to Tamil Nadu/Puducherry.
  const geoResult = await searchNominatim(normalized, rawInput);
  if (geoResult) return geoResult;

  // 5. Last attempt with raw (un-normalized) input via Nominatim
  if (normalized !== rawInput) {
    return await searchNominatim(rawInput, rawInput);
  }

  return null;
}

async function searchOpenRouteService(query: string, rawInput = query): Promise<Place | null> {
  if (!ORS_KEY) return null;

  try {
    const attempts = [cleanVillageQuery(query), cleanVillageQuery(rawInput)]
      .filter(Boolean)
      .filter((value, index, arr) => arr.findIndex((item) => item.toLowerCase() === value.toLowerCase()) === index);

    for (const text of attempts) {
      const url = new URL("https://api.openrouteservice.org/geocode/search");
      url.searchParams.set("api_key", ORS_KEY);
      url.searchParams.set("text", `${text}, Tamil Nadu, India`);
      url.searchParams.set("boundary.country", "IN");
      url.searchParams.set("boundary.rect.min_lon", String(TN_BOUNDS.minLng));
      url.searchParams.set("boundary.rect.min_lat", String(TN_BOUNDS.minLat));
      url.searchParams.set("boundary.rect.max_lon", String(TN_BOUNDS.maxLng));
      url.searchParams.set("boundary.rect.max_lat", String(TN_BOUNDS.maxLat));
      url.searchParams.set("size", "8");

      const res = await fetchWithTimeout(url.toString(), {
        headers: { Accept: "application/json" },
        next: { revalidate: 60 * 60 * 24 },
      });
      if (!res.ok) continue;

      const data = await res.json();
      const features = Array.isArray(data.features) ? data.features : [];
      const feature = pickBestORSFeature(features);
      if (!feature) continue;

      const coords = feature.geometry?.coordinates;
      const lng = Number(coords?.[0]);
      const lat = Number(coords?.[1]);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;

      return {
        name: feature.properties?.locality || feature.properties?.name || feature.properties?.label?.split(",")?.[0] || text,
        lat,
        lng,
        district: feature.properties?.county || feature.properties?.region,
        place_type: mapORSType(feature.properties?.layer),
      };
    }
  } catch {
    return null;
  }

  return null;
}

function pickBestORSFeature(features: any[]): any | null {
  const supported = features.filter((feature) => {
    const coords = feature.geometry?.coordinates;
    const lng = Number(coords?.[0]);
    const lat = Number(coords?.[1]);
    return (
      Number.isFinite(lat) &&
      Number.isFinite(lng) &&
      lat >= TN_BOUNDS.minLat &&
      lat <= TN_BOUNDS.maxLat &&
      lng >= TN_BOUNDS.minLng &&
      lng <= TN_BOUNDS.maxLng
    );
  });

  if (supported.length === 0) return null;
  return (
    supported.find((feature) => ["locality", "localadmin", "neighbourhood", "venue"].includes(feature.properties?.layer)) ??
    supported.find((feature) => ["county", "region"].includes(feature.properties?.layer)) ??
    supported[0]
  );
}

function mapORSType(layer: string | undefined): Place["place_type"] {
  switch (layer) {
    case "locality":
    case "localadmin":
      return "village";
    case "neighbourhood":
    case "venue":
      return "landmark";
    case "county":
    case "region":
      return "town";
    default:
      return "village";
  }
}

function searchFallbackPlaces(query: string): Place | null {
  const q = query.toLowerCase().trim();
  return (
    FALLBACK_PLACES.find((place) => place.name.toLowerCase() === q) ??
    FALLBACK_PLACES.find((place) => place.name.toLowerCase().includes(q) || q.includes(place.name.toLowerCase())) ??
    null
  );
}

async function searchLocalPlaces(query: string): Promise<Place | null> {
  try {
    const supabase = createClient();
    // 1) Try name or Tamil name fuzzy match
    let res = await supabase
      .from("places")
      .select("id, name, name_ta, lat, lng, district, place_type, aliases")
      .or(`name.ilike.%${query}%,name_ta.ilike.%${query}%`)
      .limit(1);

    // 2) If not found, try aliases array contains (exact alias)
    if (!res.data || res.data.length === 0) {
      const aliasQ = query.toLowerCase();
      res = await supabase
        .from("places")
        .select("id, name, name_ta, lat, lng, district, place_type, aliases")
        .filter("aliases", "cs", `{${aliasQ}}`)
        .limit(1);
    }

    // 3) If still not found, try a loose text scan on aliases by using name ilike again
    if (!res.data || res.data.length === 0) {
      res = await supabase
        .from("places")
        .select("id, name, name_ta, lat, lng, district, place_type, aliases")
        .ilike("name", `%${query}%`)
        .limit(1);
    }

    if (res.error || !res.data || res.data.length === 0) return null;

    const row = res.data[0];
    return {
      id: row.id,
      name: row.name,
      name_ta: row.name_ta,
      lat: row.lat,
      lng: row.lng,
      district: row.district,
      place_type: row.place_type,
    };
  } catch {
    return null;
  }
}

async function searchNominatim(query: string, rawInput = query): Promise<Place | null> {
  try {
    const attempts = buildNominatimQueries(query, rawInput);

    for (const attempt of attempts) {
      const url = new URL(`${NOMINATIM_URL}/search`);
      url.searchParams.set("q", attempt.q);
      url.searchParams.set("format", "json");
      url.searchParams.set("limit", "8");
      url.searchParams.set("addressdetails", "1");
      url.searchParams.set("countrycodes", "in");
      url.searchParams.set("dedupe", "1");
      if (attempt.bounded) {
        // lon-left, lat-bottom, lon-right, lat-top
        url.searchParams.set("viewbox", `${TN_BOUNDS.minLng},${TN_BOUNDS.minLat},${TN_BOUNDS.maxLng},${TN_BOUNDS.maxLat}`);
        url.searchParams.set("bounded", "1");
      }

      const res = await fetchWithTimeout(url.toString(), {
        headers: {
          "User-Agent": "TN-Transport-Enquiry/1.0 (educational project)",
          "Accept-Language": "en",
        },
        next: { revalidate: 60 * 60 * 24 }, // cache geocoding results for 24h
      });

      if (!res.ok) continue;

      const data = await res.json();
      if (!Array.isArray(data) || data.length === 0) continue;

      const result = pickBestNominatimResult(data);
      if (!result) continue;

      const lat = parseFloat(result.lat);
      const lng = parseFloat(result.lon);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;

      return {
        name: getNominatimPlaceName(result, query),
        lat,
        lng,
        district: getNominatimDistrict(result),
        place_type: mapNominatimType(result.type || result.addresstype),
      };
    }

    return null;
  } catch {
    return null;
  }
}

function buildNominatimQueries(query: string, rawInput: string): { q: string; bounded: boolean }[] {
  const cleaned = cleanVillageQuery(query);
  const rawCleaned = cleanVillageQuery(rawInput);
  const unique = new Set<string>();
  const attempts: { q: string; bounded: boolean }[] = [];

  for (const q of [
    `${cleaned}, Tamil Nadu, India`,
    `${cleaned} village, Tamil Nadu, India`,
    `${cleaned} locality, Tamil Nadu, India`,
    `${cleaned}, Puducherry, India`,
    rawCleaned !== cleaned ? `${rawCleaned}, Tamil Nadu, India` : "",
    `${cleaned}, India`,
  ]) {
    if (!q.trim() || unique.has(q.toLowerCase())) continue;
    unique.add(q.toLowerCase());
    attempts.push({ q, bounded: !q.endsWith(", India") || q.includes("Tamil Nadu") || q.includes("Puducherry") });
  }

  return attempts;
}

function cleanVillageQuery(query: string): string {
  return query
    .replace(/\b(village|gramam|panchayat|taluk|district|dt|near|bus stop|bus stand)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function pickBestNominatimResult(results: any[]): any | null {
  const inSupportedRegion = results.filter((result) => isSupportedNominatimRegion(result));
  const candidates = inSupportedRegion.length ? inSupportedRegion : results.filter((result) => isInsideTamilNaduBounds(result));
  if (candidates.length === 0) return null;

  // If the only candidate is a state-level administrative result (e.g. "Tamil Nadu"),
  // return null so callers can try other attempts instead of resolving to the whole state.
  if (
    candidates.length === 1 &&
    candidates[0].type === "administrative" &&
    String(candidates[0].display_name ?? "").toLowerCase().includes("tamil nadu")
  ) {
    return null;
  }

  return (
    candidates.find((result) => ["village", "hamlet", "locality", "suburb", "neighbourhood"].includes(result.type)) ??
    candidates.find((result) => ["town", "city", "administrative"].includes(result.type)) ??
    candidates[0]
  );
}

function isSupportedNominatimRegion(result: any): boolean {
  const address = result.address ?? {};
  const state = String(address.state ?? address.region ?? "").toLowerCase();
  const display = String(result.display_name ?? "").toLowerCase();
  return (
    state.includes("tamil nadu") ||
    state.includes("puducherry") ||
    display.includes("tamil nadu") ||
    display.includes("puducherry")
  );
}

function isInsideTamilNaduBounds(result: any): boolean {
  const lat = parseFloat(result.lat);
  const lng = parseFloat(result.lon);
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= TN_BOUNDS.minLat &&
    lat <= TN_BOUNDS.maxLat &&
    lng >= TN_BOUNDS.minLng &&
    lng <= TN_BOUNDS.maxLng
  );
}

function getNominatimPlaceName(result: any, fallback: string): string {
  const address = result.address ?? {};
  return (
    address.village ||
    address.hamlet ||
    address.locality ||
    address.suburb ||
    address.town ||
    address.city ||
    result.name ||
    result.display_name?.split(",")[0] ||
    fallback
  );
}

function getNominatimDistrict(result: any): string | undefined {
  const address = result.address ?? {};
  return address.county || address.state_district || address.district || undefined;
}

async function fetchWithTimeout(input: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(fallback), ms);
    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch(() => {
        clearTimeout(timer);
        resolve(fallback);
      });
  });
}

function mapNominatimType(type: string): Place["place_type"] {
  switch (type) {
    case "city":
    case "administrative":
      return "city";
    case "town":
      return "town";
    case "village":
    case "hamlet":
      return "village";
    case "bus_station":
      return "bus_stop";
    case "railway_station":
      return "railway_station";
    default:
      return "landmark";
  }
}

/**
 * Haversine distance in km between two points.
 */
export function haversineKm(a: Place, b: Place): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;

  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);

  const c =
    sinDLat * sinDLat +
    Math.cos(lat1) * Math.cos(lat2) * sinDLng * sinDLng;
  const d = 2 * Math.atan2(Math.sqrt(c), Math.sqrt(1 - c));

  return R * d;
}
