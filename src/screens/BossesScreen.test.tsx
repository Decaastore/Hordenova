import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { LanguageProvider } from "@/i18n/LanguageContext";
import { BossesScreen } from "./BossesScreen";
import { MAIN_BOSSES, MINI_BOSSES } from "@/config/bossConfig";

describe("BossesScreen", () => {
  it("shows the Global Boss, the fury rules and a card for every region boss and mini-boss, with no raw keys", () => {
    const html = renderToStaticMarkup(
      <LanguageProvider>
        <BossesScreen onNavigate={() => {}} onPlay={() => {}} onPlayColossus={() => {}} />
      </LanguageProvider>,
    );
    expect(html).toContain('data-testid="bosses-global"');
    expect(html).toContain('data-testid="bosses-open-colossus"');
    expect(html).toContain('id="fury"');
    for (const b of [...Object.values(MAIN_BOSSES), ...Object.values(MINI_BOSSES)]) expect(html).toContain(`data-testid="boss-card-${b.id}"`);
    // visible text only (no styles, no attributes)
    const text = html.replace(/<style>[\s\S]*?<\/style>/g, "").replace(/<[^>]*>/g, " ");
    expect(text).not.toMatch(/bossesPage\.|colossus\.\w|wiki\.abilities|bosses\.[A-Z_]+\.name|undefined|NaN/);
  });
});
