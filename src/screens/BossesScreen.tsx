import { useEffect, useState } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import type { TranslationKey } from "@/i18n/translate";
import { TopNav, type NavView } from "@/ui/TopNav";
import { PAGE_CSS } from "@/ui/pageChrome";
import { BossPortrait } from "@/ui/CreaturePortrait";
import { ColossusShowcase } from "@/ui/ColossusPromo";
import { loadSave } from "@/engine/SaveSystem";
import { MAIN_BOSSES, MINI_BOSSES, type BossDefinition } from "@/config/bossConfig";
import { BOSS_STARS, bossBestiaryStats, bossStars } from "@/config/bossBestiary";
import { PHASES } from "@/config/phaseConfig";
import { BARRIER, MINI_HARDEN, ROAR, ROAR_IMMUNITY_MS } from "@/config/bossFury";
import { ENRAGE_SHIELD_DAMAGE_REDUCTION } from "@/config/enrageShield";
import { ENRAGE_HP_THRESHOLD } from "@/engine/BossManager";
import {
  attemptsLeft,
  COLOSSUS_ATTEMPTS_PER_DAY,
  COLOSSUS_LENGTH_MS,
  COLOSSUS_MARK_GOALS,
  COLOSSUS_PHASES,
  COLOSSUS_ROOM_SIZE,
  COLOSSUS_WORLD_GEMS,
  COLOSSUS_DAILY_GEMS,
  placePrize,
  weekEndsAt,
  worldState,
} from "@/config/colossus";
import { formatDurationShort } from "@/utils/formatDuration";
import { phaseOfMiniBoss } from "./wiki/wikiData";
import { bossWeakness, mainBossHp, WEAKNESS_DAMAGE_MULTIPLIER } from "@/config/bossAssault";
import { previousWaveTotalHp } from "@/engine/BossManager";
import { DROP_TABLES } from "@/config/dropTables";
import { ItemGlyph } from "@/ui/ItemGlyph";

interface BossesScreenProps {
  onNavigate: (view: NavView) => void;
  onPlay: () => void;
  onPlayColossus: () => void;
}

const assetBase = (import.meta.env?.BASE_URL ?? "/").replace(/\/?$/, "/");
const sec = (ms: number) => Math.round(ms / 100) / 10;
const pct = (f: number) => Math.round(f * 100);

/**
 * BOSSES (owner's call, Nov 2026: "uma parte dos bosses, para falar sobre
 * todos os bosses e uma parte sobre o boss global"). One page for every
 * boss in the game: the weekly Global Boss first (live), then how every
 * boss fights (the shared fury rules, with their real numbers), then each
 * region's boss in the order you meet them, then the mini-bosses — each with
 * the player's own stars from the boss bestiary.
 */
export function BossesScreen({ onNavigate, onPlay, onPlayColossus }: BossesScreenProps) {
  const { t, language } = useLanguage();
  const locale = language === "ptBR" ? "pt-BR" : "en-US";
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);
  const save = loadSave();
  const kills = save.bossKills;
  const stats = bossBestiaryStats(kills);
  const world = worldState(save.colossus, now);
  const attempts = attemptsLeft(save.colossus, now);
  const leaves = Math.max(0, weekEndsAt(now) - now);

  const regions = PHASES.map((ph, i) => ({ ph, n: i + 1, boss: MAIN_BOSSES[ph.mainBossId] })).filter((r): r is { ph: (typeof PHASES)[number]; n: number; boss: BossDefinition } => !!r.boss);
  const minis = Object.values(MINI_BOSSES);
  const total = regions.length + minis.length;
  const first = placePrize(1);

  return (
    <div className="pg-root">
      <style>{PAGE_CSS + BOSSES_CSS}</style>
      <TopNav active="BOSSES" onNavigate={onNavigate} onPlay={onPlay} />
      <div className="pg-scroll">
        <header className="pg-hero bs-hero">
          <div className="pg-hero-inner">
            <div>
              <h1 className="pg-h1">{t("bossesPage.title")}</h1>
              <p className="pg-lead">{t("bossesPage.lead", { regions: regions.length, minis: minis.length })}</p>
              <p className="bs-progress" data-testid="bosses-progress">
                {t("bossesPage.progress", { met: stats.met, mastered: stats.mastered, total })}
              </p>
            </div>
          </div>
        </header>

        <div className="pg-wrap bs-wrap">
          {/* ---------------------------------------------------------------- GLOBAL BOSS */}
          <section className="bs-global" id="global" data-testid="bosses-global">
            <div className="bs-global-art">
              <ColossusShowcase className="bs-global-canvas" />
              <div className="bs-live">
                <span className="bs-dot" aria-hidden="true" />
                {world.defeated ? t("colossus.homeDefeated") : t("colossus.homeLive")}
              </div>
            </div>
            <div className="bs-global-body">
              <p className="bs-kicker">{t("bossesPage.globalKicker")}</p>
              <h2 className="pg-h2">{t("colossus.title")}</h2>
              <p className="bs-text">{t("bossesPage.globalLead")}</p>
              <div className="bs-life" role="img" aria-label={t("colossus.homeLife", { pct: (world.fraction * 100).toFixed(1) })}>
                <div className="bs-life-top">
                  <span>{t("colossus.worldLife")}</span>
                  <strong>{world.defeated ? t("colossus.worldDefeated") : t("colossus.homeLife", { pct: (world.fraction * 100).toFixed(1) })}</strong>
                </div>
                <div className="bs-life-bar">
                  <i style={{ width: `${Math.max(0, Math.min(100, world.fraction * 100))}%` }} />
                </div>
                <div className="bs-life-foot">
                  <span>{t("colossus.homeLeaves", { time: formatDurationShort(leaves) })}</span>
                  <span>{t("colossus.homeAttempts", { n: attempts, max: COLOSSUS_ATTEMPTS_PER_DAY })}</span>
                </div>
              </div>
              <dl className="bs-facts">
                <div>
                  <dt>{t("bossesPage.factRoom")}</dt>
                  <dd>{t("bossesPage.factRoomValue", { n: COLOSSUS_ROOM_SIZE })}</dd>
                </div>
                <div>
                  <dt>{t("bossesPage.factAttempts")}</dt>
                  <dd>{t("bossesPage.factAttemptsValue", { n: COLOSSUS_ATTEMPTS_PER_DAY, s: Math.round(COLOSSUS_LENGTH_MS / 1000) })}</dd>
                </div>
                <div>
                  <dt>{t("bossesPage.factWeek")}</dt>
                  <dd>{t("bossesPage.factWeekValue")}</dd>
                </div>
                <div>
                  <dt>{t("bossesPage.factPrize")}</dt>
                  <dd>{t("bossesPage.factPrizeValue", { daily: COLOSSUS_DAILY_GEMS, world: COLOSSUS_WORLD_GEMS, splinters: first.splinters })}</dd>
                </div>
              </dl>
              <button className="pg-btn bs-cta" onClick={onPlayColossus} data-testid="bosses-open-colossus">
                {t("colossus.open")}
              </button>
            </div>
            <ol className="bs-acts">
              {COLOSSUS_PHASES.map((ph, i) => (
                <li key={ph.id}>
                  <span className="bs-act-time">{t("bossesPage.actFrom", { s: Math.round(ph.fromMs / 1000) })}</span>
                  <strong>{t(`colossus.phase.${ph.id}` as TranslationKey)}</strong>
                  <p>{t(`colossus.how${i + 1}` as TranslationKey)}</p>
                </li>
              ))}
            </ol>
            <p className="bs-fine">
              {t("bossesPage.marks", { a: COLOSSUS_MARK_GOALS[0]!.marks, b: COLOSSUS_MARK_GOALS[2]!.marks })} {t("colossus.simNote", { n: COLOSSUS_ROOM_SIZE - 1 })}
            </p>
          </section>

          {/* ---------------------------------------------------------------- HOW BOSSES FIGHT */}
          <section className="bs-section" id="fury">
            <h2 className="pg-h2">{t("bossesPage.furyTitle")}</h2>
            <p className="pg-sub">{t("bossesPage.furyLead")}</p>
            <div className="bs-rules">
              <article className="bs-rule is-roar">
                <h3>{t("bossesPage.roarTitle")}</h3>
                <p>{t("bossesPage.roarText", { s: sec(ROAR.main.telegraphMs) })}</p>
                <dl>
                  <div>
                    <dt>{t("bossesPage.colMain")}</dt>
                    <dd>{t("bossesPage.roarValue", { every: sec(ROAR.main.intervalMs), stun: sec(ROAR.main.stunMs), n: ROAR.main.maxTowers })}</dd>
                  </div>
                  <div>
                    <dt>{t("bossesPage.colMini")}</dt>
                    <dd>{t("bossesPage.roarValue", { every: sec(ROAR.mini.intervalMs), stun: sec(ROAR.mini.stunMs), n: ROAR.mini.maxTowers })}</dd>
                  </div>
                </dl>
                <p className="bs-fine">{t("bossesPage.roarFair", { s: sec(ROAR_IMMUNITY_MS) })}</p>
              </article>
              <article className="bs-rule is-barrier">
                <h3>{t("bossesPage.barrierTitle")}</h3>
                <p>{t("bossesPage.barrierText", { hp: pct(BARRIER.hpFraction), block: pct(BARRIER.damageReduction), s: sec(BARRIER.durationMs), guards: BARRIER.guards })}</p>
              </article>
              <article className="bs-rule is-harden">
                <h3>{t("bossesPage.hardenTitle")}</h3>
                <p>{t("bossesPage.hardenText", { hp: pct(MINI_HARDEN.hpFraction), block: pct(MINI_HARDEN.damageReduction), s: sec(MINI_HARDEN.durationMs) })}</p>
              </article>
              <article className="bs-rule is-enrage">
                <h3>{t("bossesPage.enrageTitle")}</h3>
                <p>{t("bossesPage.enrageText", { hp: pct(ENRAGE_HP_THRESHOLD), main: pct(ENRAGE_SHIELD_DAMAGE_REDUCTION.MAIN_BOSS), mini: pct(ENRAGE_SHIELD_DAMAGE_REDUCTION.MINI_BOSS) })}</p>
              </article>
            </div>
          </section>

          {/* ---------------------------------------------------------------- REGION BOSSES */}
          <section className="bs-section" id="regions">
            <h2 className="pg-h2">{t("bossesPage.regionsTitle")}</h2>
            <p className="pg-sub">{t("bossesPage.regionsLead", { stars: BOSS_STARS.join(" / ") })}</p>
            <div className="bs-grid">
              {regions.map(({ ph, n, boss }) => (
                <BossCard
                  key={boss.id}
                  boss={boss}
                  wave={ph.endWave}
                  kills={kills[boss.id] ?? 0}
                  where={t("bossesPage.regionWhere", { n, region: t(`phases.${ph.i18nKey}.name` as TranslationKey), wave: ph.endWave.toLocaleString(locale) })}
                />
              ))}
            </div>
          </section>

          {/* ---------------------------------------------------------------- MINI-BOSSES */}
          <section className="bs-section" id="minis">
            <h2 className="pg-h2">{t("bossesPage.minisTitle")}</h2>
            <p className="pg-sub">{t("bossesPage.minisLead")}</p>
            <div className="bs-grid is-mini">
              {minis.map((boss) => {
                const home = phaseOfMiniBoss(boss.id);
                return (
                  <BossCard
                    key={boss.id}
                    boss={boss}
                    kills={kills[boss.id] ?? 0}
                    where={home ? t("bossesPage.miniWhere", { region: t(`phases.${home.phase.i18nKey}.name` as TranslationKey) }) : t("bossesPage.miniRotation")}
                  />
                );
              })}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

/** The boss's frame from the real battle; while a frame is missing, its bestiary portrait stands in. */
function BossArt({ boss, alt }: { boss: BossDefinition; alt: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return <div className="bs-card-fallback"><BossPortrait bossId={boss.id} size={boss.isMainBoss ? 120 : 100} /></div>;
  return <img src={`${assetBase}bosses/${boss.id}.webp`} alt={alt} loading="lazy" width={460} height={400} onError={() => setFailed(true)} />;
}

function BossCard({ boss, kills, where, wave }: { boss: BossDefinition; kills: number; where: string; wave?: number }) {
  const { t, language } = useLanguage();
  const locale = language === "ptBR" ? "pt-BR" : "en-US";
  const stars = bossStars(kills);
  const met = kills > 0;
  // the boss's real life at its own wave (the same formula the battle uses), before Season rules
  const hp = boss.isMainBoss && wave ? mainBossHp(boss.id, previousWaveTotalHp(wave)) : null;
  const weak = boss.isMainBoss ? bossWeakness(boss.id) : null;
  const drops = boss.dropTableId ? (DROP_TABLES[boss.dropTableId]?.entries ?? []) : [];
  return (
    <article className={`bs-card${boss.isMainBoss ? " is-main" : ""}${met ? "" : " is-unmet"}`} data-testid={`boss-card-${boss.id}`}>
      <div className="bs-card-art">
        {/* the boss exactly as it walks the road in its region (a frame of the real battle, public/bosses/) */}
        <BossArt boss={boss} alt={t(`bosses.${boss.i18nKey}.name` as TranslationKey)} />
      </div>
      <div className="bs-card-body">
        <p className="bs-where">{where}</p>
        <h3>{t(`bosses.${boss.i18nKey}.name` as TranslationKey)}</h3>
        <p className="bs-ability">
          <strong>{t(`wiki.abilities.${boss.ability}.name` as TranslationKey)}.</strong> {t(`wiki.abilities.${boss.ability}.description` as TranslationKey, { seconds: sec(boss.abilityIntervalMs) })}
        </p>
        {weak && (
          <p className="bs-weak" data-testid={`boss-weak-${boss.id}`}>
            {t(boss.ability === "SHIELD" ? "bossesPage.weaknessShield" : "bossesPage.weakness", { tower: t(`towers.${weak}.name` as TranslationKey), pct: Math.round((WEAKNESS_DAMAGE_MULTIPLIER - 1) * 100) })}
          </p>
        )}
      </div>
      <dl className="bs-stats">
        <div>
          <dt>{hp !== null ? t("bossesPage.hpAt", { wave: (wave ?? 0).toLocaleString(locale) }) : t("bossesPage.hpMini")}</dt>
          <dd>{hp !== null ? hp.toLocaleString(locale) : `×${boss.hpMultiplierVsBrute}`}</dd>
        </div>
        <div>
          <dt>{t("wiki.speed")}</dt>
          <dd>{boss.speed}</dd>
        </div>
        <div>
          <dt>{t("wiki.resistance")}</dt>
          <dd>{boss.resistance > 0 ? `${Math.round(boss.resistance * 100)}%` : "—"}</dd>
        </div>
        <div>
          <dt>{t("wiki.regen")}</dt>
          <dd>{boss.regenPercentPerSecond > 0 ? `${(boss.regenPercentPerSecond * 100).toFixed(1)}%/s` : "—"}</dd>
        </div>
        <div>
          <dt>{t("wiki.goldShort")}</dt>
          <dd>{boss.goldReward.toLocaleString(locale)}</dd>
        </div>
      </dl>
      {drops.length > 0 && (
        <div className="bs-drops" aria-label={t("bossesPage.drops")}>
          <span className="bs-drops-title">{t("bossesPage.drops")}</span>
          {drops.map((d) => (
            <span key={d.itemId} className="bs-drop" title={t(`items.${d.itemId}.name` as TranslationKey)}>
              <ItemGlyph itemDefinitionId={d.itemId} size={26} />
              <span>{t(`items.${d.itemId}.name` as TranslationKey)}</span>
              <small>{d.weightPercent}%</small>
            </span>
          ))}
        </div>
      )}
      <div className="bs-card-foot">
        <span className="bs-stars" title={t("bossesPage.starsTitle", { n: kills })} aria-label={t("bossesPage.starsTitle", { n: kills })}>
          {BOSS_STARS.map((_, i) => (
            <i key={i} className={i < stars ? "is-on" : ""} aria-hidden="true">
              ★
            </i>
          ))}
        </span>
        <span className="bs-kills">{met ? t("bossesPage.kills", { n: kills }) : t("bossesPage.notMet")}</span>
      </div>
    </article>
  );
}

const BOSSES_CSS = `
.bs-hero .pg-lead { max-width: 62ch; }
.bs-progress { margin: 14px 0 0; font-size: 14px; color: var(--ash); }
.bs-wrap { padding-top: 30px; padding-bottom: 72px; display: grid; gap: 56px; }
.bs-global { display: grid; grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr); gap: 22px 36px; align-items: start; padding: 22px; border-radius: 18px;
  background: radial-gradient(80% 90% at 20% 30%, rgba(120,80,220,0.22), transparent 70%), linear-gradient(180deg, rgba(26,18,40,0.92), rgba(10,7,16,0.96));
  border: 1px solid rgba(170,130,255,0.32); }
.bs-global-art { position: relative; border-radius: 12px; overflow: hidden; background: #07050c; }
.bs-live { position: absolute; left: 12px; top: 12px; display: inline-flex; align-items: center; gap: 8px; padding: 5px 10px; border-radius: 999px; font-size: 12px; font-weight: 800; color: #e9dcff; background: rgba(12,8,22,0.8); border: 1px solid rgba(170,130,255,0.5); }
.bs-dot { width: 8px; height: 8px; border-radius: 50%; background: #ff5a7a; box-shadow: 0 0 0 0 rgba(255,90,122,0.7); animation: bs-pulse 1.6s infinite; }
@keyframes bs-pulse { 70% { box-shadow: 0 0 0 8px rgba(255,90,122,0); } 100% { box-shadow: 0 0 0 0 rgba(255,90,122,0); } }
.bs-kicker { margin: 0 0 6px; font-size: 13.5px; font-weight: 700; color: #c4a8ff; }
.bs-text { margin: 10px 0 0; font-size: 15px; line-height: 1.6; color: #ddd2ee; }
.bs-life { margin-top: 16px; }
.bs-life-top, .bs-life-foot { display: flex; justify-content: space-between; gap: 10px; flex-wrap: wrap; font-size: 13px; color: #b9a8d4; }
.bs-life-top strong { color: #f0e6ff; }
.bs-life-bar { margin: 6px 0; height: 12px; border-radius: 999px; background: rgba(255,255,255,0.08); overflow: hidden; }
.bs-life-bar i { display: block; height: 100%; border-radius: inherit; background: linear-gradient(90deg, #ff4d6d, #b36bff); }
.bs-facts { margin: 16px 0 0; display: grid; grid-template-columns: 1fr 1fr; gap: 10px 18px; }
.bs-facts dt { font-size: 12.5px; color: #a897c4; }
.bs-facts dd { margin: 2px 0 0; font-size: 14px; color: #efe6ff; line-height: 1.45; }
.bs-cta { margin-top: 18px; }
.bs-acts { grid-column: 1 / -1; list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
.bs-acts li { padding: 14px; border-radius: 12px; background: rgba(0,0,0,0.3); border: 1px solid rgba(170,130,255,0.18); }
.bs-act-time { display: block; font-size: 12px; color: #a897c4; font-variant-numeric: tabular-nums; }
.bs-acts strong { display: block; margin-top: 2px; font-family: var(--display); font-size: 19px; color: #f0e6ff; }
.bs-acts p { margin: 6px 0 0; font-size: 13.5px; line-height: 1.55; color: #cfc2e4; }
.bs-fine { grid-column: 1 / -1; margin: 0; font-size: 12.5px; line-height: 1.55; color: #9d8fb6; }
.bs-section { display: grid; gap: 4px; }
.bs-rules { margin-top: 8px; display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 12px; }
.bs-rule { --rc: #e0644b; padding: 16px; border-radius: 12px; background: var(--night-2); border: 1px solid var(--line-soft); border-top: 3px solid var(--rc); }
.bs-rule.is-barrier { --rc: #5aa8ff; }
.bs-rule.is-harden { --rc: #c9a36a; }
.bs-rule.is-enrage { --rc: #ff4d6d; }
.bs-rule h3 { margin: 0; font-family: var(--display); font-size: 20px; color: var(--bone); }
.bs-rule p { margin: 8px 0 0; font-size: 14px; line-height: 1.6; color: #d9cdb6; }
.bs-rule dl { margin: 10px 0 0; display: grid; gap: 6px; }
.bs-rule dt { font-size: 12px; color: var(--ash-2); }
.bs-rule dd { margin: 1px 0 0; font-size: 13.5px; }
.bs-rule .bs-fine { color: var(--ash); }
.bs-grid { margin-top: 8px; display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 12px; }
.bs-card { display: grid; grid-template-columns: minmax(0, 1fr); gap: 12px; align-items: start; padding: 0 0 14px; border-radius: 14px; overflow: hidden; background: var(--night-2); border: 1px solid var(--line-soft); }
.bs-card > *:not(.bs-card-art) { margin-left: 14px; margin-right: 14px; }

.bs-card.is-main { background: linear-gradient(180deg, rgba(60,22,18,0.55), var(--night-2) 60%); border-color: rgba(224,100,75,0.3); }

.bs-card-art { position: relative; aspect-ratio: 16 / 10; background: #0d0a07; border-bottom: 1px solid var(--line-soft); }
.bs-card-fallback { display: grid; place-items: center; height: 100%; }
.bs-card-art img { display: block; width: 100%; height: 100%; object-fit: cover; object-position: center 40%; }
.bs-card-art::after { content: ""; position: absolute; inset: 0; background: linear-gradient(180deg, transparent 60%, rgba(13,10,7,0.65)); pointer-events: none; }
.bs-where { margin: 0; font-size: 12.5px; color: var(--ash); }
.bs-card h3 { margin: 2px 0 0; font-family: var(--display); font-size: 20px; line-height: 1.15; color: var(--bone); }
.bs-ability { margin: 6px 0 0; font-size: 13.5px; line-height: 1.5; color: #d9cdb6; }
.bs-card > .bs-stats, .bs-card > .bs-drops, .bs-card > .bs-card-foot { grid-column: 1 / -1; }
.bs-weak { margin: 6px 0 0; font-size: 13px; font-weight: 700; color: #ffb38a; }
.bs-stats { margin: 4px 0 0; display: grid; grid-template-columns: repeat(auto-fit, minmax(84px, 1fr)); gap: 8px 10px; padding: 10px 0 0; border-top: 1px solid var(--line-soft); }
.bs-stats dt { font-size: 11.5px; color: var(--ash-2); }
.bs-stats dd { margin: 2px 0 0; font-family: var(--display); font-weight: 700; font-size: 19px; line-height: 1.1; color: var(--bone); font-variant-numeric: lining-nums tabular-nums; }
.bs-drops { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 10px; }
.bs-drops-title { font-size: 11.5px; color: var(--ash-2); margin-right: 2px; }
.bs-drop { display: inline-flex; align-items: center; gap: 6px; padding: 3px 8px 3px 3px; border-radius: 999px; background: rgba(0,0,0,0.3); border: 1px solid var(--line-soft); font-size: 12px; color: #d9cdb6; }
.bs-drop small { color: var(--ash); font-variant-numeric: tabular-nums; }
.bs-card-foot { margin-top: 2px; display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap; }
.bs-stars { display: inline-flex; gap: 2px; font-size: 16px; }
.bs-stars i { font-style: normal; color: rgba(255,255,255,0.18); }
.bs-stars i.is-on { color: #ffd35a; text-shadow: 0 0 8px rgba(255,211,90,0.5); }
.bs-kills { font-size: 12.5px; color: var(--ash); }
@media (max-width: 900px) {
  .bs-global { grid-template-columns: 1fr; padding: 14px; }
  .bs-acts { grid-template-columns: 1fr; }
}
@media (max-width: 520px) {
  .bs-facts { grid-template-columns: 1fr; }
  .bs-grid { grid-template-columns: 1fr; }
  .bs-cta { width: 100%; }
}
@media (prefers-reduced-motion: reduce) { .bs-dot { animation: none; } }
`;
