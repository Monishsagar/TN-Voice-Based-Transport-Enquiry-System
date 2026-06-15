"use server";

import { createClient } from "@/lib/supabase/server";
import { generateChatResponse } from "@/lib/services/chat-engine";
import { resolvePlace } from "@/lib/services/geocoding";
import { generateRouteOptions } from "@/lib/services/route-engine";
import { parseSourceDestination } from "@/lib/language";
import { RouteSearchResult } from "@/types";
import { revalidatePath } from "next/cache";

// ============================================================
// CHAT
// ============================================================

export async function getOrCreateChatSession(searchHistoryId: string | null) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  if (searchHistoryId) {
    const { data: existing } = await supabase
      .from("chat_sessions")
      .select("id")
      .eq("user_id", user.id)
      .eq("search_history_id", searchHistoryId)
      .limit(1)
      .maybeSingle();

    if (existing) return { sessionId: existing.id };
  }

  const { data, error } = await supabase
    .from("chat_sessions")
    .insert({ user_id: user.id, search_history_id: searchHistoryId, title: "Route enquiry" })
    .select("id")
    .single();

  if (error) return { error: error.message };
  return { sessionId: data.id };
}

export async function sendChatMessage(
  sessionId: string,
  message: string,
  searchResult: RouteSearchResult | null,
  language: "en" | "ta" | "tanglish" = "en"
) {
  if (sessionId.startsWith("guest-")) {
    const content = await buildChatAnswer(message, searchResult, language);
    return {
      message: {
        id: `guest-${Date.now()}`,
        content,
        created_at: new Date().toISOString(),
      },
    };
  }

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return { error: "Not authenticated" };

  // Save user message
  await supabase.from("chat_messages").insert({
    session_id: sessionId,
    user_id: user.id,
    role: "user",
    content: message,
  });

  const finalText = await buildChatAnswer(message, searchResult, language);

  const { data, error } = await supabase
    .from("chat_messages")
    .insert({
      session_id: sessionId,
      user_id: user.id,
      role: "assistant",
      content: finalText,
    })
    .select("id, content, created_at")
    .single();

  if (error) return { error: error.message };

  return { message: data };
}

async function buildChatAnswer(
  message: string,
  searchResult: RouteSearchResult | null,
  language: "en" | "ta" | "tanglish"
): Promise<string> {
  const alternateRoute = await buildAlternateRouteContext(message, searchResult);
  const fallbackText = alternateRoute
    ? formatAlternateRouteAnswer(alternateRoute, language)
    : generateChatResponse(message, searchResult, language);
  const LLM_URL = process.env.OPTIONAL_LLM_API_URL || null;
  const LLM_KEY =
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_GENERATIVE_AI_API_KEY ||
    process.env.OPTIONAL_LLM_API_KEY ||
    null;

  if (LLM_KEY) {
    try {
      const gaUrl = `https://generativelanguage.googleapis.com/v1beta/models/${
        process.env.GEMINI_MODEL || "gemini-1.5-flash"
      }:generateContent?key=${LLM_KEY}`;
      const payload = {
        contents: [
          {
            role: "user",
            parts: [{ text: buildGeminiRoutePrompt(message, searchResult, alternateRoute, fallbackText, language) }],
          },
        ],
        generationConfig: {
          temperature: 0.15,
          topP: 0.8,
          maxOutputTokens: 900,
        },
      };
      const r = await fetchWithTimeout(gaUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (r.ok) {
        const j = await r.json();
        const text = j?.candidates?.[0]?.content?.parts
          ?.map((part: { text?: string }) => part.text ?? "")
          .join("")
          .trim();
        if (text) return text;
      }
    } catch {
      // fall through to optional custom endpoint or deterministic response
    }
  }

  if (LLM_URL) {
    try {
      const r = await fetchWithTimeout(LLM_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: message,
          route: summarizeRouteForChat(searchResult),
          alternateRoute,
          fallback: fallbackText,
          language,
        }),
      });
      if (r.ok) {
        const j = await r.json();
        if (j && j.text) return j.text;
      }
    } catch {
      // ignore and fall back to deterministic response
    }
  }

  return fallbackText;
}

function buildGeminiRoutePrompt(
  question: string,
  searchResult: RouteSearchResult | null,
  alternateRoute: Awaited<ReturnType<typeof buildAlternateRouteContext>>,
  fallbackText: string,
  language: "en" | "ta" | "tanglish"
): string {
  return [
    "You are the follow-up assistant inside a Tamil Nadu transport route app.",
    "Answer the user's exact question using ONLY the route JSON below.",
    "Do not invent bus numbers, train numbers, stops, live timings, platforms, operators, or exact fares if they are not present.",
    "If the route JSON says a value is estimated or low confidence, say that clearly.",
    "If Alternate Route JSON is present, the user asked about a new or via route. Answer using that alternate route first, not the original route summary.",
    "If the user asks about a transport mode that is not in the route options, directly say that this app did not generate that mode for the route and explain from the data why it may be unavailable or unverified.",
    "If the user asks for something unavailable in the JSON, say what is unavailable and give the closest useful answer from the available data.",
    "When comparing options, use the numeric duration, fare, distance, transfers, safety score, and confidence fields.",
    "Keep the answer concise, direct, and practical. Use bullets only when they improve clarity.",
    "Answer in Tamil if language is ta, in conversational Tanglish if language is tanglish, otherwise English.",
    "",
    `Language: ${language}`,
    `User question: ${question}`,
    "",
    "Route JSON:",
    JSON.stringify(summarizeRouteForChat(searchResult), null, 2),
    "",
    "Alternate Route JSON:",
    JSON.stringify(alternateRoute, null, 2),
    "",
    "Deterministic fallback answer, for backup only. Improve it if the question needs a more specific answer, but do not contradict route JSON:",
    fallbackText,
  ].join("\n");
}

async function buildAlternateRouteContext(message: string, currentRoute: RouteSearchResult | null) {
  const request = detectRouteRequest(message, currentRoute);
  if (!request) return null;

  const places = await Promise.all(request.places.map((place) => resolvePlace(place)));
  if (places.some((place) => !place)) {
    return {
      request,
      error: "One or more requested places could not be resolved in Tamil Nadu/Puducherry coverage.",
    };
  }

  const resolvedPlaces = places as NonNullable<(typeof places)[number]>[];
  const legs = [];
  for (let i = 0; i < resolvedPlaces.length - 1; i++) {
    const result = await generateRouteOptions(resolvedPlaces[i], resolvedPlaces[i + 1]);
    legs.push({
      from: resolvedPlaces[i].name,
      to: resolvedPlaces[i + 1].name,
      result: summarizeRouteForChat(result),
    });
  }

  return {
    request,
    resolved_places: resolvedPlaces.map((place) => ({
      name: place.name,
      district: place.district,
      lat: place.lat,
      lng: place.lng,
    })),
    legs,
  };
}

function detectRouteRequest(message: string, currentRoute: RouteSearchResult | null): { type: "direct" | "via"; places: string[] } | null {
  const text = message.trim();
  const lower = text.toLowerCase();
  const routeWords = /\b(route|go|going|travel|reach|from|to|via|through|there|poganum|train|bus|cab|auto)\b/i;
  if (!routeWords.test(text)) return null;

  const fromThere = lower.match(/to\s+(.+?)\s+from\s+(.+?)\s+and\s+from\s+there\s+to\s+(.+?)(?:[?.!]|$)/i);
  if (fromThere) {
    return {
      type: "via",
      places: [cleanPlaceName(fromThere[2]), cleanPlaceName(fromThere[1]), cleanPlaceName(fromThere[3])],
    };
  }

  const via = lower.match(/from\s+(.+?)\s+to\s+(.+?)\s+(?:via|through)\s+(.+?)(?:[?.!]|$)/i);
  if (via) {
    return {
      type: "via",
      places: [cleanPlaceName(via[1]), cleanPlaceName(via[3]), cleanPlaceName(via[2])],
    };
  }

  const parsed = parseSourceDestination(text);
  if (parsed) {
    return { type: "direct", places: [cleanPlaceName(parsed.source), cleanPlaceName(parsed.destination)] };
  }

  const toFrom = lower.match(/(?:go(?:ing)?\s+)?to\s+(.+?)\s+from\s+(.+?)(?:[?.!]|$)/i);
  if (toFrom) {
    return { type: "direct", places: [cleanPlaceName(toFrom[2]), cleanPlaceName(toFrom[1])] };
  }

  if (currentRoute && /\b(train|bus|cab|auto|walk|fare|time|duration|safe|safety|cheap|fast)\b/i.test(text)) {
    return null;
  }

  return null;
}

function cleanPlaceName(value: string): string {
  return value
    .replace(/\b(what about|going|go|route|travel|reach|please|then|there|from|to|via|through|by|take|using|and)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function formatAlternateRouteAnswer(
  alternateRoute: Awaited<ReturnType<typeof buildAlternateRouteContext>>,
  language: "en" | "ta" | "tanglish"
): string {
  if (!alternateRoute) return "";
  if ("error" in alternateRoute) {
    return `${alternateRoute.error} Requested places: ${alternateRoute.request.places.join(" -> ")}.`;
  }

  const legSummaries = alternateRoute.legs.map((leg, index) => {
    const best =
      leg.result?.options.find((option) => option.tags.includes("best_choice")) ??
      leg.result?.options[0] ??
      null;

    if (!best) {
      return `${index + 1}. ${leg.from} -> ${leg.to}: no route option could be generated.`;
    }

    const modeDetails = best.legs
      .map((routeLeg) => {
        const line = routeLeg.line_label ? ` (${routeLeg.line_label})` : "";
        const confidence = routeLeg.data_confidence ? `, ${routeLeg.data_confidence} confidence` : "";
        return `${routeLeg.mode}${line}${confidence}`;
      })
      .join(" + ");

    return `${index + 1}. ${leg.from} -> ${leg.to}: ${best.label}; ${modeDetails}; ${best.total_distance_km} km; ${Math.round(
      best.total_duration_min
    )} min; fare ${best.total_fare_estimate === null ? "not available" : `Rs.${best.total_fare_estimate}`}; ${best.overall_confidence} confidence.`;
  });

  const totals = alternateRoute.legs.reduce(
    (sum, leg) => {
      const best =
        leg.result?.options.find((option) => option.tags.includes("best_choice")) ??
        leg.result?.options[0] ??
        null;
      return {
        distance: sum.distance + (best?.total_distance_km ?? 0),
        duration: sum.duration + (best?.total_duration_min ?? 0),
        fare: sum.fare + (best?.total_fare_estimate ?? 0),
      };
    },
    { distance: 0, duration: 0, fare: 0 }
  );

  const route = alternateRoute.resolved_places.map((place) => place.name).join(" -> ");
  const totalText = `Approx total: ${Math.round(totals.distance * 10) / 10} km, ${Math.round(
    totals.duration
  )} min, fare around Rs.${Math.round(totals.fare)}.`;

  if (language === "ta") {
    return `இந்த alternate route: ${route}\n${legSummaries.join("\n")}\n${totalText}\n\nகுறிப்பு: fares/timings estimates. Live schedules, exact train/bus numbers, and platforms are not available unless explicitly shown.`;
  }

  return `Yes. For the alternate route ${route}, here is the generated breakdown:\n${legSummaries.join(
    "\n"
  )}\n${totalText}\n\nNote: fares and timings are estimates unless marked verified. Live schedules, exact train/bus numbers, and platforms are not available unless explicitly shown.`;
}

function summarizeRouteForChat(searchResult: RouteSearchResult | null) {
  if (!searchResult) return null;

  return {
    source: searchResult.source,
    destination: searchResult.destination,
    straight_line_distance_km: searchResult.straight_line_distance_km,
    generated_at: searchResult.generated_at,
    disclaimer: searchResult.disclaimer,
    data_sources: searchResult.data_sources,
    options: searchResult.options.map((option) => ({
      id: option.id,
      label: option.label,
      tags: option.tags,
      total_distance_km: option.total_distance_km,
      total_duration_min: option.total_duration_min,
      total_fare_estimate: option.total_fare_estimate,
      fare_confidence: option.fare_confidence,
      transfers: option.transfers,
      safety_score: option.safety_score,
      overall_confidence: option.overall_confidence,
      confidence_reason: option.confidence_reason,
      legs: option.legs.map((leg) => ({
        mode: leg.mode,
        from: leg.from.name,
        to: leg.to.name,
        distance_km: leg.distance_km,
        duration_min: leg.duration_min,
        fare_estimate: leg.fare_estimate,
        fare_confidence: leg.fare_confidence,
        fare_note: leg.fare_note,
        line_label: leg.line_label,
        operator: leg.operator,
        route_number: leg.route_number,
        frequency_minutes: leg.frequency_minutes,
        first_departure: leg.first_departure,
        last_departure: leg.last_departure,
        source_reference: leg.source_reference,
        data_confidence: leg.data_confidence,
        data_note: leg.data_note,
      })),
    })),
  };
}

async function fetchWithTimeout(input: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

export async function getChatHistory(sessionId: string) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("chat_messages")
    .select("id, role, content, created_at, metadata")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });

  if (error) return { error: error.message };
  return { messages: data };
}

// ============================================================
// SAVED ROUTES
// ============================================================

export async function saveRoute(title: string, sourceName: string, destinationName: string, routeData: object) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase.from("saved_routes").insert({
    user_id: user.id,
    title,
    source_name: sourceName,
    destination_name: destinationName,
    route_data: routeData,
  });

  if (error) return { error: error.message };
  revalidatePath("/saved");
  return { success: true };
}

export async function deleteSavedRoute(id: string) {
  const supabase = createClient();
  const { error } = await supabase.from("saved_routes").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/saved");
  return { success: true };
}

// ============================================================
// FAVORITE LOCATIONS (Home/Work shortcuts)
// ============================================================

export async function setFavoriteLocation(label: string, placeName: string, lat: number, lng: number) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: existing } = await supabase
    .from("favorite_locations")
    .select("id")
    .eq("user_id", user.id)
    .eq("label", label)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("favorite_locations")
      .update({ place_name: placeName, lat, lng })
      .eq("id", existing.id);
    if (error) return { error: error.message };
  } else {
    const { error } = await supabase
      .from("favorite_locations")
      .insert({ user_id: user.id, label, place_name: placeName, lat, lng });
    if (error) return { error: error.message };
  }

  revalidatePath("/profile");
  return { success: true };
}

// ============================================================
// PROFILE
// ============================================================

export async function updateProfile(fullName: string, homeLocation: string, workLocation: string) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  // Resolve coordinates for home/work so they can be used for ETA recalculation
  let homeCoords: { lat: number; lng: number } | null = null;
  let workCoords: { lat: number; lng: number } | null = null;

  if (homeLocation.trim()) {
    const place = await resolvePlace(homeLocation.trim());
    if (place) homeCoords = { lat: place.lat, lng: place.lng };
  }
  if (workLocation.trim()) {
    const place = await resolvePlace(workLocation.trim());
    if (place) workCoords = { lat: place.lat, lng: place.lng };
  }

  const { error } = await supabase
    .from("profiles")
    .upsert({
      id: user.id,
      full_name: fullName || null,
      home_location: homeLocation || null,
      home_lat: homeCoords?.lat ?? null,
      home_lng: homeCoords?.lng ?? null,
      work_location: workLocation || null,
      work_lat: workCoords?.lat ?? null,
      work_lng: workCoords?.lng ?? null,
      updated_at: new Date().toISOString(),
    });

  if (error) return { error: error.message };

  // Also sync favorite_locations for quick shortcuts on dashboard
  if (homeLocation.trim() && homeCoords) {
    await setFavoriteLocation("Home", homeLocation.trim(), homeCoords.lat, homeCoords.lng);
  }
  if (workLocation.trim() && workCoords) {
    await setFavoriteLocation("Work", workLocation.trim(), workCoords.lat, workCoords.lng);
  }

  revalidatePath("/profile");
  revalidatePath("/dashboard");
  return { success: true };
}

// ============================================================
// FEEDBACK
// ============================================================

export async function submitFeedback(category: string, message: string, relatedRoute?: object) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase.from("feedback").insert({
    user_id: user.id,
    category,
    message,
    related_route: relatedRoute ?? null,
  });

  if (error) return { error: error.message };
  return { success: true };
}
