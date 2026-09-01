import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { DEFAULT_LANGUAGE, isLanguageCode, LOCALES, type LanguageCode } from "./index";
import { translate, type TranslationKey } from "./translate";

const STORAGE_KEY = "hordenova.language";

function loadStoredLanguage(): LanguageCode {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw && isLanguageCode(raw)) return raw;
  } catch {
    // localStorage unavailable (private browsing, disabled storage, ...) — fall back to default.
  }
  return DEFAULT_LANGUAGE;
}

interface LanguageContextValue {
  language: LanguageCode;
  setLanguage: (language: LanguageCode) => void;
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

/**
 * Wraps the whole app (see App.tsx). Holding the language in React state
 * — not a page reload — is what lets the switch in the language selector
 * apply instantly everywhere `useLanguage()` is used.
 */
export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<LanguageCode>(loadStoredLanguage);

  const setLanguage = useCallback((next: LanguageCode) => {
    setLanguageState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Saving the preference is best-effort; the switch itself still works this session.
    }
  }, []);

  const t = useCallback(
    (key: TranslationKey, vars?: Record<string, string | number>) => translate(LOCALES[language], key, vars),
    [language],
  );

  const value = useMemo<LanguageContextValue>(() => ({ language, setLanguage, t }), [language, setLanguage, t]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage() must be used within a <LanguageProvider>");
  return ctx;
}
