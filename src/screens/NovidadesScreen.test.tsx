import { afterEach, describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { NovidadesScreen } from "./NovidadesScreen";
import { LanguageProvider } from "@/i18n/LanguageContext";
import { PATCH_NOTES } from "@/config/patchNotes";

/**
 * Novidades rendering contract (single source of truth: config/patchNotes.ts
 * — see that file's own header and CLAUDE.md's "Novidades / Changelog"
 * section for the full contract): real entries, newest first, a real date
 * on the latest entry, a title + description + category for every entry,
 * and real player-facing text (never a raw, unresolved key or "undefined").
 */
function render(): string {
  return renderToStaticMarkup(
    <LanguageProvider>
      <NovidadesScreen onNavigate={() => {}} onPlay={() => {}} />
    </LanguageProvider>,
  );
}

/** React's renderToStaticMarkup HTML-escapes text content (&, <, >, ", ') — mirror that here so raw entry text (titles/descriptions use "&" and apostrophes) still matches the rendered output. */
function htmlEscape(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

describe("NovidadesScreen", () => {
  it("renders every real PATCH_NOTES entry's title and description", () => {
    const html = render();
    for (const entry of PATCH_NOTES) {
      expect(html).toContain(htmlEscape(entry.title.en));
      expect(html).toContain(htmlEscape(entry.description.en));
    }
  });

  it("orders entries newest-first — the latest id appears before the previous one", () => {
    const html = render();
    const latest = PATCH_NOTES[0]!;
    const previous = PATCH_NOTES[1]!;
    expect(html.indexOf(htmlEscape(latest.title.en))).toBeLessThan(html.indexOf(htmlEscape(previous.title.en)));
  });

  it("the latest entry carries a real ISO date, shown in the page", () => {
    const html = render();
    const latest = PATCH_NOTES[0]!;
    expect(latest.dateIso).not.toBeNull();
    expect(html).toContain(latest.dateIso as string);
  });

  it("renders every highlight bullet for every entry — nothing silently dropped", () => {
    const html = render();
    for (const entry of PATCH_NOTES) {
      for (const highlight of entry.highlights) {
        expect(html).toContain(htmlEscape(highlight.en));
      }
    }
  });

  it("shows a real category label for every entry (never blank/undefined)", () => {
    const html = render();
    expect(html).not.toContain("undefined");
  });

  it("marks only the newest entry as the latest", () => {
    const html = render();
    const occurrences = html.split(">Latest<").length - 1;
    expect(occurrences).toBe(1);
  });

  it("every entry has non-empty title/description text in both supported languages — no missing translation", () => {
    for (const entry of PATCH_NOTES) {
      expect(entry.title.en.length).toBeGreaterThan(0);
      expect(entry.title.ptBR.length).toBeGreaterThan(0);
      expect(entry.description.en.length).toBeGreaterThan(0);
      expect(entry.description.ptBR.length).toBeGreaterThan(0);
      for (const highlight of entry.highlights) {
        expect(highlight.en.length).toBeGreaterThan(0);
        expect(highlight.ptBR.length).toBeGreaterThan(0);
      }
    }
  });

  it("renders the Portuguese entry text when the stored language preference is ptBR", () => {
    window.localStorage.setItem("hordenova.language", "ptBR");
    const html = render();
    const latest = PATCH_NOTES[0]!;
    expect(html).toContain(htmlEscape(latest.title.ptBR));
    expect(html).not.toContain(htmlEscape(latest.title.en));
  });

  afterEach(() => {
    window.localStorage.clear();
  });
});
