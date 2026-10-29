import { useEffect, useMemo, useRef, useState } from "react";
import "@fontsource/cormorant-garamond/600.css";
import "@fontsource/cormorant-garamond/700.css";
import { useLanguage } from "@/i18n/LanguageContext";
import type { TranslationKey } from "@/i18n/translate";
import { TopNav, type NavView } from "@/ui/TopNav";
import { TOWER_TYPES, type TowerType } from "@/config/towerStats";
import { ENEMY_TYPES } from "@/config/enemyStats";
import { MAIN_BOSSES, MINI_BOSSES } from "@/config/bossConfig";
import { ITEM_TYPES } from "@/config/itemDefinitions";
import { CREATURE_PORTRAIT_CSS } from "@/ui/CreaturePortrait";
import { buildSearchIndex, normalize, WIKI_CATEGORIES, type SearchEntry, type WikiCategory } from "./wiki/wikiData";
import { TowersPage } from "./wiki/TowersPage";
import { BestiaryPage } from "./wiki/BestiaryPage";
import { AscensionPage, CastlePage, EconomyPage, ItemsPage, ProgressionPage, ProjectionsPage } from "./wiki/OtherPages";
import { WIKI_CSS } from "./wiki/wikiStyles";

interface WikiScreenProps {
  onNavigate: (view: NavView) => void;
  onPlay: () => void;
}

const COUNTS: Partial<Record<WikiCategory, number>> = {
  TOWERS: TOWER_TYPES.length,
  BESTIARY: ENEMY_TYPES.length + Object.keys(MAIN_BOSSES).length + Object.keys(MINI_BOSSES).length,
  ITEMS: ITEM_TYPES.length,
};

/**
 * WIKI — every number and name on these pages is read from the game's own
 * config modules (towerStats, enemyStats, bossConfig, phaseConfig, items,
 * skins, mastery, economy, ascension), never typed by hand, and the art is
 * the game's own (live tower renders, the creatures' baked walk sheets,
 * castle renders, item art). A search box finds any tower, specialization,
 * skin, creature, boss, item or phase and jumps straight to it.
 */
export function WikiScreen({ onNavigate, onPlay }: WikiScreenProps) {
  const { t } = useLanguage();
  const [category, setCategory] = useState<WikiCategory>("TOWERS");
  const [tower, setTower] = useState<TowerType>("IRONWOOD");
  const [query, setQuery] = useState("");
  const [pendingAnchor, setPendingAnchor] = useState<string | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const index = useMemo(() => buildSearchIndex(), []);

  const q = normalize(query.trim());
  const results = useMemo(() => {
    if (!q) return [];
    return index
      .map((entry) => ({ entry, name: t(entry.nameKey as TranslationKey), kind: t(entry.kindKey as TranslationKey) }))
      .filter((r) => normalize(r.name).includes(q))
      .sort((a, b) => normalize(a.name).indexOf(q) - normalize(b.name).indexOf(q) || a.name.localeCompare(b.name))
      .slice(0, 40);
  }, [q, index, t]);

  // After switching page for a search hit, scroll the hit into view and flash it.
  useEffect(() => {
    if (!pendingAnchor) return;
    const id = window.setTimeout(() => {
      const el = document.getElementById(pendingAnchor);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        el.classList.remove("is-flash");
        void el.offsetWidth;
        el.classList.add("is-flash");
      }
      setPendingAnchor(null);
    }, 60);
    return () => window.clearTimeout(id);
  }, [pendingAnchor, category, tower]);

  const openCategory = (cat: WikiCategory) => {
    setCategory(cat);
    setQuery("");
    contentRef.current?.scrollTo({ top: 0 });
  };

  const openResult = (entry: SearchEntry) => {
    setQuery("");
    setCategory(entry.target.category);
    if (entry.target.category === "TOWERS") setTower(entry.target.tower);
    setPendingAnchor(entry.target.anchor);
  };

  return (
    <div className="wk-root">
      <style>{WIKI_CSS + CREATURE_PORTRAIT_CSS}</style>
      <TopNav active="WIKI" onNavigate={onNavigate} onPlay={onPlay} />
      <div className="wk-scroll" ref={contentRef}>
        <header className="wk-hero">
          <div>
            <h1>{t("wiki.pageTitle")}</h1>
            <p>{t("wiki.intro")}</p>
          </div>
          <label className="wk-search">
            <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true">
              <circle cx="8.5" cy="8.5" r="5.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
              <path d="M13 13l4.5 4.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("wiki.searchPlaceholder")}
              aria-label={t("wiki.searchPlaceholder")}
              onKeyDown={(e) => {
                if (e.key === "Enter" && results[0]) openResult(results[0].entry);
                if (e.key === "Escape") setQuery("");
              }}
            />
          </label>
        </header>

        <div className="wk-layout">
          <nav className="wk-rail" aria-label={t("wiki.pageTitle")}>
            {WIKI_CATEGORIES.map((cat) => (
              <button key={cat} className={`wk-rail-item${!q && category === cat ? " is-active" : ""}`} onClick={() => openCategory(cat)} aria-current={!q && category === cat ? "page" : undefined}>
                <span>{t(`wiki.categories.${cat}` as TranslationKey)}</span>
                {COUNTS[cat] !== undefined && <small>{COUNTS[cat]}</small>}
              </button>
            ))}
          </nav>

          <main className="wk-main">
            {q ? (
              <section>
                <header className="wk-page-head">
                  <h2>{results.length > 0 ? t("wiki.searchResults", { count: results.length, query: query.trim() }) : t("wiki.searchEmpty", { query: query.trim() })}</h2>
                </header>
                <ul className="wk-results">
                  {results.map(({ entry, name, kind }) => (
                    <li key={`${entry.kindKey}-${entry.target.anchor}`}>
                      <button onClick={() => openResult(entry)}>
                        <span className="wk-result-name">{name}</span>
                        <span className="wk-result-kind">{kind}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            ) : (
              <section>
                <header className="wk-page-head">
                  <h2>{t(`wiki.categories.${category}` as TranslationKey)}</h2>
                  <p>{t(`wiki.categoryIntro.${category}` as TranslationKey)}</p>
                </header>
                {category === "TOWERS" && <TowersPage tower={tower} onTower={setTower} />}
                {category === "BESTIARY" && <BestiaryPage />}
                {category === "CASTLE" && <CastlePage />}
                {category === "ITEMS" && <ItemsPage />}
                {category === "PROGRESSION" && <ProgressionPage />}
                {category === "ECONOMY" && <EconomyPage />}
                {category === "ASCENSION" && <AscensionPage />}
                {category === "PROJECTIONS" && <ProjectionsPage />}
              </section>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
