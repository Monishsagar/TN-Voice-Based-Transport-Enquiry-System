"use server";

import { createClient } from "@/lib/supabase/server";
import { resolvePlace } from "@/lib/services/geocoding";
import { generateRouteOptions } from "@/lib/services/route-engine";
import { RouteSearchResult } from "@/types";
import { parseSourceDestination, normalizePlaceName } from "@/lib/language";

export interface SearchInput {
  sourceText?: string;
  destinationText?: string;
  rawQuery?: string; // for voice/combined natural input
  searchMode: "text" | "voice";
  language: "en" | "ta" | "tanglish";
}

export interface SearchResponse {
  success: boolean;
  result?: RouteSearchResult;
  searchHistoryId?: string;
  error?: string;
  resolvedSource?: string;
  resolvedDestination?: string;
}

export async function searchRoutes(input: SearchInput): Promise<SearchResponse> {
  let sourceText = input.sourceText?.trim();
  let destinationText = input.destinationText?.trim();

  // If a combined natural-language query was given (e.g. from voice),
  // attempt to split it into source/destination.
  if (input.rawQuery && (!sourceText || !destinationText)) {
    const parsed = parseSourceDestination(input.rawQuery);
    if (parsed) {
      sourceText = parsed.source;
      destinationText = parsed.destination;
    } else {
      return {
        success: false,
        error:
          "Could not determine source and destination from your query. Please specify like 'Chennai to Madurai' or use the separate From/To fields.",
      };
    }
  }

  if (!sourceText || !destinationText) {
    return { success: false, error: "Both source and destination are required." };
  }

  const source = await resolvePlace(sourceText);
  const destination = await resolvePlace(destinationText);

  if (!source) {
    return {
      success: false,
      error: `Could not locate "${sourceText}" in Tamil Nadu. Try a nearby major town, or check spelling. Normalized as: "${normalizePlaceName(
        sourceText
      )}".`,
    };
  }

  if (!destination) {
    return {
      success: false,
      error: `Could not locate "${destinationText}" in Tamil Nadu. Try a nearby major town, or check spelling. Normalized as: "${normalizePlaceName(
        destinationText
      )}".`,
    };
  }

  const result = await generateRouteOptions(source, destination);

  // Persist search history for the logged-in user
  let searchHistoryId: string | undefined;
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (user) {
      const best = result.options.find((o) => o.tags.includes("best_choice")) ?? result.options[0];

      const { data, error } = await supabase
        .from("search_history")
        .insert({
          user_id: user.id,
          source_name: source.name,
          source_lat: source.lat,
          source_lng: source.lng,
          destination_name: destination.name,
          destination_lat: destination.lat,
          destination_lng: destination.lng,
          search_mode: input.searchMode,
          language: input.language,
          results_summary: best
            ? {
                best_option_label: best.label,
                total_duration_min: best.total_duration_min,
                total_fare_estimate: best.total_fare_estimate,
              }
            : null,
        })
        .select("id")
        .single();

      if (!error && data) searchHistoryId = data.id;

      // Analytics event
      await supabase.from("analytics_events").insert({
        user_id: user.id,
        event_type: input.searchMode === "voice" ? "voice_search" : "search",
        event_data: { source: source.name, destination: destination.name, language: input.language },
      });
    }
  } catch {
    // Non-fatal — search still returns results even if history save fails
  }

  return {
    success: true,
    result,
    searchHistoryId,
    resolvedSource: source.name,
    resolvedDestination: destination.name,
  };
}
