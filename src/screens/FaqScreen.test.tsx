import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { LanguageProvider } from "@/i18n/LanguageContext";
import { FaqScreen } from "./FaqScreen";

describe("FaqScreen", () => {
  it("lists every question with no raw keys, and answers honestly while payments and the online account are off", () => {
    const html = renderToStaticMarkup(
      <LanguageProvider>
        <FaqScreen onNavigate={() => {}} onPlay={() => {}} />
      </LanguageProvider>,
    );
    for (const id of ["INSTALL", "FREE", "PHONE", "SAVE", "SEASON", "GEMS", "PAYMENTS", "GLOBAL_BOSS", "RANKING", "SUPPORT"]) expect(html).toContain(`data-testid="faq-${id}"`);
    const text = html.replace(/<style>[\s\S]*?<\/style>/g, "").replace(/<[^>]*>/g, " ");
    expect(text).not.toMatch(/faq\.|undefined|NaN|\{\w+\}/);
    // tests run without payments and without the online account: the answers must say so
    expect(text).toMatch(/Not yet|Ainda não/);
    expect(text).toMatch(/in this browser|neste navegador/);
  });
});
