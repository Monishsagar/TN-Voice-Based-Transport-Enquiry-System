"use client";

import * as React from "react";
import { UI_STRINGS, UILanguage } from "@/lib/language";

interface LanguageContextValue {
  language: UILanguage;
  setLanguage: (lang: UILanguage) => void;
  t: typeof UI_STRINGS.en;
}

const LanguageContext = React.createContext<LanguageContextValue | undefined>(undefined);

const STORAGE_KEY = "tn-transport-language";

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = React.useState<UILanguage>("en");

  React.useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as UILanguage | null;
    if (stored && (stored === "en" || stored === "ta")) {
      setLanguageState(stored);
    }
  }, []);

  const setLanguage = React.useCallback((lang: UILanguage) => {
    setLanguageState(lang);
    localStorage.setItem(STORAGE_KEY, lang);
  }, []);

  const value = React.useMemo(
    () => ({ language, setLanguage, t: UI_STRINGS[language] }),
    [language, setLanguage]
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const ctx = React.useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used within LanguageProvider");
  return ctx;
}
