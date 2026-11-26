import { afterEach, describe, expect, it, vi } from "vitest";
import { browserLanguage } from "./index";

describe("browserLanguage — the language a first visit opens in", () => {
  afterEach(() => vi.unstubAllGlobals());
  const withLangs = (languages: string[]) => vi.stubGlobal("navigator", { languages, language: languages[0] ?? "" });

  it("opens in Portuguese for a Brazilian or Portuguese browser", () => {
    withLangs(["pt-BR", "en-US"]);
    expect(browserLanguage()).toBe("ptBR");
    withLangs(["pt-PT"]);
    expect(browserLanguage()).toBe("ptBR");
  });

  it("opens in English for an English browser", () => {
    withLangs(["en-US"]);
    expect(browserLanguage()).toBe("en");
  });

  it("falls back to Portuguese for any other language", () => {
    withLangs(["es-ES", "fr-FR"]);
    expect(browserLanguage()).toBe("ptBR");
  });
});
