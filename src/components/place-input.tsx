"use client";

import { Input } from "@/components/ui/input";
import { MapPin } from "lucide-react";

interface PlaceInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  icon?: React.ReactNode;
}

/**
 * Simple place name text input. Accepts English, Tamil, or
 * Tanglish — normalization happens server-side in the search
 * action. (A live-autocomplete dropdown backed by the `places`
 * table can be added here by querying Supabase on debounce.)
 */
export function PlaceInput({ label, value, onChange, placeholder, icon }: PlaceInputProps) {
  return (
    <div className="space-y-1.5 flex-1">
      <label className="text-sm font-medium text-muted-foreground">{label}</label>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
          {icon ?? <MapPin className="h-4 w-4" />}
        </span>
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="pl-10"
        />
      </div>
    </div>
  );
}
