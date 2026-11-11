import { DEFAULT_LANGUAGE, isLanguageCode, LOCALES, type LanguageCode } from "@/i18n";
import { translate, type TranslationKey } from "@/i18n/translate";

/**
 * Text for loot labels drawn on the canvas, in the player's language. The
 * canvas lives outside React, so it reads the same stored language the
 * LanguageProvider uses (re-read at most once a second, so switching
 * language applies almost at once without a lookup per frame).
 */
let cached: { lang: LanguageCode; at: number } | null = null;

function language(): LanguageCode {
  const now = typeof performance !== "undefined" ? performance.now() : 0;
  if (cached && now - cached.at < 1000) return cached.lang;
  let lang: LanguageCode = DEFAULT_LANGUAGE;
  try {
    const raw = localStorage.getItem("hordenova.language");
    if (raw && isLanguageCode(raw)) lang = raw;
  } catch {
    /* default */
  }
  cached = { lang, at: now };
  return lang;
}

export function LOOT_LABELS() {
  const locale = LOCALES[language()];
  return {
    shards: (n: number) => (n === 1 ? translate(locale, "loot.shardsOne") : translate(locale, "loot.shards", { n })),
    item: (i18nKey: string) => translate(locale, `items.${i18nKey}.name` as TranslationKey),
    unknown: translate(locale, "loot.unknown"),
  };
}
