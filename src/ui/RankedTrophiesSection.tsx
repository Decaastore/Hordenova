import { useLanguage } from "@/i18n/LanguageContext";
import type { TranslationKey } from "@/i18n/translate";
import { loadSave } from "@/engine/SaveSystem";
import { RANKED_SETS, rankedTitleFor, type RankedBoard } from "@/config/rankedRewards";
import { Castle3DPortrait, Tower3DPortrait } from "@/ui/Tower3DPortrait";
import { MAX_TOWER_LEVEL, type TowerType } from "@/config/towerStats";

const BOARDS: RankedBoard[] = ["ETERNAL", "DUEL", "SEASON"];

/** "2026" → "2026", "2026-11" → "nov/2026", "season-23" → "Season 23". */
function periodLabel(period: string, locale: string) {
  const m = /^(\d{4})-(\d{2})$/.exec(period);
  if (m) return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, 15)).toLocaleDateString(locale, { month: "short", year: "numeric", timeZone: "UTC" });
  const s = /^season-(\d+)$/.exec(period);
  if (s) return `Season ${s[1]}`;
  return period;
}

/**
 * PROFILE — everything the player has won in the rankings: a trophy for every
 * placement (kept forever) and the three exclusive collections, lit where
 * owned and dimmed where still to win.
 */
export function RankedTrophiesSection() {
  const { t, language } = useLanguage();
  const locale = language === "ptBR" ? "pt-BR" : "en-US";
  const save = loadSave();
  const trophies = [...save.rankedTrophies].sort((a, b) => a.place - b.place || b.atMs - a.atMs);
  const ownsTower = (id: string) => save.ownedTowerSkinIds.includes(id);
  const ownsCastle = (id: string) => save.unlockedCastleSkinIds.includes(id);

  return (
    <section className="ac-block" data-testid="ranked-trophies">
      <style>{RT_CSS}</style>
      <h2 className="pg-h2">{t("ranked.profileTitle")}</h2>
      {trophies.length === 0 ? (
        <p className="pg-sub">{t("ranked.profileNone")}</p>
      ) : (
        <ul className="rt-trophies">
          {trophies.map((tr) => (
            <li key={`${tr.board}:${tr.period}`} className={`is-${tr.board.toLowerCase()}${tr.place <= 3 ? ` is-p${tr.place}` : ""}`}>
              <b>{t("ranked.place", { n: tr.place })}</b>
              <em>{t(`ranked.titles.${rankedTitleFor(tr.board, tr.place) ?? "SEASON_TOP20"}` as TranslationKey)}</em>
              <span>{t(`ranked.board.${tr.board}` as TranslationKey)}</span>
              <small>{periodLabel(tr.period, locale)}</small>
            </li>
          ))}
        </ul>
      )}
      <div className="rt-sets">
        {BOARDS.map((board) => {
          const set = RANKED_SETS[board];
          const towers = Object.entries(set.towers) as [TowerType, string][];
          const owned = towers.filter(([, id]) => ownsTower(id)).length + (ownsCastle(set.castle) ? 1 : 0);
          return (
            <div key={board} className={`rt-set is-${board.toLowerCase()}`}>
              <div className="rt-head">
                <h3>{t(`ranked.setName.${board}` as TranslationKey)}</h3>
                <span>{owned} / 5</span>
              </div>
              <div className={`rt-castle${ownsCastle(set.castle) ? "" : " is-locked"}`}>
                <Castle3DPortrait dressing="ANCIENT_FOREST" skin={set.castle} width={220} height={120} spin={false} />
              </div>
              <div className="rt-towers">
                {towers.map(([type, id]) => (
                  <div key={id} className={ownsTower(id) ? "" : "is-locked"}>
                    <Tower3DPortrait type={type} level={MAX_TOWER_LEVEL} skinId={id} width={58} height={70} spin={false} />
                  </div>
                ))}
              </div>
              <small>{t("ranked.topN", { n: board === "SEASON" ? 5 : 10 })} · {t(`ranked.board.${board}` as TranslationKey)}</small>
            </div>
          );
        })}
      </div>
    </section>
  );
}

const RT_CSS = `
.rt-trophies { list-style: none; margin: 14px 0 0; padding: 0; display: flex; flex-wrap: wrap; gap: 10px; }
.rt-trophies li { --rt: #e8b04b; display: grid; gap: 1px; min-width: 150px; padding: 10px 14px; border-radius: 12px; border: 1px solid color-mix(in srgb, var(--rt) 55%, transparent);
  background: radial-gradient(90% 90% at 0% 0%, color-mix(in srgb, var(--rt) 22%, transparent), rgba(24,18,12,0.7)); }
.rt-trophies li.is-eternal { --rt: #b07aff; }
.rt-trophies li.is-duel { --rt: #e05a32; }
.rt-trophies li.is-season { --rt: #5a8aff; }
.rt-trophies b { font-family: var(--display); font-size: 26px; line-height: 1; color: #fff3d6; }
.rt-trophies li.is-p1 b { color: #ffe08a; }
.rt-trophies em { font-style: normal; font-family: var(--display); font-size: 17px; color: color-mix(in srgb, var(--rt) 45%, #fff3d6); }
.rt-trophies span { font-size: 13.5px; font-weight: 700; color: var(--bone); }
.rt-trophies small { font-size: 12px; color: var(--ash); }
.rt-sets { display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 12px; margin-top: 16px; }
.rt-set { --rt: #e8b04b; display: grid; justify-items: center; padding: 14px; border-radius: 12px; border: 1px solid color-mix(in srgb, var(--rt) 40%, transparent);
  background: radial-gradient(70% 50% at 50% 35%, color-mix(in srgb, var(--rt) 16%, transparent), rgba(24,18,12,0.6)); }
.rt-set.is-eternal { --rt: #b07aff; }
.rt-set.is-duel { --rt: #e05a32; }
.rt-set.is-season { --rt: #5a8aff; }
.rt-head { width: 100%; display: flex; justify-content: space-between; align-items: baseline; gap: 10px; }
.rt-head h3 { margin: 0; font-family: var(--display); font-size: 18px; color: var(--bone); }
.rt-head span { font-size: 13px; font-weight: 800; color: color-mix(in srgb, var(--rt) 60%, #fff3d6); font-variant-numeric: tabular-nums; }
.rt-castle, .rt-towers > div { line-height: 0; transition: filter 200ms ease, opacity 200ms ease; }
.rt-towers { display: flex; gap: 2px; margin-top: -4px; }
.is-locked { filter: grayscale(0.85) brightness(0.55); opacity: 0.7; }
.rt-set small { margin-top: 6px; font-size: 12px; color: var(--ash); }
`;
