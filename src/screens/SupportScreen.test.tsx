import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { LanguageProvider } from "@/i18n/LanguageContext";
import { SupportScreen } from "./SupportScreen";
import { TICKET_TOPICS } from "@/config/support";

describe("SupportScreen", () => {
  it("shows every topic, the form and My tickets, with no raw keys — and says honestly when the server is off", () => {
    const html = renderToStaticMarkup(
      <LanguageProvider>
        <SupportScreen onNavigate={() => {}} onPlay={() => {}} />
      </LanguageProvider>,
    );
    for (const tp of TICKET_TOPICS) expect(html).toContain(`data-testid="topic-${tp.id}"`);
    expect(html).toContain('data-testid="support-form"');
    expect(html).toContain('data-testid="support-mine"');
    expect(html).toContain('data-testid="support-off"'); // tests run without Supabase keys
    expect(html).not.toContain('data-testid="ticket-center"');
    expect(html).not.toMatch(/support\.\w|undefined/);
  });
});
