import { useMemo, useState } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import type { TranslationKey } from "@/i18n/translate";
import { TopNav, type NavView } from "@/ui/TopNav";
import { PAGE_CSS } from "@/ui/pageChrome";
import { loadSave, type SaveData } from "@/engine/SaveSystem";
import { DAILY_GIFT_FREE_GEMS, GEM_PACKS, gemPackTotal, REAL_MONEY_PAYMENTS_ENABLED } from "@/config/store";
import { getTowerSkinDualPrice, SKIN_REWARD_BONUS_PER_TYPE, type TowerSkinDefinition } from "@/config/towerSkins";
import type { GemCurrency } from "@/config/gemsEconomy";
import { MAX_TOWER_LEVEL, type TowerType } from "@/config/towerStats";
import { buyTowerSkin, claimDailyGift, equipTowerSkin, getSkinStatus, getStoreTowerSkins, isDailyGiftAvailable, requestGemPackPurchase } from "@/engine/StoreService";
import { TowerPortrait } from "@/ui/TowerPortrait";
import { formatGameplayEffectLines } from "@/ui/TowerInfoPanel";
import { GemIcon } from "@/ui/icons";

interface StoreScreenProps {
  onNavigate: (view: NavView) => void;
  onPlay: () => void;
}

const TOWER_TYPES: readonly TowerType[] = ["IRONWOOD", "INFERNO", "FROSTBORN", "STORMCALLER"];
type SkinFilter = "ALL" | TowerType;

/**
 * LOJA — Gem packs (real money, not live yet: shown with their price and a
 * "coming soon" state, see config/store.ts), every tower skin (bought with
 * Gems, working now), and a small daily Free Gems gift.
 */
export function StoreScreen({ onNavigate, onPlay }: StoreScreenProps) {
  const { t, language } = useLanguage();
  const locale = language === "ptBR" ? "pt-BR" : "en-US";
  const [save, setSave] = useState<SaveData>(() => loadSave());
  const [filter, setFilter] = useState<SkinFilter>("ALL");
  const [notice, setNotice] = useState<string | null>(null);

  const brl = useMemo(() => new Intl.NumberFormat(locale, { style: "currency", currency: "BRL" }), [locale]);
  const num = useMemo(() => new Intl.NumberFormat(locale), [locale]);
  const skins = getStoreTowerSkins().filter((s) => filter === "ALL" || s.towerType === filter);
  const giftAvailable = isDailyGiftAvailable(save);

  const onClaimGift = () => {
    const next = claimDailyGift();
    if (next) {
      setSave(next);
      setNotice(t("store.giftClaimed", { gems: DAILY_GIFT_FREE_GEMS }));
    }
  };

  const onBuyPack = (packId: string) => {
    const result = requestGemPackPurchase(packId);
    if (!result.ok) setNotice(t("store.packsSoon"));
  };

  const onBuySkin = (skin: TowerSkinDefinition, currency: GemCurrency) => {
    const result = buyTowerSkin(skin.id, currency);
    if (result.ok) {
      setSave(result.save);
      setNotice(t("store.skinBought", { name: t(`towerSkins.${skin.id}.name` as TranslationKey) }));
    } else if (result.reason === "INSUFFICIENT_GEMS") {
      setNotice(t(currency === "FREE" ? "store.notEnoughFree" : "store.notEnoughPurchased"));
    }
  };

  const onEquip = (skin: TowerSkinDefinition, equip: boolean) => {
    const result = equipTowerSkin(skin.towerType, equip ? skin.id : null);
    if (result.ok) setSave(result.save);
  };

  return (
    <div className="pg-root">
      <style>{PAGE_CSS + STORE_CSS}</style>
      <TopNav active="STORE" onNavigate={onNavigate} onPlay={onPlay} />
      <div className="pg-scroll">
        <header className="pg-hero">
          <div className="pg-hero-inner">
            <div>
              <h1 className="pg-h1">{t("store.pageTitle")}</h1>
              <p className="pg-lead">{t("store.lead")}</p>
            </div>
            <dl className="st-balance">
              <div>
                <dt>{t("store.freeGems")}</dt>
                <dd data-testid="store-free">{num.format(save.freeGems)}</dd>
              </div>
              <div>
                <dt>{t("store.purchasedGems")}</dt>
                <dd className="is-gem">{num.format(save.purchasedGems)}</dd>
              </div>
            </dl>
          </div>
        </header>

        <div className="pg-wrap">
          <section className="st-gift" aria-live="polite">
            <div>
              <h2>{t("store.giftTitle")}</h2>
              <p>{giftAvailable ? t("store.giftReady", { gems: DAILY_GIFT_FREE_GEMS }) : t("store.giftTaken")}</p>
            </div>
            <button className={giftAvailable ? "pg-btn" : "pg-btn-ghost"} disabled={!giftAvailable} onClick={onClaimGift} data-testid="store-gift">
              {giftAvailable ? t("store.giftClaim", { gems: DAILY_GIFT_FREE_GEMS }) : t("store.giftTomorrow")}
            </button>
          </section>

          {notice && (
            <p className="st-notice" role="status">
              {notice}
              <button className="pg-link" onClick={() => setNotice(null)}>
                {t("store.dismiss")}
              </button>
            </p>
          )}

          <section className="st-section">
            <div className="pg-head">
              <h2 className="pg-h2">{t("store.gemsTitle")}</h2>
            </div>
            <p className="pg-sub">{REAL_MONEY_PAYMENTS_ENABLED ? t("store.gemsSub") : t("store.gemsSubSoon")}</p>
            <div className="st-packs">
              {GEM_PACKS.map((pack) => (
                <article key={pack.id} className={`st-pack${pack.tag ? " is-tagged" : ""}`}>
                  {pack.tag && <span className="st-tag">{t(pack.tag === "POPULAR" ? "store.tagPopular" : "store.tagBestValue")}</span>}
                  <GemIcon size={26} color="#9fd3ff" />
                  <p className="st-amount">{num.format(gemPackTotal(pack))}</p>
                  <p className="st-bonus">{pack.bonusGems > 0 ? t("store.bonus", { gems: num.format(pack.bonusGems) }) : t("store.noBonus")}</p>
                  <p className="st-price">{brl.format(pack.priceBrl)}</p>
                  <button className="st-buy" disabled={!REAL_MONEY_PAYMENTS_ENABLED} onClick={() => onBuyPack(pack.id)}>
                    {REAL_MONEY_PAYMENTS_ENABLED ? t("store.buy") : t("store.soon")}
                  </button>
                </article>
              ))}
            </div>
            <p className="pg-note">{t("store.freeGemsHow")}</p>
          </section>

          <section className="st-section">
            <div className="pg-head">
              <h2 className="pg-h2">{t("store.skinsTitle")}</h2>
            </div>
            <p className="pg-sub">{t("store.skinsSub")}</p>
            <div className="pg-chips" role="toolbar" aria-label={t("store.skinsTitle")}>
              <button className={filter === "ALL" ? "is-on" : ""} onClick={() => setFilter("ALL")}>
                {t("store.filterAll")}
              </button>
              {TOWER_TYPES.map((type) => (
                <button key={type} className={filter === type ? "is-on" : ""} onClick={() => setFilter(type)}>
                  {t(`towers.${type}.name` as TranslationKey)}
                </button>
              ))}
            </div>
            <div className="st-skins">
              {skins.map((skin) => {
                const status = getSkinStatus(skin.id, save);
                const price = getTowerSkinDualPrice(skin);
                const effects = formatGameplayEffectLines(skin.gameplayEffect, t);
                return (
                  <article key={skin.id} className="st-skin" data-testid={`skin-${skin.id}`}>
                    <div className="st-portrait">
                      <TowerPortrait type={skin.towerType} level={MAX_TOWER_LEVEL} skinId={skin.id} width={132} height={132} zoom={1.9} baseY={0.72} />
                    </div>
                    <div className="st-skin-body">
                      <p className="st-type">{t(`towers.${skin.towerType}.name` as TranslationKey)}</p>
                      <h3>{t(`towerSkins.${skin.id}.name` as TranslationKey)}</h3>
                      <p className="st-desc">{t(`towerSkins.${skin.id}.description` as TranslationKey)}</p>
                      {effects.length > 0 && (
                        <ul className="st-effects" aria-label={t("store.effects")}>
                          {effects.map((line) => (
                            <li key={line} className={line.startsWith("-") ? "is-down" : "is-up"}>
                              {line}
                            </li>
                          ))}
                        </ul>
                      )}
                      <p className="st-reward">{t("store.rewardBonus", { pct: Math.round(SKIN_REWARD_BONUS_PER_TYPE * 100) })}</p>
                      <div className="st-actions">
                        {status?.kind === "OWNED" ? (
                          status.equipped ? (
                            <button className="pg-btn-ghost st-small" onClick={() => onEquip(skin, false)}>
                              {t("store.unequip")}
                            </button>
                          ) : (
                            <button className="pg-btn st-small" onClick={() => onEquip(skin, true)}>
                              {t("store.equip")}
                            </button>
                          )
                        ) : status?.kind === "LOCKED" ? (
                          <p className="st-locked">
                            {t("store.locked", { tower: t(`towers.${skin.towerType}.name` as TranslationKey), level: status.needLevel })}
                          </p>
                        ) : (
                          <>
                            <button className="st-pay" disabled={save.freeGems < price.free} onClick={() => onBuySkin(skin, "FREE")}>
                              <span>{t("store.payFree")}</span> {num.format(price.free)}
                            </button>
                            <button className="st-pay is-gem" disabled={save.purchasedGems < price.purchased} onClick={() => onBuySkin(skin, "PURCHASED")}>
                              <span>{t("store.payPurchased")}</span> {num.format(price.purchased)}
                            </button>
                          </>
                        )}
                        {status?.kind === "OWNED" && <span className="st-owned">{status.equipped ? t("store.equipped") : t("store.owned")}</span>}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

const STORE_CSS = `
.st-balance { display: flex; gap: 32px; margin: 0; }
.st-balance dt { font-size: 13px; color: var(--ash); }
.st-balance dd { margin: 4px 0 0; font-family: var(--display); font-weight: 700; font-size: clamp(32px, 4vw, 48px); line-height: 1; color: var(--bone); font-variant-numeric: lining-nums tabular-nums; }
.st-balance dd.is-gem { color: #9fd3ff; }

.st-gift { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 16px 32px; padding: 26px 0; border-bottom: 1px solid var(--line); }
.st-gift h2 { margin: 0; font-family: var(--display); font-weight: 700; font-size: 26px; color: var(--gold-hi); }
.st-gift p { margin: 4px 0 0; font-size: 14px; color: var(--ash); }
.st-gift button:disabled { cursor: default; opacity: 0.7; }

.st-notice { display: flex; flex-wrap: wrap; align-items: baseline; gap: 6px 16px; margin: 18px 0 0; padding: 12px 16px; border-radius: 10px; background: var(--night-2); border: 1px solid var(--line); font-size: 14px; }

.st-section { padding: 40px 0 8px; }
.st-section:last-child { padding-bottom: 96px; }

.st-packs { display: grid; grid-template-columns: repeat(auto-fill, minmax(170px, 1fr)); gap: 14px; }
.st-pack { position: relative; display: flex; flex-direction: column; align-items: center; text-align: center; padding: 26px 16px 18px; border-radius: 12px; background: linear-gradient(180deg, rgba(60,90,120,0.16), rgba(24,18,12,0.6)); border: 1px solid rgba(159,211,255,0.18); }
.st-pack.is-tagged { border-color: rgba(232,176,75,0.55); }
.st-tag { position: absolute; top: -10px; padding: 2px 10px; border-radius: 999px; background: var(--gold); color: #2b1906; font-size: 12px; font-weight: 800; }
.st-amount { margin: 10px 0 0; font-family: var(--display); font-weight: 700; font-size: 40px; line-height: 1; color: var(--bone); font-variant-numeric: lining-nums tabular-nums; }
.st-bonus { margin: 6px 0 0; min-height: 1.4em; font-size: 13px; font-weight: 600; color: var(--ok); }
.st-price { margin: 12px 0 14px; font-size: 18px; font-weight: 700; color: var(--gold-hi); }
.st-buy { width: 100%; padding: 10px 12px; border-radius: 9px; cursor: pointer; font-weight: 800; font-size: 14px; border: 1px solid #f2c873; color: #2b1906 !important; background: linear-gradient(180deg, #f6cf7a 0%, var(--gold) 55%, #c58a2c 100%); }
.st-buy:disabled { cursor: default; background: rgba(239,229,210,0.06); border-color: rgba(239,229,210,0.2); color: var(--ash) !important; }

.st-skins { display: grid; grid-template-columns: repeat(auto-fill, minmax(340px, 1fr)); gap: 0 32px; margin-top: 8px; }
.st-skin { display: grid; grid-template-columns: 132px minmax(0, 1fr); gap: 18px; padding: 22px 0; border-top: 1px solid var(--line-soft); }
.st-portrait canvas { display: block; border-radius: 10px; background: radial-gradient(circle at 50% 70%, rgba(60,48,36,0.55), rgba(0,0,0,0.35)); }
.st-type { margin: 0; font-size: 12.5px; color: var(--ash); }
.st-skin h3 { margin: 2px 0 0; font-family: var(--display); font-weight: 700; font-size: 24px; line-height: 1.1; color: var(--bone); }
.st-desc { margin: 6px 0 0; font-size: 13.5px; line-height: 1.55; color: var(--ash); }
.st-effects { margin: 8px 0 0; padding: 0; list-style: none; display: flex; flex-wrap: wrap; gap: 4px 12px; font-size: 13px; font-weight: 600; }
.st-effects .is-up { color: var(--ok); }
.st-effects .is-down { color: var(--danger); }
.st-reward { margin: 6px 0 0; font-size: 13px; font-weight: 600; color: var(--gold); }
.st-actions { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 10px; margin-top: 12px; }
.st-small { padding: 8px 16px; font-size: 13px; }
.st-pay { display: inline-flex; gap: 6px; align-items: baseline; padding: 8px 12px; border-radius: 9px; cursor: pointer; font-size: 14px; font-weight: 800; background: rgba(24,18,12,0.6); border: 1px solid rgba(239,229,210,0.28); font-variant-numeric: tabular-nums; }
.st-pay span { font-size: 12px; font-weight: 600; color: var(--ash); }
.st-pay.is-gem { border-color: rgba(159,211,255,0.45); }
.st-pay:hover:not(:disabled) { border-color: var(--gold); }
.st-pay:disabled { cursor: default; opacity: 0.45; }
.st-locked { margin: 0; font-size: 13px; color: var(--ash-2); }
.st-owned { font-size: 13px; color: var(--ok); font-weight: 600; }

@media (max-width: 560px) {
  .st-balance { gap: 24px; }
  .st-packs { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
  .st-amount { font-size: 32px; }
  .st-skins { grid-template-columns: minmax(0, 1fr); }
  .st-skin { grid-template-columns: 112px minmax(0, 1fr); gap: 14px; }
  .st-portrait { width: 112px; height: 112px; overflow: hidden; border-radius: 10px; }
  .st-portrait canvas { transform: translate(-10px, -10px); }
}
`;
