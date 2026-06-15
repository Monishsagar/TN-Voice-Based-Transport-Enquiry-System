"use client";

import { RouteOption, TransportMode, Confidence } from "@/types";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDistance, formatDuration, formatINR, cn } from "@/lib/utils";
import {
  Bus, Train, Car, Footprints, MapPin as AutoIcon,
  Clock, Wallet, ArrowRightLeft, ShieldCheck, ChevronRight, Star,
} from "lucide-react";

const MODE_ICONS: Record<TransportMode, React.ElementType> = {
  bus: Bus,
  train: Train,
  cab: Car,
  auto: AutoIcon,
  walk: Footprints,
};

const MODE_COLOR_CLASS: Record<TransportMode, string> = {
  bus: "text-bus",
  train: "text-train",
  cab: "text-cab",
  auto: "text-auto",
  walk: "text-walk",
};

const CONFIDENCE_STYLE: Record<Confidence, string> = {
  high: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  medium: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  low: "bg-rose-500/15 text-rose-600 dark:text-rose-400",
};

const TAG_LABELS: Record<string, { en: string; ta: string; className: string }> = {
  best_choice: { en: "Best Choice", ta: "சிறந்த தேர்வு", className: "bg-gradient-to-r from-primary to-accent text-white" },
  cheapest: { en: "Cheapest", ta: "மிகக் குறைந்த விலை", className: "bg-emerald-500 text-white" },
  fastest: { en: "Fastest", ta: "வேகமானது", className: "bg-blue-500 text-white" },
  least_walking: { en: "Least Walking", ta: "குறைந்த நடைபயணம்", className: "bg-purple-500 text-white" },
};

interface RouteOptionCardProps {
  option: RouteOption;
  isSelected?: boolean;
  onSelect?: () => void;
  language?: "en" | "ta";
}

export function RouteOptionCard({ option, isSelected, onSelect, language = "en" }: RouteOptionCardProps) {
  return (
    <Card
      glass
      className={cn(
        "cursor-pointer transition-all hover:scale-[1.01]",
        isSelected && "ring-2 ring-primary shadow-xl"
      )}
      onClick={onSelect}
    >
      <CardContent className="p-4 sm:p-5">
        {/* Tags */}
        {option.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {option.tags.map((tag) => {
              const meta = TAG_LABELS[tag];
              if (!meta) return null;
              return (
                <span
                  key={tag}
                  className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold", meta.className)}
                >
                  {tag === "best_choice" && <Star className="h-3 w-3" />}
                  {language === "ta" ? meta.ta : meta.en}
                </span>
              );
            })}
          </div>
        )}

        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-base">{option.label}</h3>
          <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", CONFIDENCE_STYLE[option.overall_confidence])}>
            {option.overall_confidence} confidence
          </span>
        </div>

        {/* Legs */}
        <div className="flex items-center gap-2 mb-3 overflow-x-auto pb-1">
          {option.legs.map((leg, idx) => {
            const Icon = MODE_ICONS[leg.mode];
            return (
              <div key={idx} className="flex items-center gap-2 shrink-0">
                <div className="flex items-center gap-1.5 rounded-xl glass px-3 py-1.5">
                  <Icon className={cn("h-4 w-4", MODE_COLOR_CLASS[leg.mode])} />
                  <span className="text-xs font-medium">
                    {leg.line_label ?? capitalize(leg.mode)}
                  </span>
                </div>
                {idx < option.legs.length - 1 && <ChevronRight className="h-4 w-4 text-muted-foreground" />}
              </div>
            );
          })}
        </div>

        <div className="mb-4 space-y-2">
          {option.legs.map((leg, idx) => (
            <div key={`detail-${idx}`} className="rounded-lg bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
              <div className="flex flex-wrap gap-x-3 gap-y-1">
                <span className="font-medium text-foreground">{capitalize(leg.mode)}</span>
                {leg.operator && <span>Operator: {leg.operator}</span>}
                {leg.route_number && <span>Route: {leg.route_number}</span>}
                {leg.frequency_minutes ? <span>Every {leg.frequency_minutes} min</span> : null}
                {leg.first_departure && leg.last_departure ? (
                  <span>Service: {leg.first_departure} to {leg.last_departure}</span>
                ) : null}
                <span>{formatDistance(leg.distance_km)}</span>
                <span>{formatDuration(leg.duration_min)}</span>
                <span>{formatINR(leg.fare_estimate)}</span>
              </div>
              {leg.fare_note && <p className="mt-1">{leg.fare_note}</p>}
              {!leg.operator && leg.data_confidence !== "high" && (
                <p className="mt-1">No verified operator schedule was found for this leg; this is an estimated option.</p>
              )}
            </div>
          ))}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
          <Stat icon={<Clock className="h-4 w-4 text-secondary" />} label="Duration" value={formatDuration(option.total_duration_min)} />
          <Stat icon={<AutoIcon className="h-4 w-4 text-primary" />} label="Distance" value={formatDistance(option.total_distance_km)} />
          <Stat icon={<Wallet className="h-4 w-4 text-cab" />} label="Fare" value={formatINR(option.total_fare_estimate)} />
          <Stat icon={<ArrowRightLeft className="h-4 w-4 text-accent" />} label="Transfers" value={String(option.transfers)} />
        </div>

        <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/50">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5" />
            Safety score: <span className="font-semibold">{option.safety_score}/100</span>
          </div>
          {!isSelected && (
            <Button variant="ghost" size="sm" className="text-xs h-7">
              View on map
            </Button>
          )}
        </div>

        {/* Data note for low confidence */}
        {option.legs.some((l) => l.data_confidence === "low") && (
          <p className="text-xs text-muted-foreground mt-2 italic">
            {option.legs.find((l) => l.data_confidence === "low")?.data_note}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2">
      {icon}
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="font-semibold">{value}</p>
      </div>
    </div>
  );
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
