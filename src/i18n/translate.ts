import type { TranslationSchema } from "./locales/en";

/** Every dot-path into the translation schema that resolves to a string, e.g. "hud.wave" or "towers.IRONWOOD.name". */
type PathImpl<T, K extends keyof T> = K extends string
  ? T[K] extends string
    ? K
    : T[K] extends Record<string, unknown>
      ? `${K}.${PathImpl<T[K], keyof T[K]>}`
      : never
  : never;

export type TranslationKey = PathImpl<TranslationSchema, keyof TranslationSchema>;

function getByPath(source: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, segment) => {
    if (acc && typeof acc === "object" && segment in acc) {
      return (acc as Record<string, unknown>)[segment];
    }
    return undefined;
  }, source);
}

function interpolate(template: string, vars?: Record<string, string | number>): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in vars ? String(vars[name]) : match,
  );
}

/**
 * Resolves `key` (a dot-path like "hud.wave") against `locale` and applies
 * `{placeholder}` interpolation. A key that doesn't resolve to a string
 * returns the key itself — visibly wrong in the UI rather than throwing,
 * which is the right failure mode for a missing translation.
 */
export function translate(
  locale: TranslationSchema,
  key: TranslationKey,
  vars?: Record<string, string | number>,
): string {
  const value = getByPath(locale, key);
  if (typeof value !== "string") return key;
  return interpolate(value, vars);
}
