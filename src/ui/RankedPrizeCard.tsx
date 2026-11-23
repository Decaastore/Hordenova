import { useEffect, useState } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import type { TranslationKey } from "@/i18n/translate";
import { RANKED_PRIZES, RANKED_SETS, rankedPeriod, rankedTitleFor, type RankedBoard, type RankedPrizeTier } from "@/config/rankedRewards";
import { ItemGlyph } from "@/ui/ItemGlyph";
import { SEASON_PARTICIPATION_FREE_GEMS } from "@/engine/AscensionManager";
import { formatDurationShort } from "@/utils/formatDuration";
import { Castle3DPortrait, Tower3DPortrait } from "@/ui/Tower3DPortrait";
import { MAX_TOWER_LEVEL } from "@/config/towerStats";
import type { TowerType } from "@/config/towerStats";

/**
 * RANKING PRIZES — what the top of a ranking wins at the end of its period
 * (config/rankedRewards.ts): the exclusive set in 3D, every prize place with
 * its Free Gems, the time left in the period, and an honest line on how
 * places are decided (only the online ranking places players).
 */
export function RankedPrizeCard({ board, compact = false }: { board: RankedBoard; compact?: boolean }) {
  const { t, language } = useLanguage();
  const locale = language === "ptBR" ? "pt-BR" : "en-US";
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);
  const period = rankedPeriod(board, now);
  const set = RANKED_SETS[board];
  const towers = Object.entries(set.towers) as [TowerType, string][];
  const place = (from: number, to: number) => (from === to ? t("ranked.place", { n: from }) : t("ranked.placeRange", { a: from, b: to }));

  return (
    <div className={`rp-card is-${board.toLowerCase()}`} data-testid={`ranked-prizes-${board}`}>
      <style>{RP_CSS}</style>
      <h3>{t("ranked.prizesTitle")}</h3>
      <p className="rp-period">
        {t(`ranked.period.${board}` as TranslationKey)} · {t("ranked.endsIn", { time: formatDurationShort(Math.max(0, period.endsAtMs - now)) })}
      </p>
      {!compact && (
        <figure className="rp-set">
          <div className="rp-castle">
            <Castle3DPortrait dressing="ANCIENT_FOREST" skin={set.castle} width={270} height={150} />
          </div>
          <div className="rp-towers">
            {towers.map(([type, id]) => (
              <Tower3DPortrait key={id} type={type} level={MAX_TOWER_LEVEL} skinId={id} width={70} height={86} />
            ))}
          </div>
          <figcaption>{t(`ranked.setName.${board}` as TranslationKey)}</figcaption>
          {board === "ETERNAL" && (
            <div className="rp-relics">
              {["immortal_hourglass", "eternal_sand"].map((id) => (
                <span key={id} className="rp-relic">
                  <ItemGlyph itemDefinitionId={id} size={46} />
                  <small>{t(`items.${id}.name` as TranslationKey)}</small>
                </span>
              ))}
            </div>
          )}
        </figure>
      )}
      <ol className="rp-list">
        {RANKED_PRIZES[board].map((tier) => (
          <li key={tier.from} className={tier.from <= 3 ? `is-${tier.from}` : ""}>
            <span className="rp-place">{place(tier.from, tier.to)}</span>
            <span className="rp-prize">
              <span className="rp-gems">{t("ranked.gems", { n: tier.freeGems.toLocaleString(locale) })}</span>
              {tierExtras(board, tier, t, locale).map((line) => (
                <span key={line} className={`rp-what${line.startsWith("★") ? " is-relic" : ""}`}>
                  {line}
                </span>
              ))}
            </span>
          </li>
        ))}
      </ol>
      <p className="rp-note">{t("ranked.setNote")}</p>
      <p className="rp-note">{t("ranked.howNote", { gems: SEASON_PARTICIPATION_FREE_GEMS })}</p>
    </div>
  );
}

/** Everything a prize tier gives besides its Gems, one plain line each (relic lines start with ★). */
export function tierExtras(board: RankedBoard, tier: RankedPrizeTier, t: (k: TranslationKey, v?: Record<string, string | number>) => string, locale: string): string[] {
  const out: string[] = [];
  if (tier.set) out.push(`+ ${tier.set === "FULL" ? t("ranked.setFull") : t("ranked.setCastle")}`);
  if (tier.relic) out.push(`★ ${t("ranked.relic", { name: t(`items.${tier.relic}.name` as TranslationKey) })}`);
  if (tier.looks?.length) out.push(`+ ${t("ranked.looks", { list: tier.looks.map((id) => t(`duel.shop.${id}` as TranslationKey)).join(", ") })}`);
  if (tier.duelCoins) out.push(`+ ${t("ranked.coins", { n: tier.duelCoins.toLocaleString(locale) })}`);
  const title = rankedTitleFor(board, tier.from);
  if (title) out.push(`+ ${t("ranked.titleLine", { title: t(`ranked.titles.${title}` as TranslationKey) })}`);
  return out;
}

const RP_CSS = `
.rp-card { --rp: #e8b04b; padding: 18px; border-radius: 16px; border: 1px solid color-mix(in srgb, var(--rp) 45%, transparent);
  background: radial-gradient(90% 50% at 50% 0%, color-mix(in srgb, var(--rp) 18%, transparent), transparent 70%), linear-gradient(180deg, rgba(42,30,18,0.9), rgba(14,10,6,0.95));
  box-shadow: inset 0 1px 0 rgba(255,236,190,0.08), 0 10px 22px rgba(0,0,0,0.35); }
.rp-card.is-eternal { --rp: #b07aff; }
.rp-card.is-duel { --rp: #e05a32; }
.rp-card.is-season { --rp: #5a8aff; }
.rp-card h3 { margin: 0; font-family: var(--display); font-size: 21px; color: var(--bone); }
.rp-period { margin: 4px 0 0; font-size: 12.5px; color: var(--ash); line-height: 1.45; }
.rp-set { margin: 12px 0 0; display: grid; justify-items: center; gap: 2px; padding: 8px 0 10px; border-radius: 12px; background: radial-gradient(60% 70% at 50% 45%, color-mix(in srgb, var(--rp) 22%, transparent), rgba(0,0,0,0.25)); }
.rp-castle { line-height: 0; }
.rp-towers { display: flex; justify-content: center; gap: 2px; margin-top: -6px; line-height: 0; }
.rp-set figcaption { margin-top: 6px; font-family: var(--display); font-size: 16px; color: color-mix(in srgb, var(--rp) 55%, #fff3d6); }
.rp-list { list-style: none; margin: 12px 0 0; padding: 0; display: grid; gap: 5px; }
.rp-list li { display: grid; grid-template-columns: 62px minmax(0, 1fr); align-items: center; gap: 8px; padding: 7px 10px; border-radius: 10px; background: rgba(0,0,0,0.28); border: 1px solid rgba(255,236,190,0.08); }
.rp-list li.is-1 { border-color: rgba(240,190,82,0.6); background: linear-gradient(90deg, rgba(240,190,82,0.16), rgba(0,0,0,0.28)); }
.rp-list li.is-2 { border-color: rgba(200,204,216,0.45); }
.rp-list li.is-3 { border-color: rgba(201,138,78,0.5); }
.rp-place { font-family: var(--display); font-weight: 700; font-size: 18px; color: var(--gold-hi); font-variant-numeric: lining-nums; white-space: nowrap; }
.rp-prize { display: grid; gap: 1px; min-width: 0; }
.rp-what { font-size: 12px; color: color-mix(in srgb, var(--rp) 45%, #e8dcc4); line-height: 1.3; }
.rp-gems { font-size: 14px; font-weight: 800; color: #a8dcff; font-variant-numeric: tabular-nums; }
.rp-what.is-relic { color: #ffd878; font-weight: 700; }
.rp-relics { display: flex; justify-content: center; gap: 14px; margin-top: 8px; }
.rp-relic { display: grid; justify-items: center; gap: 2px; max-width: 110px; text-align: center; }
.rp-relic small { font-size: 11.5px; color: #ffd878; line-height: 1.25; }
.rp-note { margin: 10px 0 0; font-size: 12px; color: var(--ash); line-height: 1.5; }
`;
