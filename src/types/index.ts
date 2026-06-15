// ============================================================
// CORE DOMAIN TYPES
// ============================================================

export type Confidence = "high" | "medium" | "low";

export interface Place {
  id?: string;
  name: string;
  name_ta?: string;
  lat: number;
  lng: number;
  district?: string;
  place_type?: "city" | "town" | "village" | "bus_stop" | "railway_station" | "landmark";
}

export type TransportMode = "bus" | "train" | "cab" | "auto" | "walk";

export interface RouteLeg {
  mode: TransportMode;
  from: Place;
  to: Place;
  distance_km: number;
  duration_min: number;
  fare_estimate: number | null;
  fare_confidence: Confidence;
  fare_note?: string;       // explains estimation logic
  line_label?: string;       // e.g. "Route 47B" or "Chennai - Madurai Express"
  operator?: string;
  route_number?: string;
  frequency_minutes?: number | null;
  first_departure?: string | null;
  last_departure?: string | null;
  source_reference?: string | null;
  polyline?: [number, number][]; // [lat, lng] pairs
  data_confidence: Confidence;
  data_note?: string;        // explains why confidence is low / data missing
}

export interface RouteOption {
  id: string;
  label: string;             // e.g. "Bus + Auto", "Direct Train"
  legs: RouteLeg[];
  total_distance_km: number;
  total_duration_min: number;
  total_fare_estimate: number | null;
  fare_confidence: Confidence;
  transfers: number;
  safety_score: number;      // 0-100
  overall_confidence: Confidence;
  confidence_reason: string;
  tags: ("cheapest" | "fastest" | "least_walking" | "best_choice")[];
}

export interface RouteSearchResult {
  source: Place;
  destination: Place;
  straight_line_distance_km: number;
  options: RouteOption[];
  generated_at: string;
  data_sources: string[];
  disclaimer: string;
}

// ============================================================
// CHAT TYPES
// ============================================================

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
  metadata?: Record<string, unknown>;
}

export interface ChatContext {
  searchResult: RouteSearchResult | null;
  sessionId: string | null;
  language: "en" | "ta" | "tanglish";
}

// ============================================================
// SEARCH MODE
// ============================================================

export type PlanMode = "balanced" | "budget" | "fastest" | "least_walking" | "accessibility";

export interface SearchHistoryEntry {
  id: string;
  source_name: string;
  destination_name: string;
  search_mode: "text" | "voice";
  language: string;
  created_at: string;
  results_summary?: {
    best_option_label: string;
    total_duration_min: number;
    total_fare_estimate: number | null;
  };
}
