"use client";

import { useMemo, useState } from "react";
import { RouteSearchResult, ChatMessage, RouteOption } from "@/types";
import { RouteOptionCard } from "@/components/route-option-card";
import { RouteMapWrapper } from "@/components/route-map-wrapper";
import { ChatPanel } from "@/components/chat-panel";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/components/providers/language-provider";
import { saveRoute } from "@/lib/actions/data";
import { formatDistance, formatDuration, formatINR, cn } from "@/lib/utils";
import {
  Share2, BookmarkPlus, Info, ArrowLeftRight, Wallet, Gauge, Footprints, Accessibility, MapPin as BalancedIcon, Check,
} from "lucide-react";

type PlanMode = "balanced" | "budget" | "fastest" | "least_walking" | "accessibility";

interface ResultsViewProps {
  result: RouteSearchResult;
  sessionId: string | null;
  initialMessages: ChatMessage[];
  searchHistoryId: string | null;
  mode?: PlanMode;
}

const MODE_TABS: { key: PlanMode; icon: React.ElementType; label: { en: string; ta: string } }[] = [
  { key: "balanced", icon: BalancedIcon, label: { en: "Balanced", ta: "சமநிலை" } },
  { key: "budget", icon: Wallet, label: { en: "Budget", ta: "பட்ஜெட்" } },
  { key: "fastest", icon: Gauge, label: { en: "Fastest", ta: "வேகமானது" } },
  { key: "least_walking", icon: Footprints, label: { en: "Least Walking", ta: "குறைந்த நடை" } },
  { key: "accessibility", icon: Accessibility, label: { en: "Accessibility", ta: "அணுகல்தன்மை" } },
];

export function ResultsView({ result, sessionId, initialMessages, mode: initialMode }: ResultsViewProps) {
  const { language } = useLanguage();
  const [planMode, setPlanMode] = useState<PlanMode>(initialMode ?? "balanced");
  const [saved, setSaved] = useState(false);
  const [shareMsg, setShareMsg] = useState<string | null>(null);

  const sortedOptions = useMemo(() => sortOptions(result.options, planMode), [result.options, planMode]);

  const [selectedId, setSelectedId] = useState<string | null>(sortedOptions[0]?.id ?? null);
  const selectedOption = sortedOptions.find((o) => o.id === selectedId) ?? sortedOptions[0] ?? null;

  async function handleSave() {
    if (!selectedOption) return;
    await saveRoute(
      `${result.source.name} -> ${result.destination.name}`,
      result.source.name,
      result.destination.name,
      { ...result, options: [selectedOption] }
    );
    setSaved(true);
  }

  async function handleShare() {
    const text = buildShareText(result, selectedOption, language === "ta");
    if (navigator.share) {
      try {
        await navigator.share({ title: "TN Transport Route", text });
        return;
      } catch {
        /* fall through to clipboard */
      }
    }
    await navigator.clipboard.writeText(text);
    setShareMsg(language === "ta" ? "நகலெடுக்கப்பட்டது!" : "Copied to clipboard!");
    setTimeout(() => setShareMsg(null), 2000);
  }

  return (
    <div className="animate-fade-in space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2 flex-wrap">
            {result.source.name}
            <ArrowLeftRight className="h-5 w-5 text-muted-foreground" />
            {result.destination.name}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {language === "ta" ? "நேரடி தொலைவு" : "Straight-line distance"}: {formatDistance(result.straight_line_distance_km)} {" · "}
            {sortedOptions.length} {language === "ta" ? "வழிகள் கிடைத்தன" : "options found"}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="glass" size="sm" onClick={handleShare} className="gap-1.5">
            <Share2 className="h-4 w-4" />
            {shareMsg ?? (language === "ta" ? "பகிர்" : "Share")}
          </Button>
          <Button variant="glass" size="sm" onClick={handleSave} className="gap-1.5" disabled={saved}>
            {saved ? <Check className="h-4 w-4 text-emerald-500" /> : <BookmarkPlus className="h-4 w-4" />}
            {saved ? (language === "ta" ? "சேமிக்கப்பட்டது" : "Saved") : language === "ta" ? "சேமி" : "Save"}
          </Button>
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {MODE_TABS.map(({ key, icon: Icon, label }) => (
          <button
            key={key}
            onClick={() => setPlanMode(key)}
            className={cn(
              "flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium glass shrink-0 transition-all",
              planMode === key && "ring-2 ring-primary bg-primary/10"
            )}
          >
            <Icon className={cn("h-4 w-4", planMode === key ? "text-primary" : "text-muted-foreground")} />
            {language === "ta" ? label.ta : label.en}
          </button>
        ))}
      </div>

      <Card glass>
        <CardContent className="p-3 sm:p-4 flex items-start gap-2 text-xs sm:text-sm text-muted-foreground">
          <Info className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
          <p>{result.disclaimer}</p>
        </CardContent>
      </Card>

      <div className="grid lg:grid-cols-[1.4fr_1fr] gap-5">
        <div className="space-y-5">
          <Card glass className="relative h-[420px] sm:h-[640px] overflow-hidden">
            <RouteMapWrapper
              source={result.source}
              destination={result.destination}
              selectedOption={selectedOption}
              className="absolute inset-0"
            />
          </Card>

          {sortedOptions.length === 0 ? (
            <Card glass>
              <CardContent className="p-8 text-center text-muted-foreground">
                {language === "ta"
                  ? "இந்த இடங்களுக்கான வழித்தடங்கள் எதுவும் கிடைக்கவில்லை."
                  : "No route options could be generated for this pair yet."}
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {sortedOptions.map((option) => (
                <RouteOptionCard
                  key={option.id}
                  option={option}
                  isSelected={option.id === selectedId}
                  onSelect={() => setSelectedId(option.id)}
                  language={language === "ta" ? "ta" : "en"}
                />
              ))}
            </div>
          )}

          <Card glass>
            <CardContent className="p-4 text-xs text-muted-foreground space-y-1">
              <p className="font-medium text-foreground">{language === "ta" ? "தரவு மூலங்கள்:" : "Data sources:"}</p>
              <ul className="list-disc list-inside space-y-0.5">
                {result.data_sources.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>

        <div className="lg:h-[calc(100vh-220px)] lg:sticky lg:top-24">
          <ChatPanel sessionId={sessionId} initialMessages={initialMessages} searchResult={result} />
        </div>
      </div>
    </div>
  );
}

function sortOptions(options: RouteOption[], mode: PlanMode): RouteOption[] {
  const copy = [...options];

  switch (mode) {
    case "budget":
      return copy.sort((a, b) => {
        const af = a.total_fare_estimate ?? Infinity;
        const bf = b.total_fare_estimate ?? Infinity;
        return af - bf;
      });
    case "fastest":
      return copy.sort((a, b) => a.total_duration_min - b.total_duration_min);
    case "least_walking":
      return copy.sort((a, b) => walkDistance(a) - walkDistance(b));
    case "accessibility":
      return copy.sort((a, b) => a.transfers - b.transfers || b.safety_score - a.safety_score);
    case "balanced":
    default:
      return copy.sort((a, b) => {
        const aBest = a.tags.includes("best_choice") ? -1 : 0;
        const bBest = b.tags.includes("best_choice") ? -1 : 0;
        return aBest - bBest;
      });
  }
}

function walkDistance(option: RouteOption): number {
  return option.legs.filter((l) => l.mode === "walk").reduce((sum, l) => sum + l.distance_km, 0);
}

function buildShareText(result: RouteSearchResult, option: RouteOption | null, ta: boolean): string {
  if (!option) return `${result.source.name} -> ${result.destination.name}`;

  const legs = option.legs.map((l) => `${capitalize(l.mode)}${l.line_label ? ` (${l.line_label})` : ""}`).join(" -> ");

  if (ta) {
    return `${result.source.name} முதல் ${result.destination.name} வரை\n${option.label}: ${legs}\nதொலைவு: ${formatDistance(
      option.total_distance_km
    )} | கால அளவு: ${formatDuration(option.total_duration_min)} | கட்டணம்: ${formatINR(
      option.total_fare_estimate
    )}\nநம்பகத்தன்மை: ${option.overall_confidence}`;
  }

  return `${result.source.name} -> ${result.destination.name}\n${option.label}: ${legs}\nDistance: ${formatDistance(
    option.total_distance_km
  )} | Duration: ${formatDuration(option.total_duration_min)} | Fare: ${formatINR(
    option.total_fare_estimate
  )}\nConfidence: ${option.overall_confidence}\n\n(via TN Transport Enquiry)`;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
