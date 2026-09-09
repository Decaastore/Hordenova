import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { NovidadesScreen } from "./NovidadesScreen";
import { LanguageProvider } from "@/i18n/LanguageContext";
import { PATCH_NOTES } from "@/config/patchNotes";

/**
 * BALANCEAMENTO DEFINITIVO spec section 10/15 — Novidades rendering
 * contract: real entries (config/patchNotes.ts), newest version first, a
 * real date on the latest entry, category/type labels, and player-facing
 * i18n text (never a raw, unresolved translation key).
 */
function render(): string {
  return renderToStaticMarkup(
    <LanguageProvider>
      <NovidadesScreen onNavigate={() => {}} onPlay={() => {}} />
    </LanguageProvider>,
  );
}

describe("NovidadesScreen — BALANCEAMENTO DEFINITIVO spec section 10/15", () => {
  it("renders every real PATCH_NOTES version id", () => {
    const html = render();
    for (const version of PATCH_NOTES) {
      expect(html).toContain(version.id);
    }
  });

  it("orders versions newest-first — the latest id appears before the previous one", () => {
    const html = render();
    const latest = PATCH_NOTES[0]!.id;
    const previous = PATCH_NOTES[1]!.id;
    // Match the rendered version-id chip itself (`>v13<`), not a bare
    // substring search — a raw id like "v12" can spuriously match unrelated
    // markup earlier in the page (e.g. an SVG icon's `d="...v12..."` path
    // command, where "v12" means "vertical line to y=12", nothing to do
    // with a patch note version).
    expect(html.indexOf(`>${latest}<`)).toBeLessThan(html.indexOf(`>${previous}<`));
  });

  it("the latest version carries a real ISO date, shown in the page", () => {
    const html = render();
    const latest = PATCH_NOTES[0]!;
    expect(latest.dateIso).not.toBeNull();
    expect(html).toContain(latest.dateIso as string);
  });

  it("resolves real player-facing text for every entry — never a raw, unresolved i18n key", () => {
    const html = render();
    for (const version of PATCH_NOTES) {
      for (const item of version.items) {
        // A raw unresolved key would literally contain "novidades.entries." in the output.
        expect(html).not.toContain(`novidades.entries.${version.id}.${item.i18nKey}`);
      }
    }
  });

  it("shows a category label for every entry (never blank/undefined)", () => {
    const html = render();
    expect(html).not.toContain("undefined");
  });

  it("marks only the newest version as the latest", () => {
    const html = render();
    // The badge text appears exactly once even though every version shares a similar row layout.
    const occurrences = html.split(">Latest<").length - 1;
    expect(occurrences).toBe(1);
  });
});
