"use client";

import { Languages } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/components/providers/language-provider";

export function LanguageToggle() {
  const { language, setLanguage } = useLanguage();
  return (
    <Button variant="glass" size="sm" onClick={() => setLanguage(language === "en" ? "ta" : "en")} className="gap-2">
      <Languages className="h-4 w-4" />
      {language === "en" ? "தமிழ்" : "English"}
    </Button>
  );
}
