import { useMemo } from "react";
import { CollectionsSection, DailyLoginSection } from "@/ui/RewardsPanels";
import { useLanguage } from "@/i18n/LanguageContext";
import type { TranslationKey } from "@/i18n/translate";
import { TopNav, type NavView } from "@/ui/TopNav";
import { PAGE_CSS } from "@/ui/pageChrome";
import { ETERNAL_STORAGE_KEY, loadSave } from "@/engine/SaveSystem";
import { getLedgerEvents } from "@/engine/EconomyLedger";
import { MaterialIcon, type MaterialKind } from "@/ui/MaterialIcon";
import { ITEM_DEFINITIONS } from "@/config/itemDefinitions";
import { DUEL_TOWER_SKINS, TOWER_SKINS } from "@/config/towerSkins";
import { ACHIEVEMENTS, bestiaryStats } from "@/config/achievements";
import { depthOfWave, romanDepth } from "@/config/eternal";
import { rankFor } from "@/config/duel";
import { isVipActive } from "@/config/shopOffers";
import { RankBadge } from "./DuelScreen";

interface AccountScreenProps {
  onNavigate: (view: NavView) => void;
  onPlay: () => void;
}

const RARITY_ORDER = ["COMMON", "UNCOMMON", "RARE", "EPIC", "LEGENDARY", "MYTHIC"] as const;
const RARITY_COLOR: Record<string, string> = { COMMON: "#c8c0b0", UNCOMMON: "#7fcf6a", RARE: "#6aa8ff", EPIC: "#b47cff", LEGENDARY: "#ffb347", MYTHIC: "#ff5a5a" };

/**
 * CONTA — everything the account holds in one place: every currency and
 * material (with where it comes from and what it's for), both castles and
 * the Duel rank, the collection, and the latest movements of Gems and
 * Shards. Read-only: buying and spending happen on their own pages.
 */
export function AccountScreen({ onNavigate, onPlay }: AccountScreenProps) {
  const { t, language } = useLanguage();
  const fmt = (n: number) => n.toLocaleString(language === "ptBR" ? "pt-BR" : "en-US");
  const save = useMemo(() => loadSave(), []);
  const eternal = useMemo(() => loadSave(ETERNAL_STORAGE_KEY), []);
  const now = Date.now();
  const rank = rankFor(save.duel.trophies);
  const rankName = `${t(`duel.league.${rank.league}` as TranslationKey)}${rank.league === "MASTER" || rank.league === "LEGEND" ? "" : " " + ["", "I", "II", "III"][rank.division]}`;
  const vip = isVipActive(save.vip, now);
  const best = bestiaryStats(save.bestiaryKills);

  const wallet: { kind: MaterialKind; key: string; n: number }[] = [
    { kind: "GEMS_FREE", key: "freeGems", n: save.freeGems },
    { kind: "GEMS_PAID", key: "purchasedGems", n: save.purchasedGems },
    { kind: "SHARDS", key: "gemShards", n: save.gemShards },
    { kind: "GOLD", key: "goldSeason", n: save.gold },
    { kind: "GOLD", key: "goldEternal", n: eternal.gold },
    { kind: "MARKS", key: "marks", n: eternal.eternal.marks },
    { kind: "DUEL_COINS", key: "duelCoins", n: save.duel.coins },
    { kind: "SPLINTERS", key: "splinters", n: save.expeditions.splinters },
    { kind: "RARE", key: "rare", n: save.expeditions.essences.RARE },
    { kind: "EPIC", key: "epic", n: save.expeditions.essences.EPIC },
    { kind: "LEGENDARY", key: "legendary", n: save.expeditions.essences.LEGENDARY },
    { kind: "MYTHIC", key: "mythic", n: save.expeditions.essences.MYTHIC },
  ];

  const items = [...save.inventory, ...save.overflowInventory];
  const byRarity = RARITY_ORDER.map((r) => ({ r, n: items.filter((i) => ITEM_DEFINITIONS[i.itemDefinitionId as keyof typeof ITEM_DEFINITIONS]?.rarity === r).length }));
  const gemSkinsOwned = TOWER_SKINS.filter((s) => save.ownedTowerSkinIds.includes(s.id)).length;
  const duelSkinsOwned = DUEL_TOWER_SKINS.filter((s) => save.duel.owned.includes(`SKIN_${s.id}`)).length;
  const ledger = useMemo(
    () =>
      getLedgerEvents()
        .filter((e) => e.amount !== undefined && (e.eventType === "GEMS_EARNED" || e.eventType === "GEMS_SPENT" || e.eventType === "GEM_SHARDS_EARNED"))
        .slice(-12)
        .reverse(),
    [],
  );

  return (
    <div className="pg-root">
      <style>{PAGE_CSS + ACCOUNT_CSS}</style>
      <TopNav active="ACCOUNT" onNavigate={onNavigate} onPlay={onPlay} />
      <div className="pg-scroll">
        <header className="pg-hero">
          <div className="pg-hero-inner">
            <div>
              <h1 className="pg-h1">{t("account.title")}</h1>
              <p className="pg-lead">{t("account.lead")}</p>
              <div className="ac-tags">
                <span>{t("account.player", { id: save.playerId.slice(0, 8) })}</span>
                {save.equippedTitle && <span className="is-title">{t(`achievements.list.${save.equippedTitle}.title` as TranslationKey)}</span>}
                <span className={vip ? "is-vip" : ""}>{vip ? t("account.vipOn", { date: new Date(save.vip.until).toLocaleDateString(language === "ptBR" ? "pt-BR" : "en-US") }) : t("account.vipOff")}</span>
                <span>{t(`account.age.${save.ageVerification.status}` as TranslationKey)}</span>
              </div>
            </div>
            <div className="ac-rank">
              <RankBadge trophies={save.duel.trophies} size={72} />
              <div>
                <small>{t("account.duelRank")}</small>
                <strong>{rankName}</strong>
                <span>🏆 {fmt(save.duel.trophies)}</span>
              </div>
            </div>
          </div>
        </header>
        <div className="pg-wrap">
          <section className="ac-block">
            <h2 className="pg-h2">{t("account.walletTitle")}</h2>
            <p className="pg-sub">{t("account.walletLead")}</p>
            <div className="ac-wallet">
              {wallet.map((w) => (
                <div key={w.key} className="ac-coin" data-testid={`wallet-${w.key}`}>
                  <MaterialIcon kind={w.kind} size={34} />
                  <div>
                    <strong>{fmt(w.n)}</strong>
                    <span>{t(`account.wallet.${w.key}.name` as TranslationKey)}</span>
                    <small>{t(`account.wallet.${w.key}.how` as TranslationKey)}</small>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="ac-block">
            <h2 className="pg-h2">{t("account.modesTitle")}</h2>
            <div className="ac-modes">
              <div className="ac-mode">
                <h3>{t("account.season")}</h3>
                <dl>
                  <dt>{t("account.record")}</dt>
                  <dd>{fmt(save.seasonBestWave)}</dd>
                  <dt>{t("account.wave")}</dt>
                  <dd>{fmt(save.currentWave)}</dd>
                  <dt>{t("account.towers")}</dt>
                  <dd>{save.towerLoadout.length}</dd>
                  <dt>{t("account.seasonsWon")}</dt>
                  <dd>{save.ascensionSeasonsWon}</dd>
                </dl>
              </div>
              <div className="ac-mode">
                <h3>{t("account.eternal")}</h3>
                <dl>
                  <dt>{t("account.record")}</dt>
                  <dd>{fmt(eternal.seasonBestWave)}</dd>
                  <dt>{t("account.depth")}</dt>
                  <dd>{romanDepth(depthOfWave(Math.max(1, eternal.seasonBestWave)))}</dd>
                  <dt>{t("account.towers")}</dt>
                  <dd>{eternal.towerLoadout.length}</dd>
                  <dt>{t("account.milestones")}</dt>
                  <dd>{eternal.eternal.milestonesClaimed}</dd>
                </dl>
              </div>
              <div className="ac-mode">
                <h3>{t("account.duel")}</h3>
                <dl>
                  <dt>{t("account.duelRank")}</dt>
                  <dd>{rankName}</dd>
                  <dt>{t("account.bestTrophies")}</dt>
                  <dd>{fmt(save.duel.bestTrophies)}</dd>
                  <dt>{t("account.winsLosses")}</dt>
                  <dd>
                    {save.duel.wins}–{save.duel.losses}
                  </dd>
                  <dt>{t("account.bestStreak")}</dt>
                  <dd>{save.duel.bestStreak}</dd>
                </dl>
              </div>
            </div>
          </section>

          <section className="ac-block">
            <h2 className="pg-h2">{t("account.collectionTitle")}</h2>
            <div className="ac-modes">
              <div className="ac-mode">
                <h3>{t("account.items")}</h3>
                <ul className="ac-rarities">
                  {byRarity.map(({ r, n }) => (
                    <li key={r} style={{ color: RARITY_COLOR[r] }}>
                      <span>{t(`rarity.${r}` as TranslationKey)}</span>
                      <b>{n}</b>
                    </li>
                  ))}
                </ul>
                <small>{t("account.inventorySpace", { n: save.inventory.length, cap: save.inventoryCapacity })}</small>
              </div>
              <div className="ac-mode">
                <h3>{t("account.looks")}</h3>
                <dl>
                  <dt>{t("account.gemSkins")}</dt>
                  <dd>
                    {gemSkinsOwned} / {TOWER_SKINS.length}
                  </dd>
                  <dt>{t("account.evolved")}</dt>
                  <dd>{save.evolvedSkinIds.length}</dd>
                  <dt>{t("account.duelSkins")}</dt>
                  <dd>
                    {duelSkinsOwned} / {DUEL_TOWER_SKINS.length}
                  </dd>
                  <dt>{t("account.duelLooks")}</dt>
                  <dd>{save.duel.owned.length - duelSkinsOwned}</dd>
                </dl>
              </div>
              <div className="ac-mode">
                <h3>{t("account.feats")}</h3>
                <dl>
                  <dt>{t("account.achievements")}</dt>
                  <dd>
                    {save.achievements.length} / {ACHIEVEMENTS.length}
                  </dd>
                  <dt>{t("account.bestiary")}</dt>
                  <dd>{best.met}</dd>
                  <dt>{t("account.kills")}</dt>
                  <dd>{fmt(best.total)}</dd>
                  <dt>{t("account.bosses")}</dt>
                  <dd>{fmt(save.bossesDefeatedTotal)}</dd>
                </dl>
              </div>
            </div>
          </section>

          <DailyLoginSection />
          <CollectionsSection />

          <section className="ac-block ac-last">
            <h2 className="pg-h2">{t("account.ledgerTitle")}</h2>
            <p className="pg-sub">{t("account.ledgerLead")}</p>
            {ledger.length === 0 ? (
              <p className="pg-sub">{t("account.ledgerEmpty")}</p>
            ) : (
              <table className="ac-ledger">
                <tbody>
                  {ledger.map((e) => {
                    const plus = e.eventType !== "GEMS_SPENT";
                    const what = e.eventType === "GEM_SHARDS_EARNED" ? t("account.wallet.gemShards.name") : e.currency === "PURCHASED" ? t("account.wallet.purchasedGems.name") : t("account.wallet.freeGems.name");
                    return (
                      <tr key={e.eventId}>
                        <td>{new Date(e.timestamp).toLocaleString(language === "ptBR" ? "pt-BR" : "en-US", { dateStyle: "short", timeStyle: "short" })}</td>
                        <td className={plus ? "is-plus" : "is-minus"}>
                          {plus ? "+" : "−"}
                          {fmt(e.amount ?? 0)}
                        </td>
                        <td>{what}</td>
                        <td className="ac-src">{e.source}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

const ACCOUNT_CSS = `
.ac-tags { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 14px; }
.ac-tags span { padding: 5px 12px; border-radius: 20px; border: 1px solid var(--line); background: rgba(0,0,0,0.3); font-size: 13px; color: var(--ash); }
.ac-tags span.is-title { color: var(--gold-hi); border-color: rgba(232,176,75,0.5); }
.ac-tags span.is-vip { color: #cfe8ff; border-color: rgba(159,211,255,0.5); }
.ac-rank { display: flex; align-items: center; gap: 14px; }
.ac-rank div { display: grid; gap: 2px; }
.ac-rank small { font-size: 12px; color: var(--ash); }
.ac-rank strong { font-family: var(--display); font-size: 28px; color: var(--gold-hi); line-height: 1.05; }
.ac-rank span { font-size: 14px; color: var(--bone); }
.ac-block { padding: 30px 0 6px; }
.ac-block .pg-sub { margin: 4px 0 0; }
.ac-last { padding-bottom: 96px; }
.ac-wallet { display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 12px; margin-top: 16px; }
.ac-coin { display: flex; gap: 12px; align-items: flex-start; padding: 14px 16px; border-radius: 12px; border: 1px solid var(--line); background: rgba(24,18,12,0.55); }
.ac-coin > div { display: grid; gap: 2px; min-width: 0; }
.ac-coin strong { font-family: var(--display); font-size: 26px; line-height: 1; color: var(--bone); font-variant-numeric: tabular-nums; }
.ac-coin span { font-size: 14px; font-weight: 700; color: var(--gold-hi); }
.ac-coin small { font-size: 12px; color: var(--ash); line-height: 1.4; }
.ac-modes { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 12px; margin-top: 16px; }
.ac-mode { padding: 16px 18px; border-radius: 12px; border: 1px solid var(--line); background: rgba(24,18,12,0.55); }
.ac-mode h3 { margin: 0 0 10px; font-family: var(--display); font-size: 21px; color: var(--bone); }
.ac-mode dl { margin: 0; display: grid; grid-template-columns: 1fr auto; gap: 6px 12px; font-size: 14px; }
.ac-mode dt { color: var(--ash); }
.ac-mode dd { margin: 0; color: var(--bone); font-weight: 700; text-align: right; font-variant-numeric: tabular-nums; }
.ac-mode small { display: block; margin-top: 10px; font-size: 12.5px; color: var(--ash); }
.ac-rarities { list-style: none; margin: 0; padding: 0; display: grid; gap: 6px; font-size: 14px; }
.ac-rarities li { display: flex; justify-content: space-between; font-weight: 700; }
.ac-ledger { width: 100%; margin-top: 14px; border-collapse: collapse; font-size: 14px; }
.ac-ledger td { padding: 8px 10px; border-bottom: 1px solid var(--line); color: var(--bone); }
.ac-ledger td.is-plus { color: #9be37a; font-weight: 800; font-variant-numeric: tabular-nums; }
.ac-ledger td.is-minus { color: #ff9a85; font-weight: 800; font-variant-numeric: tabular-nums; }
.ac-ledger td.ac-src { color: var(--ash); font-size: 12.5px; word-break: break-all; }
`;
