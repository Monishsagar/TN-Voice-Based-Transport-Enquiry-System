import { RouteSearchResult, RouteOption } from "@/types";
import { formatDistance, formatDuration, formatINR } from "@/lib/utils";
import { isTamilScript } from "@/lib/language";

/**
 * ============================================================
 * DETERMINISTIC CHAT ENGINE
 * ============================================================
 * Answers follow-up questions about a generated RouteSearchResult
 * using rule-based intent matching + templated responses grounded
 * ENTIRELY in the data already present in `searchResult`. This
 * guarantees no hallucinated bus numbers, fares, or timings.
 *
 * If an optional LLM endpoint is configured (OPTIONAL_LLM_API_URL),
 * it may be used to rephrase these grounded facts more naturally,
 * but the underlying facts always come from this engine — the LLM
 * is never the source of route data.
 * ============================================================
 */

type Intent =
  | "mode_specific"
  | "cheapest"
  | "fastest"
  | "least_walking"
  | "best_choice"
  | "fare_breakdown"
  | "transfers"
  | "compare"
  | "nearby"
  | "alternatives"
  | "safety"
  | "confidence"
  | "general";

export function detectIntent(message: string): Intent {
  const m = message.toLowerCase();

  if (/\b(train|rail|metro|bus|cab|taxi|auto|walk|walking)\b/.test(m)) return "mode_specific";
  if (/cheap|low cost|low fare|kammi|sariya|குறைந்த/.test(m)) return "cheapest";
  if (/fast|quick|speed|veg|வேக/.test(m)) return "fastest";
  if (/walk|nada|நட/.test(m)) return "least_walking";
  if (/best|recommend|suggest|nalla|good option|சிறந்த/.test(m)) return "best_choice";
  if (/fare|price|cost|kattanam|விலை|கட்டண/.test(m)) return "fare_breakdown";
  if (/transfer|change|switch|idamaatram|இடமாற்ற/.test(m)) return "transfers";
  if (/compare|vs|versus|ottu/.test(m)) return "compare";
  if (/near|nearby|station|stop|அருகில்/.test(m)) return "nearby";
  if (/alternative|other route|vera vali|வேறு வழி/.test(m)) return "alternatives";
  if (/safe|safety|late night|பாதுகாப்/.test(m)) return "safety";
  if (/confiden|sure|certain|how accurate|நம்பகத்த/.test(m)) return "confidence";

  return "general";
}

export function generateChatResponse(
  message: string,
  result: RouteSearchResult | null,
  language: "en" | "ta" | "tanglish" = "en"
): string {
  const useTamil = language === "ta" || isTamilScript(message);

  if (!result || result.options.length === 0) {
    return useTamil
      ? "முதலில் ஒரு வழியைத் தேடுங்கள், பிறகு அதைப் பற்றி கேட்கலாம்."
      : "Please search for a route first — I can answer questions about it once results are available.";
  }

  const intent = detectIntent(message);

  switch (intent) {
    case "mode_specific":
      return modeSpecificInfo(message, result, useTamil);
    case "cheapest":
      return describeOption(
        findByTag(result.options, "cheapest") ?? cheapestByFare(result.options),
        "cheapest",
        useTamil
      );
    case "fastest":
      return describeOption(findByTag(result.options, "fastest") ?? fastest(result.options), "fastest", useTamil);
    case "least_walking":
      return describeOption(
        findByTag(result.options, "least_walking") ?? result.options[0],
        "least_walking",
        useTamil
      );
    case "best_choice":
      return describeOption(findByTag(result.options, "best_choice") ?? result.options[0], "best_choice", useTamil);
    case "fare_breakdown":
      return fareBreakdown(result, useTamil);
    case "transfers":
      return transferInfo(result, useTamil);
    case "compare":
      return compareOptions(result, useTamil);
    case "nearby":
      return nearbyInfo(result, useTamil);
    case "alternatives":
      return alternativesInfo(result, useTamil);
    case "safety":
      return safetyInfo(result, useTamil);
    case "confidence":
      return confidenceInfo(result, useTamil);
    default:
      return generalSummary(result, useTamil);
  }
}

// ============================================================
// HELPERS
// ============================================================

function findByTag(options: RouteOption[], tag: string): RouteOption | undefined {
  return options.find((o) => o.tags.includes(tag as RouteOption["tags"][number]));
}

function cheapestByFare(options: RouteOption[]): RouteOption {
  const withFare = options.filter((o) => o.total_fare_estimate !== null);
  if (withFare.length === 0) return options[0];
  return withFare.reduce((a, b) => (a.total_fare_estimate! < b.total_fare_estimate! ? a : b));
}

function fastest(options: RouteOption[]): RouteOption {
  return options.reduce((a, b) => (a.total_duration_min < b.total_duration_min ? a : b));
}

function modeSpecificInfo(message: string, result: RouteSearchResult, ta: boolean): string {
  const m = message.toLowerCase();
  const mode =
    /\b(train|rail|metro)\b/.test(m)
      ? "train"
      : /\b(bus)\b/.test(m)
      ? "bus"
      : /\b(cab|taxi)\b/.test(m)
      ? "cab"
      : /\b(auto)\b/.test(m)
      ? "auto"
      : /\b(walk|walking)\b/.test(m)
      ? "walk"
      : null;

  if (!mode) return generalSummary(result, ta);

  const matching = result.options.filter((option) => option.legs.some((leg) => leg.mode === mode));
  if (matching.length === 0) {
    const available = Array.from(new Set(result.options.flatMap((option) => option.legs.map((leg) => leg.mode)))).join(", ");
    return ta
      ? `${result.source.name} முதல் ${result.destination.name} வரை ${mode} விருப்பம் இந்த முடிவுகளில் உருவாக்கப்படவில்லை. கிடைத்த முறைகள்: ${available}. குறிப்பிட்ட ${mode} தரவு சரிபார்க்கப்படவில்லை அல்லது இந்த route-க்கு app அதை பொருத்தமானதாக கருதவில்லை.`
      : `I do not have a ${mode} option in the generated results for ${result.source.name} to ${result.destination.name}. Available modes here are: ${available}. That usually means no verified ${mode} route was found in the dataset, or the app did not consider ${mode} viable for this route.`;
  }

  const lines = matching.slice(0, 3).map((option) => {
    const legs = option.legs
      .filter((leg) => leg.mode === mode)
      .map(
        (leg) =>
          `${leg.line_label ?? capitalize(leg.mode)}: ${formatDistance(leg.distance_km)}, ${formatDuration(
            leg.duration_min
          )}, ${formatINR(leg.fare_estimate)} (${leg.data_confidence} confidence)`
      )
      .join("; ");
    return `${option.label} - ${legs}`;
  });

  return ta
    ? `${mode} விருப்பங்கள்:\n${lines.join("\n")}`
    : `${capitalize(mode)} option(s) for ${result.source.name} to ${result.destination.name}:\n${lines.join("\n")}`;
}

function describeOption(option: RouteOption | undefined, kind: string, ta: boolean): string {
  if (!option) {
    return ta ? "இதற்கான வழி தகவல் இல்லை." : "No matching route found.";
  }

  const legsDesc = option.legs
    .map((leg) => {
      const lineInfo = leg.line_label ? ` (${leg.line_label})` : "";
      const operator = leg.operator ? `, operator ${leg.operator}` : "";
      const frequency = leg.frequency_minutes ? `, frequency every ${leg.frequency_minutes} min` : "";
      const serviceWindow =
        leg.first_departure && leg.last_departure ? `, service ${leg.first_departure}-${leg.last_departure}` : "";
      return `${capitalize(leg.mode)}${lineInfo}${operator}${frequency}${serviceWindow}: ${formatDistance(leg.distance_km)}, ${formatDuration(
        leg.duration_min
      )}, ${formatINR(leg.fare_estimate)}`;
    })
    .join(" → ");

  const kindLabels: Record<string, { en: string; ta: string }> = {
    cheapest: { en: "cheapest option", ta: "மிகக் குறைந்த விலை வழி" },
    fastest: { en: "fastest option", ta: "வேகமான வழி" },
    least_walking: { en: "option with least walking", ta: "குறைந்த நடைபயணம் கொண்ட வழி" },
    best_choice: { en: "recommended best choice", ta: "பரிந்துரைக்கப்பட்ட சிறந்த தேர்வு" },
  };

  const label = kindLabels[kind] ?? { en: "option", ta: "வழி" };

  if (ta) {
    return `${label.ta}: ${option.label}. ${legsDesc}. மொத்தம்: ${formatDistance(
      option.total_distance_km
    )}, ${formatDuration(option.total_duration_min)}, ${formatINR(option.total_fare_estimate)}.\n\nநம்பகத்தன்மை: ${
      option.overall_confidence
    } — ${option.confidence_reason}`;
  }

  return `The ${label.en} is **${option.label}**.\n\n${legsDesc}\n\nTotal: ${formatDistance(
    option.total_distance_km
  )}, ${formatDuration(option.total_duration_min)}, estimated fare ${formatINR(
    option.total_fare_estimate
  )}.\n\nConfidence: ${option.overall_confidence} — ${option.confidence_reason}`;
}

function fareBreakdown(result: RouteSearchResult, ta: boolean): string {
  const lines = result.options.slice(0, 5).map((opt) => {
    const legFares = opt.legs
      .map((l) => `${capitalize(l.mode)} ${formatINR(l.fare_estimate)} (${l.fare_confidence})`)
      .join(", ");
    return `• ${opt.label}: ${formatINR(opt.total_fare_estimate)} total — [${legFares}]`;
  });

  const header = ta
    ? `${result.source.name} இலிருந்து ${result.destination.name} வரை கட்டண விவரம்:`
    : `Fare breakdown for ${result.source.name} → ${result.destination.name}:`;

  const note = ta
    ? "\n\nகுறிப்பு: இவை மதிப்பீடுகள், உண்மையான கட்டணம் வேறுபடலாம்."
    : "\n\nNote: these are estimates derived from public tariff structures — actual fares may vary.";

  return `${header}\n${lines.join("\n")}${note}`;
}

function transferInfo(result: RouteSearchResult, ta: boolean): string {
  const noTransfer = result.options.filter((o) => o.transfers === 0);
  if (ta) {
    return noTransfer.length > 0
      ? `${noTransfer.length} வழிகளில் இடமாற்றம் தேவையில்லை: ${noTransfer.map((o) => o.label).join(", ")}.`
      : "அனைத்து வழிகளுக்கும் குறைந்தது ஒரு இடமாற்றம் தேவைப்படலாம்.";
  }
  return noTransfer.length > 0
    ? `${noTransfer.length} option(s) require no transfers: ${noTransfer.map((o) => o.label).join(", ")}.`
    : "All currently listed options may require at least one transfer — multi-leg combinations aren't fully modeled for this pair yet.";
}

function compareOptions(result: RouteSearchResult, ta: boolean): string {
  const top = result.options.slice(0, 4);
  const rows = top.map(
    (o) =>
      `${o.label}: ${formatDuration(o.total_duration_min)}, ${formatINR(o.total_fare_estimate)}, ${
        o.transfers
      } transfer(s), safety ${o.safety_score}/100`
  );

  const header = ta ? "ஒப்பீடு:" : "Comparison of top options:";
  return `${header}\n${rows.join("\n")}`;
}

function nearbyInfo(result: RouteSearchResult, ta: boolean): string {
  return ta
    ? `${result.source.name} மற்றும் ${result.destination.name} அருகிலுள்ள நிலையங்கள் பற்றிய துல்லியமான தரவு தற்போது வரைபடத்தில் காட்டப்பட்ட புள்ளிகளிலிருந்து மட்டுமே கிடைக்கும். OpenStreetMap தரவை விரிவாக்க பணி நடைபெறுகிறது.`
    : `Detailed "nearby stops" data is limited to what's shown as markers on the map for ${result.source.name} and ${result.destination.name}. We're working on expanding OpenStreetMap-based stop coverage — for now, the map view shows the closest known points.`;
}

function alternativesInfo(result: RouteSearchResult, ta: boolean): string {
  const rest = result.options.slice(1, 4).map((o) => o.label);
  if (rest.length === 0) {
    return ta ? "மற்ற மாற்று வழிகள் இல்லை." : "No additional alternative routes are available for this pair currently.";
  }
  return ta
    ? `மற்ற வழிகள்: ${rest.join(", ")}.`
    : `Other available options include: ${rest.join(", ")}.`;
}

function safetyInfo(result: RouteSearchResult, ta: boolean): string {
  const best = result.options.reduce((a, b) => (a.safety_score > b.safety_score ? a : b));
  return ta
    ? `பாதுகாப்பு மதிப்பெண் இடமாற்றங்களின் எண்ணிக்கை (மற்றும் தெரிந்தால் இரவு நேரப் பயணம்) அடிப்படையில் கணக்கிடப்படுகிறது. அதிக மதிப்பெண்: ${best.label} (${best.safety_score}/100).`
    : `Safety scores are heuristic, based on number of transfers (and late-night travel where known). The highest-scoring option here is ${best.label} at ${best.safety_score}/100. This is not a guarantee — always exercise normal travel precautions, especially at night.`;
}

function confidenceInfo(result: RouteSearchResult, ta: boolean): string {
  const lowConfidence = result.options.filter((o) => o.overall_confidence === "low");
  if (ta) {
    return lowConfidence.length > 0
      ? `${lowConfidence.length} வழிகளுக்கான தரவு நம்பகத்தன்மை குறைவு: ${lowConfidence
          .map((o) => o.label)
          .join(", ")}. காரணம்: சரிபார்க்கப்பட்ட பாதை தரவுத்தளத்தில் இல்லை.`
      : "காட்டப்பட்ட வழிகளுக்கு நியாயமான நம்பகத்தன்மை உள்ளது, ஆனாலும் பயணத்திற்கு முன் சரிபார்க்கவும்.";
  }
  return lowConfidence.length > 0
    ? `${lowConfidence.length} option(s) have low confidence: ${lowConfidence
        .map((o) => o.label)
        .join(
          ", "
        )}. This is because no verified route record exists in our dataset for this pair — figures are road-distance-based estimates. Please verify with the operator before traveling.`
    : "The listed options have reasonable confidence, but please still verify exact timings with the operator before traveling, as schedules can change.";
}

function generalSummary(result: RouteSearchResult, ta: boolean): string {
  const best = findByTag(result.options, "best_choice") ?? result.options[0];
  if (ta) {
    return `${result.source.name} முதல் ${result.destination.name} வரை ${result.options.length} வழிகள் கிடைத்துள்ளன். பரிந்துரை: ${best.label} (${formatDuration(
      best.total_duration_min
    )}, ${formatINR(best.total_fare_estimate)}). கட்டணம், வேகம், மாற்று வழிகள் பற்றி கேட்கலாம்.`;
  }
  return `Found ${result.options.length} route option(s) from ${result.source.name} to ${result.destination.name}. The recommended best choice is **${best.label}** (${formatDuration(
    best.total_duration_min
  )}, ${formatINR(best.total_fare_estimate)}). Ask me about fares, fastest/cheapest options, transfers, or alternatives.`;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
