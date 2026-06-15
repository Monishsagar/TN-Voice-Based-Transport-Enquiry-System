import { Confidence, TransportMode } from "@/types";

/**
 * ============================================================
 * FARE ESTIMATION ENGINE
 * ============================================================
 * All formulas below are DETERMINISTIC and based on publicly
 * published tariff structures (TNSTC ordinary/express bus slabs,
 * Indian Railways general/sleeper class approximate per-km rates,
 * and typical metro city cab/auto per-km rates as of public
 * aggregator pricing). These are ESTIMATES, not live fares.
 *
 * Every estimate carries a `confidence` and `note` explaining the
 * basis, so the UI can communicate uncertainty honestly. When a
 * specific verified route record exists in `transport_routes`
 * (fare_base / fare_per_km from a cited source), THAT value should
 * be preferred over these generic estimates.
 * ============================================================
 */

export interface FareEstimate {
  amount: number | null;
  confidence: Confidence;
  note: string;
}

// TNSTC ordinary bus: published minimum fare + per-km slab (approximate, 2024 tariff structure)
const BUS_ORDINARY_BASE = 8; // INR minimum fare
const BUS_ORDINARY_PER_KM = 0.85;

// TNSTC express/deluxe roughly 1.4x ordinary per-km
const BUS_EXPRESS_PER_KM = 1.2;

// Indian Railways general/second-class unreserved: rough per-km slabs for short/medium distance
const TRAIN_GENERAL_PER_KM = 0.3;
const TRAIN_SLEEPER_PER_KM = 0.55;

// Typical app-cab per-km rates in TN cities (approximate, varies by city/surge)
const CAB_RATES: Record<string, { base: number; per_km: number }> = {
  mini: { base: 50, per_km: 11 },
  sedan: { base: 60, per_km: 14 },
  suv: { base: 90, per_km: 18 },
};

// Auto-rickshaw: typical metered rate in TN cities
const AUTO_BASE = 30;
const AUTO_PER_KM = 15;

export function estimateBusFare(distanceKm: number, express = false): FareEstimate {
  const perKm = express ? BUS_EXPRESS_PER_KM : BUS_ORDINARY_PER_KM;
  const amount = Math.max(BUS_ORDINARY_BASE, Math.round(distanceKm * perKm));
  return {
    amount,
    confidence: "medium",
    note: `Estimated from TNSTC ${express ? "express" : "ordinary"} per-km tariff (~₹${perKm}/km, ₹${BUS_ORDINARY_BASE} minimum). Actual fare may vary by exact stage/slab.`,
  };
}

export function estimateTrainFare(distanceKm: number, sleeper = false): FareEstimate {
  const perKm = sleeper ? TRAIN_SLEEPER_PER_KM : TRAIN_GENERAL_PER_KM;
  const amount = Math.max(10, Math.round(distanceKm * perKm));
  return {
    amount,
    confidence: "low",
    note: `Rough estimate based on Indian Railways ${sleeper ? "sleeper" : "general"} class per-km rate (~₹${perKm}/km). Actual fares depend on train type, quota, and distance slabs — verify on the IRCTC/National Train Enquiry System.`,
  };
}

export function estimateCabFare(distanceKm: number, type: "mini" | "sedan" | "suv"): FareEstimate {
  const rate = CAB_RATES[type];
  const amount = Math.round(rate.base + distanceKm * rate.per_km);
  return {
    amount,
    confidence: "medium",
    note: `Estimated using typical ${type.toUpperCase()} cab base fare (₹${rate.base}) + ₹${rate.per_km}/km. Surge pricing, tolls, and waiting charges not included.`,
  };
}

export function estimateAutoFare(distanceKm: number): FareEstimate {
  const amount = Math.round(AUTO_BASE + distanceKm * AUTO_PER_KM);
  return {
    amount,
    confidence: "medium",
    note: `Estimated using a typical auto-rickshaw base fare (₹${AUTO_BASE}) + ₹${AUTO_PER_KM}/km. Many drivers negotiate fares directly, especially for short/local trips.`,
  };
}

/**
 * For walking legs, fare is always free.
 */
export function estimateWalkFare(): FareEstimate {
  return { amount: 0, confidence: "high", note: "Walking — no fare." };
}

/**
 * Returns whether a given mode is realistically available for a
 * given distance, used to filter implausible suggestions
 * (e.g. don't suggest walking 40km, don't suggest auto for 300km).
 */
export function isModeViable(mode: TransportMode, distanceKm: number): boolean {
  switch (mode) {
    case "walk":
      return distanceKm <= 3;
    case "auto":
      return distanceKm <= 25;
    case "cab":
      return distanceKm <= 600;
    case "bus":
      return distanceKm <= 600;
    case "train":
        return distanceKm >= 8; // allow short suburban train hops (Chennai suburban) from ~8km
    default:
      return true;
  }
}
