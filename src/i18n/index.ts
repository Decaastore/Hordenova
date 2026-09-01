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
