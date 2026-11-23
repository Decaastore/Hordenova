import { useMemo, useState } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import type { TranslationKey } from "@/i18n/translate";
import { TopNav, type NavView } from "@/ui/TopNav";
import { PATCH_NOTES, type PatchNoteCategory, type PatchNoteEntry } from "@/config/patchNotes";
import { PAGE_CSS } from "@/ui/pageChrome";

interface NovidadesScreenProps {
  onNavigate: (view: NavView) => void;
  onPlay: () => void;
}

const CATEGORY_COLOR: Record<PatchNoteCategory, string> = {
  CONTENT: "#8ed39b",
  TOWERS: "#f2c873",
  BOSSES: "#e2685a",
  CASTLE: "#d9b27a",
  ITEMS: "#c79bff",
  ASCENSION: "#c79bff",
  INTERFACE: "#8fc6ff",
  SYSTEMS: "#efe5d2",
  BALANCE: "#f2c873",
  FIXES: "#e2685a",
};

type Filter = "ALL" | PatchNoteCategory;

/** How many entries the timeline shows before "Show more". */
const PAGE = 15;

function formatDate(iso: string, locale: string, style: "long" | "short" = "long"): string {
  const d = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return style === "long" ? d.toLocaleDateString(locale, { day: "numeric", month: "long", year: "numeric" }) : d.toLocaleDateString(locale, { day: "2-digit", month: "short", year: "numeric" });
}

/**
 * NOVIDADES — the real changelog. Every entry comes straight from
 * config/patchNotes.ts, the single source of truth for this page and the
 * Home teaser (see that file's header and CLAUDE.md for the contract: only
 * shipped, validated, player-facing changes; "Não inventar histórico").
 *
 * Laid out like a product release log: the current release in full at the
 * top, then a timeline of every version (number, date, category) with each
 * entry's details folded until opened, a category filter, a text search and
 * "show more" paging.
 */
export function NovidadesScreen({ onNavigate, onPlay }: NovidadesScreenProps) {
  const { t, language } = useLanguage();
  const locale = language === "ptBR" ? "pt-BR" : "en-US";
  const [filter, setFilter] = useState<Filter>("ALL");
  const [query, setQuery] = useState("");
  const [shown, setShown] = useState(PAGE);
  const [open, setOpen] = useState<Set<string>>(() => new Set());
  const latest = PATCH_NOTES[0];

  const counts = useMemo(() => {
    const m = new Map<PatchNoteCategory, number>();
    for (const e of PATCH_NOTES) m.set(e.category, (m.get(e.category) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, []);

  const list = useMemo(() => {
    const q = query.trim().toLocaleLowerCase(locale);
    return PATCH_NOTES.slice(1).filter((e) => {
      if (filter !== "ALL" && e.category !== filter) return false;
      if (!q) return true;
      const hay = [e.id, e.title[language], e.description[language], ...e.highlights.map((h) => h[language])].join(" ").toLocaleLowerCase(locale);
      return hay.includes(q);
    });
  }, [filter, query, language, locale]);

  const toggle = (id: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const catLabel = (c: PatchNoteCategory) => t(`novidades.categories.${c}` as TranslationKey);

  return (
    <div className="pg-root">
      <style>{PAGE_CSS + NEWS_CSS}</style>
      <TopNav active="NOVIDADES" onNavigate={onNavigate} onPlay={onPlay} />
      <div className="pg-scroll">
        <header className="pg-hero">
          <div className="pg-hero-inner">
            <div>
              <h1 className="pg-h1">{t("novidades.pageTitle")}</h1>
              <p className="pg-lead">{t("novidades.lead")}</p>
            </div>
            <dl className="nv-stats">
              <div>
                <dt>{t("novidades.currentVersion")}</dt>
                <dd>{latest?.id ?? "—"}</dd>
              </div>
              <div>
                <dt>{t("novidades.lastUpdateLabel")}</dt>
                <dd className="is-text">{latest?.dateIso ? formatDate(latest.dateIso, locale, "short") : "—"}</dd>
              </div>
              <div>
                <dt>{t("novidades.countLabel")}</dt>
                <dd>{PATCH_NOTES.length}</dd>
              </div>
            </dl>
          </div>
        </header>

        <div className="pg-wrap">
          {latest && (
            <article className="nv-release" data-testid="nv-latest" style={{ ["--cat" as string]: CATEGORY_COLOR[latest.category] }}>
              <div className="nv-release-meta">
                <span className="nv-ver">{latest.id}</span>
                <span className="nv-cat">{catLabel(latest.category)}</span>
                {latest.dateIso && <time dateTime={latest.dateIso}>{formatDate(latest.dateIso, locale)}</time>}
                <span className="nv-latest">{t("novidades.latest")}</span>
              </div>
              <h2>{latest.title[language]}</h2>
              <p className="nv-desc">{latest.description[language]}</p>
              {latest.highlights.length > 0 && (
                <ul className="nv-points">
                  {latest.highlights.map((h, i) => (
                    <li key={i}>{h[language]}</li>
                  ))}
                </ul>
              )}
            </article>
          )}

          <div className="nv-tools">
            <h2 className="pg-h2">{t("novidades.historyTitle")}</h2>
            <input className="nv-search" type="search" value={query} onChange={(e) => { setQuery(e.target.value); setShown(PAGE); }} placeholder={t("novidades.searchPlaceholder")} aria-label={t("novidades.searchPlaceholder")} />
          </div>
          <div className="pg-chips" role="toolbar" aria-label={t("novidades.filterLabel")}>
            <button className={filter === "ALL" ? "is-on" : ""} onClick={() => { setFilter("ALL"); setShown(PAGE); }}>
              {t("novidades.filterAll")}
              <small>{PATCH_NOTES.length - 1}</small>
            </button>
            {counts.map(([cat, n]) => (
              <button key={cat} className={filter === cat ? "is-on" : ""} onClick={() => { setFilter(cat); setShown(PAGE); }}>
                <i style={{ background: CATEGORY_COLOR[cat] }} aria-hidden="true" />
                {catLabel(cat)}
                <small>{n}</small>
              </button>
            ))}
          </div>

          <ol className="nv-timeline">
            {list.map((entry: PatchNoteEntry, idx: number) => {
              const isOpen = open.has(entry.id);
              // past the current page an entry stays in the page, only hidden until "Show more" (nothing is ever dropped)
              return (
                <li key={entry.id} hidden={idx >= shown} className={`nv-item${isOpen ? " is-open" : ""}`} style={{ ["--cat" as string]: CATEGORY_COLOR[entry.category] }}>
                  <div className="nv-when">
                    <span className="nv-ver">{entry.id}</span>
                    <span>{entry.dateIso ? formatDate(entry.dateIso, locale, "short") : t("novidades.earlyBuilds")}</span>
                  </div>
                  <div className="nv-body">
                    <span className="nv-cat">{catLabel(entry.category)}</span>
                    <h3>{entry.title[language]}</h3>
                    <p className="nv-desc">{entry.description[language]}</p>
                    {entry.highlights.length > 0 && (
                      <>
                        <ul className="nv-points" hidden={!isOpen}>
                          {entry.highlights.map((h, i) => (
                            <li key={i}>{h[language]}</li>
                          ))}
                        </ul>
                        <button className="nv-more" onClick={() => toggle(entry.id)} aria-expanded={isOpen}>
                          {isOpen ? t("novidades.hideDetails") : t("novidades.showDetails", { n: entry.highlights.length })}
                        </button>
                      </>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
          {list.length === 0 && <p className="nv-empty">{t("novidades.noResults")}</p>}
          {list.length > shown && (
            <button className="nv-load" onClick={() => setShown((n) => n + PAGE)}>
              {t("novidades.loadMore", { n: Math.min(PAGE, list.length - shown) })}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

const NEWS_CSS = `
.nv-stats { display: grid; grid-template-columns: repeat(3, auto); gap: 0 34px; margin: 0; text-align: right; align-self: end; }
.nv-stats dt { font-size: 12.5px; color: var(--ash); }
.nv-stats dd { margin: 4px 0 0; font-family: var(--display); font-weight: 700; font-size: clamp(28px, 3vw, 42px); line-height: 1; color: var(--bone); font-variant-numeric: lining-nums; }
.nv-stats dd.is-text { font-size: clamp(20px, 2vw, 26px); padding-top: 8px; }

.nv-release { position: relative; margin: 30px 0 8px; padding: 30px 34px 30px; border-radius: 14px; border: 1px solid var(--line); background: linear-gradient(180deg, rgba(232,176,75,0.07), rgba(232,176,75,0.015) 60%), #120c07; }
.nv-release::before { content: ""; position: absolute; left: 0; top: 24px; bottom: 24px; width: 3px; border-radius: 2px; background: var(--cat); }
.nv-release-meta { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 14px; font-size: 13px; color: var(--ash); }
.nv-release h2 { margin: 12px 0 0; font-family: var(--display); font-weight: 700; font-size: clamp(28px, 3vw, 40px); line-height: 1.08; color: var(--gold-hi); max-width: 26ch; }
.nv-release .nv-desc { font-size: 16px; }
.nv-release .nv-points { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px 34px; margin-top: 20px; }

.nv-ver { display: inline-block; padding: 2px 8px; border-radius: 6px; border: 1px solid var(--line); background: rgba(255,255,255,0.03); font-weight: 700; font-size: 12.5px; color: var(--bone); font-variant-numeric: tabular-nums; }
.nv-cat { display: inline-flex; align-items: center; gap: 7px; font-size: 12.5px; font-weight: 600; color: var(--cat); }
.nv-cat::before { content: ""; width: 7px; height: 7px; border-radius: 50%; background: var(--cat); }
.nv-latest { font-size: 12px; font-weight: 700; padding: 2px 9px; border-radius: 999px; background: var(--gold); color: #2b1906; }
.nv-desc { margin: 10px 0 0; font-size: 15px; line-height: 1.7; color: #d9cdb6; max-width: 70ch; }
.nv-item[hidden], .nv-points[hidden] { display: none !important; }
.nv-points { margin: 14px 0 0; padding: 0; list-style: none; display: grid; gap: 9px; }
.nv-points li { position: relative; padding-left: 18px; font-size: 14.5px; line-height: 1.6; color: var(--ash); max-width: 72ch; }
.nv-points li::before { content: ""; position: absolute; left: 1px; top: 0.72em; width: 6px; height: 1.5px; background: var(--gold); }

.nv-tools { display: flex; flex-wrap: wrap; align-items: end; justify-content: space-between; gap: 12px 24px; margin-top: 46px; }
.nv-search { width: min(320px, 100%); padding: 10px 14px; border-radius: 10px; border: 1px solid var(--line); background: #0f0a06; color: var(--bone); font: inherit; font-size: 14px; }
.nv-search:focus-visible { outline: 2px solid var(--gold-hi); outline-offset: 2px; }
.pg-chips button i { display: inline-block; width: 7px; height: 7px; border-radius: 50%; margin-right: 6px; vertical-align: 1px; }

.nv-timeline { list-style: none; margin: 18px 0 0; padding: 0; }
.nv-item { display: grid; grid-template-columns: 150px minmax(0, 1fr); gap: 0 34px; }
.nv-when { position: relative; display: grid; align-content: start; justify-items: end; gap: 6px; padding: 26px 26px 0 0; border-right: 1px solid var(--line); font-size: 13px; color: var(--ash); text-align: right; }
.nv-when::after { content: ""; position: absolute; right: -6px; top: 31px; width: 11px; height: 11px; border-radius: 50%; background: #120c07; border: 2px solid var(--cat); }
.nv-body { padding: 22px 0 26px; border-bottom: 1px solid var(--line-soft); }
.nv-body h3 { margin: 6px 0 0; font-family: var(--display); font-weight: 700; font-size: clamp(21px, 2vw, 25px); line-height: 1.15; color: var(--bone); }
.nv-more { margin-top: 12px; padding: 0; border: 0; background: none; color: var(--gold-hi) !important; font-size: 13.5px; font-weight: 600; cursor: pointer; text-decoration: underline; text-underline-offset: 3px; text-decoration-color: rgba(247,220,156,0.35); }
.nv-more:hover { text-decoration-color: currentColor; }
.nv-more:focus-visible, .nv-load:focus-visible { outline: 2px solid var(--gold-hi); outline-offset: 3px; }
.nv-empty { margin: 30px 0; color: var(--ash); }
.nv-load { display: block; margin: 30px auto 90px; padding: 12px 26px; border-radius: 10px; border: 1px solid var(--line); background: rgba(255,255,255,0.03); color: var(--bone) !important; font-weight: 600; cursor: pointer; }
.nv-load:hover { border-color: var(--gold); }
.nv-timeline + .nv-empty + .nv-load, .nv-timeline:last-child { margin-bottom: 90px; }

@media (max-width: 860px) {
  .nv-stats { grid-template-columns: repeat(3, auto); justify-content: start; text-align: left; margin-top: 18px; }
  .nv-release { padding: 24px 20px; }
  .nv-release .nv-points { grid-template-columns: 1fr; }
  .nv-item { grid-template-columns: 1fr; }
  .nv-when { justify-items: start; text-align: left; grid-auto-flow: column; justify-content: start; padding: 20px 0 0 18px; border-right: 0; border-left: 1px solid var(--line); }
  .nv-when::after { right: auto; left: -6px; top: 25px; }
  .nv-body { padding: 8px 0 22px 18px; border-left: 1px solid var(--line); }
}
`;
