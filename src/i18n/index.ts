import { en } from "./locales/en";
import { ptBR } from "./locales/ptBR";
import type { TranslationSchema } from "./locales/en";

export type { TranslationKey } from "./translate";
export { translate } from "./translate";

export type LanguageCode = "en" | "ptBR";

export const DEFAULT_LANGUAGE: LanguageCode = "en";

/**
 * Every supported language, keyed by code. Adding a new language later
 * means: create locales/<code>.ts typed as `TranslationSchema` (like
 * ptBR.ts), add it here, and add one row to LANGUAGE_META below — no
 * changes anywhere else in the game.
 */
export const LOCALES: Record<LanguageCode, TranslationSchema> = {
  en,
  ptBR,
};

export const LANGUAGE_META: Record<LanguageCode, { flag: string; shortLabel: string }> = {
  en: { flag: "🇺🇸", shortLabel: "EN" },
  ptBR: { flag: "🇧🇷", shortLabel: "PT" },
};

export const LANGUAGE_CODES: readonly LanguageCode[] = ["en", "ptBR"];

export function isLanguageCode(value: string): value is LanguageCode {
  return value === "en" || value === "ptBR";
}

/**
 * The language a first-time visitor sees, before choosing one: the
 * browser's own (Portuguese → ptBR, English → en). Any other browser
 * language gets Portuguese, the game's main audience. A language the player
 * picked in the selector (stored) always wins over this.
 */
export function browserLanguage(): LanguageCode {
  try {
    const nav = typeof navigator !== "undefined" ? navigator : undefined;
    const list = nav ? (nav.languages?.length ? nav.languages : [nav.language]) : [];
    for (const raw of list) {
      const l = (raw ?? "").toLowerCase();
      if (l.startsWith("pt")) return "ptBR";
      if (l.startsWith("en")) return "en";
    }
  } catch {
    /* no navigator */
  }
  return "ptBR";
}
