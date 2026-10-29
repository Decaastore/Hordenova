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

function formatDate(iso: string, locale: string): string {
  const d = new Date(`${iso}T12:00:00`);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString(locale, { day: "numeric", month: "long", year: "numeric" });
}

/**
 * NOVIDADES — the real changelog. Every entry comes straight from
 * config/patchNotes.ts, the single source of truth for this page and the
 * Home teaser (see that file's header and CLAUDE.md for the contract: only
 * shipped, validated, player-facing changes; "Não inventar histórico").
 * Entries are grouped under their ship date, newest first, with a category
 * filter; the default view shows every entry in full.
 */
export function NovidadesScreen({ onNavigate, onPlay }: NovidadesScreenProps) {
  const { t, language } = useLanguage();
  const locale = language === "ptBR" ? "pt-BR" : "en-US";
  const [filter, setFilter] = useState<Filter>("ALL");
  const latestId = PATCH_NOTES[0]?.id;

  const counts = useMemo(() => {
    const m = new Map<PatchNoteCategory, number>();
    for (const e of PATCH_NOTES) m.set(e.category, (m.get(e.category) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, []);

  const groups = useMemo(() => {
    const out: { date: string | null; entries: PatchNoteEntry[] }[] = [];
    for (const e of PATCH_NOTES) {
      if (filter !== "ALL" && e.category !== filter) continue;
      const last = out[out.length - 1];
      if (last && last.date === e.dateIso) last.entries.push(e);
      else out.push({ date: e.dateIso, entries: [e] });
    }
    return out;
  }, [filter]);

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
            <dl className="pg-score">
              <dt>{t("novidades.countLabel")}</dt>
              <dd>{PATCH_NOTES.length}</dd>
              {PATCH_NOTES[0]?.dateIso && <p>{t("novidades.lastUpdate", { date: formatDate(PATCH_NOTES[0].dateIso, locale) })}</p>}
            </dl>
          </div>
        </header>

        <div className="pg-wrap">
          <div className="pg-chips" role="toolbar" aria-label={t("novidades.filterLabel")}>
            <button className={filter === "ALL" ? "is-on" : ""} onClick={() => setFilter("ALL")}>
              {t("novidades.filterAll")}
              <small>{PATCH_NOTES.length}</small>
            </button>
            {counts.map(([cat, n]) => (
              <button key={cat} className={filter === cat ? "is-on" : ""} onClick={() => setFilter(cat)}>
                {t(`novidades.categories.${cat}` as TranslationKey)}
                <small>{n}</small>
              </button>
            ))}
          </div>

          <div className="nv-feed">
            {groups.map((group, gi) => (
              <section key={`${group.date ?? "undated"}-${gi}`} className="nv-day">
                <div className="nv-date">
                  {group.date ? <time dateTime={group.date}>{formatDate(group.date, locale)}</time> : <span>{t("novidades.earlyBuilds")}</span>}
                </div>
                <div className="nv-entries">
                  {group.entries.map((entry) => (
                    <article key={entry.id} className={`nv-entry${entry.id === latestId ? " is-latest" : ""}`}>
                      <p className="nv-meta">
                        <span style={{ color: CATEGORY_COLOR[entry.category] }}>{t(`novidades.categories.${entry.category}` as TranslationKey)}</span>
                        {entry.id === latestId && <span className="nv-latest">{t("novidades.latest")}</span>}
                      </p>
                      <h2>{entry.title[language]}</h2>
                      <p className="nv-desc">{entry.description[language]}</p>
                      {entry.highlights.length > 0 && (
                        <ul>
                          {entry.highlights.map((highlight, i) => (
                            <li key={i}>{highlight[language]}</li>
                          ))}
                        </ul>
                      )}
                    </article>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

const NEWS_CSS = `
.nv-feed { padding: 18px 0 96px; }
.nv-day { display: grid; grid-template-columns: 200px minmax(0, 1fr); gap: 32px; padding: 32px 0; border-top: 1px solid var(--line); }
.nv-day:first-child { border-top: none; }
.nv-date { position: sticky; top: 16px; align-self: start; font-family: var(--display); font-weight: 700; font-size: 22px; line-height: 1.15; color: var(--gold-hi); }
.nv-entries { display: grid; gap: 36px; max-width: 760px; }
.nv-meta { margin: 0; display: flex; align-items: center; gap: 12px; font-size: 13px; font-weight: 600; }
.nv-latest { font-size: 12px; font-weight: 700; padding: 2px 9px; border-radius: 999px; background: var(--gold); color: #2b1906; }
.nv-entry h2 { margin: 6px 0 0; font-family: var(--display); font-weight: 700; font-size: clamp(24px, 2.4vw, 30px); line-height: 1.12; color: var(--bone); }
.nv-entry.is-latest h2 { font-size: clamp(28px, 3vw, 38px); color: var(--gold-hi); }
.nv-desc { margin: 10px 0 0; font-size: 15.5px; line-height: 1.7; color: #d9cdb6; max-width: 68ch; }
.nv-entry ul { margin: 14px 0 0; padding: 0; list-style: none; display: grid; gap: 8px; }
.nv-entry li { position: relative; padding-left: 20px; font-size: 14.5px; line-height: 1.6; color: var(--ash); max-width: 70ch; }
.nv-entry li::before { content: ""; position: absolute; left: 2px; top: 0.7em; width: 6px; height: 6px; border-radius: 50%; background: var(--gold); opacity: 0.7; }
@media (max-width: 820px) {
  .nv-day { grid-template-columns: 1fr; gap: 14px; padding: 26px 0; }
  .nv-date { position: static; font-size: 20px; }
}
`;
