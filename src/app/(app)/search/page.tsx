"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlaceInput } from "@/components/place-input";
import { VoiceSearchButton } from "@/components/voice-search-button";
import { searchRoutes } from "@/lib/actions/search";
import { useLanguage } from "@/components/providers/language-provider";
import { parseSourceDestination } from "@/lib/language";
import { ArrowLeftRight, Search, Loader2, AlertCircle, Wallet, Gauge, Footprints, Accessibility, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";

type PlanMode = "balanced" | "budget" | "fastest" | "least_walking" | "accessibility";

const MODES: { key: PlanMode; icon: React.ElementType; label: { en: string; ta: string } }[] = [
  { key: "balanced", icon: MapPin, label: { en: "Balanced", ta: "சமநிலை" } },
  { key: "budget", icon: Wallet, label: { en: "Budget", ta: "பட்ஜெட்" } },
  { key: "fastest", icon: Gauge, label: { en: "Fastest", ta: "வேகமானது" } },
  { key: "least_walking", icon: Footprints, label: { en: "Least Walking", ta: "குறைந்த நடை" } },
  { key: "accessibility", icon: Accessibility, label: { en: "Accessibility", ta: "அணுகல்தன்மை" } },
];

export default function SearchPage() {
  const router = useRouter();
  const { language, t } = useLanguage();
  const [source, setSource] = useState("");
  const [destination, setDestination] = useState("");
  const [mode, setMode] = useState<PlanMode>("balanced");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function swap() {
    setSource(destination);
    setDestination(source);
  }

  function handleVoiceResult(transcript: string) {
    const parsed = parseSourceDestination(transcript);
    if (parsed) {
      setSource(parsed.source);
      setDestination(parsed.destination);
    } else if (!source) {
      setSource(transcript);
    } else {
      setDestination(transcript);
    }
  }

  function handleSearch() {
    setError(null);
    if (!source.trim() || !destination.trim()) {
      setError(
        language === "ta"
          ? "தொடக்க இடம் மற்றும் சேருமிடம் இரண்டையும் உள்ளிடவும்."
          : "Please enter both source and destination."
      );
      return;
    }

    startTransition(async () => {
      const result = await searchRoutes({
        sourceText: source,
        destinationText: destination,
        searchMode: "text",
        language: language === "ta" ? "ta" : "en",
      });

      if (!result.success) {
        setError(result.error ?? "Something went wrong.");
        return;
      }

      const params = new URLSearchParams({ from: source, to: destination, mode });
      router.push(`/results?${params.toString()}`);
    });
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
      <div className="text-center">
        <h1 className="text-3xl font-bold">
          {language === "ta" ? "வழியைத் தேடுங்கள்" : "Search Your Route"}
        </h1>
        <p className="text-muted-foreground mt-1">
          {language === "ta"
            ? "தமிழ், ஆங்கிலம் அல்லது தங்கிலீஷில் பேசுங்கள் அல்லது தட்டச்சு செய்யுங்கள்."
            : "Speak or type in Tamil, English, or Tanglish."}
        </p>
      </div>

      <Card glass>
        <CardContent className="p-5 sm:p-6 space-y-4">
          <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-end">
            <PlaceInput label={t.source} value={source} onChange={setSource} placeholder={language === "ta" ? "எ.கா. சென்னை" : "e.g. Chennai"} />
            <Button variant="glass" size="icon" onClick={swap} className="self-center sm:mb-1.5" aria-label="Swap">
              <ArrowLeftRight className="h-4 w-4" />
            </Button>
            <PlaceInput label={t.destination} value={destination} onChange={setDestination} placeholder={language === "ta" ? "எ.கா. மதுரை" : "e.g. Madurai"} />
          </div>

          {error && (
            <div className="flex items-start gap-2 rounded-xl bg-destructive/10 p-3 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <p>{error}</p>
            </div>
          )}

          <Button variant="gradient" size="lg" className="w-full" onClick={handleSearch} disabled={pending}>
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            {t.search}
          </Button>
        </CardContent>
      </Card>

      <Card glass>
        <CardHeader className="text-center pb-2">
          <CardTitle className="text-base">{t.voiceSearch}</CardTitle>
          <CardDescription>
            {language === "ta"
              ? '"சென்னை இருந்து மதுரை க்கு" அல்லது "Chennai to Madurai" என்று சொல்லுங்கள்.'
              : 'Say something like "Chennai to Madurai" or "Madurai ku eppadi poganum from Coimbatore".'}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center pb-6">
          <VoiceSearchButton onResult={handleVoiceResult} />
        </CardContent>
      </Card>

      <Card glass>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">
            {language === "ta" ? "பயண முன்னுரிமை" : "Trip Priority"}
          </CardTitle>
          <CardDescription>
            {language === "ta"
              ? "முடிவுகள் இந்த முன்னுரிமைக்கு ஏற்ப அடுக்கப்படும்."
              : "Results will be ranked according to this priority."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            {MODES.map(({ key, icon: Icon, label }) => (
              <button
                key={key}
                onClick={() => setMode(key)}
                className={cn(
                  "flex flex-col items-center gap-1.5 rounded-xl p-3 text-xs font-medium transition-all glass",
                  mode === key && "ring-2 ring-primary bg-primary/10"
                )}
              >
                <Icon className={cn("h-5 w-5", mode === key ? "text-primary" : "text-muted-foreground")} />
                {language === "ta" ? label.ta : label.en}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
