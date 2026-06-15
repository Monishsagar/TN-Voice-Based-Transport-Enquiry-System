"use client";

import { Mic, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/components/providers/language-provider";

interface VoiceSearchButtonProps {
  onResult: (transcript: string) => void;
  className?: string;
}

export function VoiceSearchButton({ onResult, className }: VoiceSearchButtonProps) {
  const { language } = useLanguage();
  const { isListening, isSupported, start, stop } = useSpeechRecognition({
    language: language === "ta" ? "ta-IN" : "en-IN",
    onResult,
  });

  if (!isSupported) {
    return (
      <p className="text-xs text-muted-foreground text-center">
        Voice search isn&apos;t supported in this browser. Try Chrome or Edge.
      </p>
    );
  }

  return (
    <div className={cn("flex flex-col items-center gap-2", className)}>
      <div className="relative">
        {isListening && <div className="absolute inset-0 rounded-full bg-primary/40 animate-pulse-ring" />}
        <Button
          type="button"
          size="lg"
          variant={isListening ? "destructive" : "gradient"}
          className="rounded-full h-16 w-16 relative"
          onClick={isListening ? stop : start}
          aria-label={isListening ? "Stop listening" : "Start voice search"}
        >
          {isListening ? <Loader2 className="h-6 w-6 animate-spin" /> : <Mic className="h-6 w-6" />}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        {isListening
          ? (language === "ta" ? "கேட்கிறது..." : "Listening...")
          : (language === "ta" ? "பேச அழுத்தவும்" : "Tap to speak")}
      </p>
    </div>
  );
}
