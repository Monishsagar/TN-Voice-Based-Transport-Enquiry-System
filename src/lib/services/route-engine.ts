import { Place, RouteLeg, RouteOption, RouteSearchResult, TransportMode } from "@/types";
import { getOSRMRoute } from "@/lib/services/routing";
import { haversineKm } from "@/lib/services/geocoding";
import {
  estimateAutoFare,
  estimateBusFare,
  estimateCabFare,
  estimateTrainFare,
  estimateWalkFare,
  isModeViable,
} from "@/lib/services/fare-estimation";
import { createClient } from "@/lib/supabase/server";

/**
 * ============================================================
 * ROUTE ENGINE
 * ============================================================
 * Builds candidate multi-modal route options between two places.
 *
 * Strategy:
 * 1. Query `transport_routes` for any VERIFIED bus/train routes
 *    that connect (or pass near) source & destination. If found,
 *    these are used with their cited fare/frequency data
 *    (high/medium confidence).
 * 2. If no verified route exists, fall back to GENERIC mode
 *    estimates (bus/train/cab/auto) computed from road distance
 *    via OSRM, clearly marked as estimates with `data_confidence:
 *    "low"` and an explanation.
 * 3. Never invents route numbers, timings, or operators that
 *    aren't in the database.
 * ============================================================
 */

const DATA_SOURCES = [
  "OpenStreetMap / OSRM (road distance & geometry)",
  "Nominatim (place geocoding)",
  "Supabase `transport_routes` table (curated TNSTC/Railway reference data, where available)",
  "Bundled Chennai suburban rail corridor hints for known station pairs",
  "Deterministic fare estimation model (see fare-estimation.ts) for unverified segments",
];

const CHENNAI_SUBURBAN_SOUTH_STATIONS = new Set([
  "chennai",
  "chennai beach",
  "chennai egmore",
  "mambalam",
  "guindy",
  "st thomas mount",
  "pallavaram",
  "chromepet",
  "tambaram",
  "vandalur",
  "chengalpattu",
  // common suburban stops often used in local searches
  "pazhavanthangal",
  "potheri",
  "velachery",
]);

export async function generateRouteOptions(
  source: Place,
  destination: Place
): Promise<RouteSearchResult> {
  const straightLineKm = haversineKm(source, destination);

  // Attempt road routing for an accurate distance/duration baseline
  const osrm = await getOSRMRoute(source, destination, "driving");
  const roadDistanceKm = osrm?.distance_km ?? straightLineKm * 1.25; // 1.25x factor approximates road windiness
  const roadDurationMin = osrm?.duration_min ?? (roadDistanceKm / 40) * 60; // assume 40km/h avg if OSRM unavailable
  const polyline = osrm?.polyline ?? buildFallbackPolyline(source, destination);

  const options: RouteOption[] = [];

  // -------------------------------------------------------
  // 1. Check for verified transport routes in DB
  // -------------------------------------------------------
  const verifiedRoutes = await withTimeout(findVerifiedRoutes(source, destination), 3500, []);

  for (const route of verifiedRoutes) {
    options.push(buildOptionFromVerifiedRoute(route, source, destination, polyline));
  }

  if (!verifiedRoutes.some((r) => r.mode === "train") && isChennaiSuburbanSouthPair(source, destination)) {
    options.push(buildSuburbanTrainOption(source, destination, roadDistanceKm, roadDurationMin * 0.75, polyline));
  }

  // -------------------------------------------------------
  // 2. Generic single-mode estimates (always offered for comparison)
  // -------------------------------------------------------
  if (isModeViable("bus", roadDistanceKm)) {
    options.push(
      buildGenericOption("bus", source, destination, roadDistanceKm, roadDurationMin, polyline)
    );
  }

  if (isModeViable("train", roadDistanceKm) && roadDistanceKm > 30) {
    // Only suggest generic train if no verified train route exists and distance is meaningful
    const hasTrain = verifiedRoutes.some((r) => r.mode === "train") || options.some((o) => o.legs.some((l) => l.mode === "train"));
    if (!hasTrain) {
      options.push(
        buildGenericOption("train", source, destination, roadDistanceKm, roadDurationMin * 0.85, polyline, true)
      );
    }
  }

  for (const cabType of ["mini", "sedan", "suv"] as const) {
    if (isModeViable("cab", roadDistanceKm)) {
      options.push(
        buildCabOption(cabType, source, destination, roadDistanceKm, roadDurationMin, polyline)
      );
    }
  }

  if (isModeViable("auto", roadDistanceKm)) {
    options.push(
      buildGenericOption("auto", source, destination, roadDistanceKm, roadDurationMin * 1.1, polyline)
    );
  }

  if (isModeViable("walk", roadDistanceKm)) {
    options.push(
      buildGenericOption("walk", source, destination, roadDistanceKm, (roadDistanceKm / 5) * 60, polyline)
    );
  }

  // -------------------------------------------------------
  // 3. Score and tag options
  // -------------------------------------------------------
  tagOptions(options);

  return {
    source,
    destination,
    straight_line_distance_km: Math.round(straightLineKm * 10) / 10,
    options,
    generated_at: new Date().toISOString(),
    data_sources: DATA_SOURCES,
    disclaimer:
      "Fares and timings shown are ESTIMATES based on public tariff structures and road-distance modeling, unless explicitly marked as verified from a curated dataset. Always confirm with the operator before travel.",
  };
}

function isChennaiSuburbanSouthPair(source: Place, destination: Place): boolean {
  return (
    CHENNAI_SUBURBAN_SOUTH_STATIONS.has(source.name.toLowerCase()) &&
    CHENNAI_SUBURBAN_SOUTH_STATIONS.has(destination.name.toLowerCase())
  );
}

function buildSuburbanTrainOption(
  source: Place,
  destination: Place,
  distanceKm: number,
  durationMin: number,
  polyline?: [number, number][]
): RouteOption {
  const fare = estimateTrainFare(distanceKm, false);
  const leg: RouteLeg = {
    mode: "train",
    from: source,
    to: destination,
    distance_km: Math.round(distanceKm * 10) / 10,
    duration_min: Math.max(8, Math.round(durationMin)),
    fare_estimate: fare.amount,
    fare_confidence: "low",
    fare_note:
      "Estimated local rail fare. This app does not have live suburban train timetable data; verify current trains before travel.",
    line_label: "Chennai Suburban Rail - South Line",
    operator: "Southern Railway",
    polyline,
    data_confidence: "medium",
    data_note:
      "Known Chennai suburban rail corridor pair. Train number, platform, and live timing are not available in this dataset.",
  };

  return {
    id: `suburban-train-${source.name}-${destination.name}`,
    label: "Train (Chennai suburban estimate)",
    legs: [leg],
    total_distance_km: leg.distance_km,
    total_duration_min: leg.duration_min,
    total_fare_estimate: fare.amount,
    fare_confidence: "low",
    transfers: 0,
    safety_score: computeSafetyScore(0, false),
    overall_confidence: "medium",
    confidence_reason: leg.data_note ?? "",
    tags: [],
  };
}

function buildFallbackPolyline(source: Place, destination: Place): [number, number][] {
  return [
    [source.lat, source.lng],
    [destination.lat, destination.lng],
  ];
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

// ============================================================
// VERIFIED ROUTE LOOKUP
// ============================================================

interface VerifiedRouteRow {
  id: string;
  mode: "bus" | "train";
  route_number: string | null;
  route_name: string | null;
  operator: string | null;
  fare_base: number | null;
  fare_per_km: number | null;
  frequency_minutes: number | null;
  first_departure: string | null;
  last_departure: string | null;
  data_confidence: "high" | "medium" | "low";
  source: string | null;
}

async function findVerifiedRoutes(source: Place, destination: Place): Promise<VerifiedRouteRow[]> {
  if (!source.id || !destination.id) return [];

  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("transport_routes")
      .select(
        "id, mode, route_number, route_name, operator, fare_base, fare_per_km, frequency_minutes, first_departure, last_departure, data_confidence, source"
      )
      .eq("origin_place_id", source.id)
      .eq("destination_place_id", destination.id)
      .limit(5);

    if (error || !data) return [];
    return data as VerifiedRouteRow[];
  } catch {
    return [];
  }
}

function buildOptionFromVerifiedRoute(
  route: VerifiedRouteRow,
  source: Place,
  destination: Place,
  polyline?: [number, number][]
): RouteOption {
  const distanceKm = haversineKm(source, destination) * 1.25;
  const duration = route.mode === "train" ? (distanceKm / 55) * 60 : (distanceKm / 35) * 60;

  let fare: number | null = null;
  let fareConfidence: "high" | "medium" | "low" = route.data_confidence;
  let fareNote = "";

  if (route.fare_base !== null && route.fare_per_km !== null) {
    fare = Math.round(route.fare_base + route.fare_per_km * distanceKm);
    fareNote = `Verified tariff structure from ${route.source ?? "curated dataset"}.`;
  } else {
    const est = route.mode === "bus" ? estimateBusFare(distanceKm) : estimateTrainFare(distanceKm);
    fare = est.amount;
    fareConfidence = "low";
    fareNote = `Route verified, but fare not in dataset — ${est.note}`;
  }

  const leg: RouteLeg = {
    mode: route.mode,
    from: source,
    to: destination,
    distance_km: Math.round(distanceKm * 10) / 10,
    duration_min: Math.round(duration),
    fare_estimate: fare,
    fare_confidence: fareConfidence,
    fare_note: fareNote,
    line_label: route.route_number
      ? `${route.route_number}${route.route_name ? " - " + route.route_name : ""}`
      : route.route_name || undefined,
    operator: route.operator || undefined,
    route_number: route.route_number || undefined,
    frequency_minutes: route.frequency_minutes,
    first_departure: route.first_departure,
    last_departure: route.last_departure,
    source_reference: route.source,
    polyline,
    data_confidence: route.data_confidence,
    data_note:
      route.data_confidence === "high"
        ? `Verified ${route.mode} route from ${route.source ?? "operator data"}.`
        : `Route exists in dataset but some details (timings/fare) may be approximate. Source: ${route.source ?? "unspecified"}.`,
  };

  return {
    id: `verified-${route.id}`,
    label: route.route_number
      ? `${route.mode === "bus" ? "Bus" : "Train"} ${route.route_number}`
      : `Direct ${route.mode}`,
    legs: [leg],
    total_distance_km: leg.distance_km,
    total_duration_min: leg.duration_min,
    total_fare_estimate: fare,
    fare_confidence: fareConfidence,
    transfers: 0,
    safety_score: computeSafetyScore(0, false),
    overall_confidence: route.data_confidence,
    confidence_reason:
      route.data_confidence === "high"
        ? "Based on verified operator/timetable data."
        : "Route confirmed to exist, but fare/timing details are partly estimated.",
    tags: [],
  };
}

// ============================================================
// GENERIC SINGLE-MODE OPTIONS
// ============================================================

function buildGenericOption(
  mode: TransportMode,
  source: Place,
  destination: Place,
  distanceKm: number,
  durationMin: number,
  polyline?: [number, number][],
  isExpressTrain = false
): RouteOption {
  let fare;
  let label: string;

  switch (mode) {
    case "bus":
      fare = estimateBusFare(distanceKm, distanceKm > 80);
      label = distanceKm > 80 ? "Bus (Express/Deluxe estimate)" : "Bus (Ordinary estimate)";
      break;
    case "train":
      fare = estimateTrainFare(distanceKm, isExpressTrain);
      label = "Train (general estimate — verify schedule)";
      break;
    case "auto":
      fare = estimateAutoFare(distanceKm);
      label = "Auto-rickshaw";
      break;
    case "walk":
      fare = estimateWalkFare();
      label = "Walking";
      break;
    default:
      fare = { amount: null, confidence: "low" as const, note: "No estimation model for this mode." };
      label = mode;
  }

  const leg: RouteLeg = {
    mode,
    from: source,
    to: destination,
    distance_km: Math.round(distanceKm * 10) / 10,
    duration_min: Math.round(durationMin),
    fare_estimate: fare.amount,
    fare_confidence: fare.confidence,
    fare_note: fare.note,
    polyline,
    data_confidence: mode === "train" ? "low" : "medium",
    data_note:
      mode === "train"
        ? "No specific train route found in dataset for this pair — distance/time is road-based and may not reflect actual rail alignment or schedule. Please verify on the National Train Enquiry System."
        : `No specific ${mode} route record in dataset; distance and duration are road-network estimates from OpenStreetMap/OSRM.`,
  };

  return {
    id: `generic-${mode}-${source.name}-${destination.name}`,
    label,
    legs: [leg],
    total_distance_km: leg.distance_km,
    total_duration_min: leg.duration_min,
    total_fare_estimate: fare.amount,
    fare_confidence: fare.confidence,
    transfers: 0,
    safety_score: computeSafetyScore(0, false),
    overall_confidence: leg.data_confidence,
    confidence_reason: leg.data_note ?? "",
    tags: [],
  };
}

function buildCabOption(
  type: "mini" | "sedan" | "suv",
  source: Place,
  destination: Place,
  distanceKm: number,
  durationMin: number,
  polyline?: [number, number][]
): RouteOption {
  const fare = estimateCabFare(distanceKm, type);

  const leg: RouteLeg = {
    mode: "cab",
    from: source,
    to: destination,
    distance_km: Math.round(distanceKm * 10) / 10,
    duration_min: Math.round(durationMin),
    fare_estimate: fare.amount,
    fare_confidence: fare.confidence,
    fare_note: fare.note,
    line_label: type.toUpperCase(),
    polyline,
    data_confidence: "medium",
    data_note: "Cab fare estimated from typical per-km app-cab pricing; actual fare depends on provider, surge, and tolls.",
  };

  return {
    id: `cab-${type}-${source.name}-${destination.name}`,
    label: `Cab (${type.toUpperCase()})`,
    legs: [leg],
    total_distance_km: leg.distance_km,
    total_duration_min: leg.duration_min,
    total_fare_estimate: fare.amount,
    fare_confidence: fare.confidence,
    transfers: 0,
    safety_score: computeSafetyScore(0, false),
    overall_confidence: "medium",
    confidence_reason: leg.data_note ?? "",
    tags: [],
  };
}

// ============================================================
// SCORING & TAGGING
// ============================================================

/**
 * Safety score (0-100): penalizes higher transfer counts and
 * (when known) late-night travel. Higher = safer/more convenient.
 * This is a heuristic, not a guarantee.
 */
function computeSafetyScore(transfers: number, lateNight: boolean): number {
  let score = 90;
  score -= transfers * 12;
  if (lateNight) score -= 20;
  return Math.max(10, Math.min(100, score));
}

function tagOptions(options: RouteOption[]): void {
  if (options.length === 0) return;

  const withFare = options.filter((o) => o.total_fare_estimate !== null);
  const cheapest = withFare.length
    ? withFare.reduce((a, b) => (a.total_fare_estimate! < b.total_fare_estimate! ? a : b))
    : null;

  const fastest = options.reduce((a, b) => (a.total_duration_min < b.total_duration_min ? a : b));

  const leastWalking = options.reduce((a, b) => {
    const aWalk = a.legs.filter((l) => l.mode === "walk").reduce((s, l) => s + l.distance_km, 0);
    const bWalk = b.legs.filter((l) => l.mode === "walk").reduce((s, l) => s + l.distance_km, 0);
    return aWalk <= bWalk ? a : b;
  });

  if (cheapest) cheapest.tags.push("cheapest");
  fastest.tags.push("fastest");
  if (leastWalking.id !== fastest.id) leastWalking.tags.push("least_walking");

  // Best Choice: balances normalized cost, time, and safety
  const maxFare = Math.max(...options.map((o) => o.total_fare_estimate ?? 0), 1);
  const maxDuration = Math.max(...options.map((o) => o.total_duration_min), 1);

  let bestChoice = options[0];
  let bestScore = -Infinity;

  for (const opt of options) {
    const fareNorm = opt.total_fare_estimate !== null ? opt.total_fare_estimate / maxFare : 0.5;
    const durationNorm = opt.total_duration_min / maxDuration;
    const safetyNorm = opt.safety_score / 100;

    // Lower fare & duration is better; higher safety is better.
    const score = (1 - fareNorm) * 0.35 + (1 - durationNorm) * 0.35 + safetyNorm * 0.3;

    if (score > bestScore) {
      bestScore = score;
      bestChoice = opt;
    }
  }

  bestChoice.tags.push("best_choice");
}
