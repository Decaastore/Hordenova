import { SKIN_MANA_GAIN_BONUS } from "@/config/towerMana";
import { CASTLE_SKINS } from "@/config/castleSkins";
import { CastleSkinPreview } from "@/ui/CastleSkinPreview";
import { useMemo, useState } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import type { TranslationKey } from "@/i18n/translate";
import { TopNav, type NavView } from "@/ui/TopNav";
import { PAGE_CSS } from "@/ui/pageChrome";
import { loadSave, type SaveData } from "@/engine/SaveSystem";
import { DAILY_GIFT_FREE_GEMS, GEM_PACKS, gemPackTotal, REAL_MONEY_PAYMENTS_ENABLED, STARTER_PACK } from "@/config/store";
import { PURCHASE_MIN_AGE } from "@/config/ageGate";
import { getTowerSkinDualPrice, SKIN_REWARD_BONUS_PER_TYPE, type TowerSkinDefinition } from "@/config/towerSkins";
import type { GemCurrency } from "@/config/gemsEconomy";
import { MAX_TOWER_LEVEL, type TowerType } from "@/config/towerStats";
import { buyCastleSkin, castleSkinPrice, equipCastleSkin, buyDailyOffer, buySkinEvolution, buyTowerSkin, claimDailyGift, claimVipGift, equipTowerSkin, getDailyOffers, getSkinStatus, getStoreTowerSkins, isDailyGiftAvailable, requestGemPackPurchase } from "@/engine/StoreService";
import { activeMomentOffer, isVipActive, VIP_DAILY_GEMS, VIP_DAYS, VIP_EXTRA_SCOUT_GROUPS, VIP_PRICE_BRL, vipGiftAvailable, type DailyOffer, type MomentOffer } from "@/config/shopOffers";
import { ESSENCE_RARITIES, type Essences } from "@/config/expeditions";
import { canEvolveSkin, getTowerSkinDefinition, SKIN_EVOLUTION_PRICE } from "@/config/towerSkins";
import { setEvolvedSkins } from "@/rendering/skinEvolution";
import { MaterialIcon } from "@/ui/MaterialIcon";
import { Tower3DPortrait } from "@/ui/Tower3DPortrait";
import { formatGameplayEffectLines } from "@/ui/TowerInfoPanel";
import { ChestArt, CrownArt, GemPile, PerkIcon, StoreGem } from "@/ui/StoreArt";
import { STARTER_PACK_SKIN_ID } from "@/config/seasonPass";
import { RewardPartsLabel, REWARD_CSS } from "@/ui/RewardPartsLabel";

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
    if (result.reason === "UNDER_AGE") setNotice(t("store.underAge", { age: PURCHASE_MIN_AGE }));
    else if (result.reason === "AGE_VERIFICATION_REQUIRED") setNotice(t("store.verifyAtFirstPurchase", { age: PURCHASE_MIN_AGE }));
    else setNotice(t("store.packsSoon"));
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

  setEvolvedSkins(save.evolvedSkinIds);
  const now = Date.now();
  const daily = getDailyOffers(save, now);
  const moment = activeMomentOffer(save.momentOffers, now);
  const vipOn = isVipActive(save.vip, now);
  const msToReset = 86_400_000 - (now % 86_400_000);
  const hm = (ms: number) => {
    const m = Math.max(0, Math.ceil(ms / 60_000));
    return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, "0")}m`;
  };
  const essenceText = (e: Essences | undefined) =>
    ESSENCE_RARITIES.filter((r) => (e?.[r] ?? 0) > 0)
      .map((r) => t("store.essenceN", { n: e![r], r: t(`expeditions.essenceName.${r}` as TranslationKey) }))
      .join(" · ");
  const offerTitle = (o: DailyOffer) =>
    o.kind === "SKIN" && o.skinId
      ? t(`towerSkins.${o.skinId}.name` as TranslationKey)
      : o.kind === "SPLINTERS"
        ? t("store.splintersN", { n: o.splinters ?? 0 })
        : essenceText(o.essences);
  const momentContents = (o: MomentOffer) =>
    [t("store.gemsN", { n: num.format(o.purchasedGems) }), t("store.splintersN", { n: o.splinters }), essenceText(o.essences)].filter(Boolean).join(" · ");

  const onBuyDaily = (offerId: string, currency: GemCurrency) => {
    const result = buyDailyOffer(offerId, currency);
    if (result.ok) {
      setSave(result.save);
      setNotice(t("store.dailyBought"));
    } else if (result.reason === "INSUFFICIENT_GEMS") setNotice(t(currency === "FREE" ? "store.notEnoughFree" : "store.notEnoughPurchased"));
  };

  const onClaimVip = () => {
    const next = claimVipGift();
    if (next) {
      setSave(next);
      setNotice(t("store.vipGiftClaimed", { gems: VIP_DAILY_GEMS }));
    }
  };

  const onEvolve = (skin: TowerSkinDefinition, currency: GemCurrency) => {
    const result = buySkinEvolution(skin.id, currency);
    if (result.ok) {
      setSave(result.save);
      setNotice(t("store.evolved", { name: t(`towerSkins.${skin.id}.name` as TranslationKey) }));
    } else if (result.reason === "INSUFFICIENT_GEMS") setNotice(t(currency === "FREE" ? "store.notEnoughFree" : "store.notEnoughPurchased"));
  };

  const onBuyCastle = (id: string, currency: GemCurrency) => {
    const result = buyCastleSkin(id, currency);
    if (result.ok) {
      setSave(result.save);
      setNotice(t("store.castleBought", { name: t(`castleSkins.${id}.name` as TranslationKey) }));
    } else if (result.reason === "INSUFFICIENT_GEMS") setNotice(t(currency === "FREE" ? "store.notEnoughFree" : "store.notEnoughPurchased"));
  };
  const onEquipCastle = (id: string | null) => {
    const result = equipCastleSkin(id);
    if (result.ok) setSave(result.save);
  };

  const onEquip = (skin: TowerSkinDefinition, equip: boolean) => {
    const result = equipTowerSkin(skin.towerType, equip ? skin.id : null);
    if (result.ok) setSave(result.save);
  };

  const pay = (price: { free: number; purchased: number }, onPay: (c: GemCurrency) => void) => (
    <div className="st-pricepair">
      <button className="st-pay" disabled={save.freeGems < price.free} onClick={() => onPay("FREE")} title={t("store.payFree")}>
        <StoreGem tone="FREE" size={16} />
        <b>{num.format(price.free)}</b>
        <span>{t("store.payFree")}</span>
      </button>
      <button className="st-pay is-gem" disabled={save.purchasedGems < price.purchased} onClick={() => onPay("PURCHASED")} title={t("store.payPurchased")}>
        <StoreGem tone="PURCHASED" size={16} />
        <b>{num.format(price.purchased)}</b>
        <span>{t("store.payPurchased")}</span>
      </button>
    </div>
  );
  const starterSkin = getTowerSkinDefinition(STARTER_PACK_SKIN_ID);
  const partIcon = (kind: string) => (kind === "PURCHASED_GEMS" || kind === "GEMS" ? "GEMS" : kind === "SKIN" ? "SKIN" : kind === "ITEM" ? "ITEM" : "SLOTS") as "GEMS" | "SKIN" | "ITEM" | "SLOTS";

  return (
    <div className="pg-root">
      <style>{PAGE_CSS + STORE_CSS + REWARD_CSS}</style>
      <TopNav active="STORE" onNavigate={onNavigate} onPlay={onPlay} />
      <div className="pg-scroll">
        <header className="pg-hero st-hero">
          <div className="pg-hero-inner">
            <div>
              <h1 className="pg-h1">{t("store.pageTitle")}</h1>
              <p className="pg-lead">{t("store.lead")}</p>
            </div>
            <dl className="st-balance">
              <div className="st-wallet">
                <span className="st-wallet-gem"><StoreGem tone="FREE" size={30} /></span>
                <dt>{t("store.freeGems")}</dt>
                <dd data-testid="store-free">{num.format(save.freeGems)}</dd>
              </div>
              <div className="st-wallet is-gem">
                <span className="st-wallet-gem"><StoreGem tone="PURCHASED" size={30} /></span>
                <dt>{t("store.purchasedGems")}</dt>
                <dd className="is-gem">{num.format(save.purchasedGems)}</dd>
              </div>
            </dl>
          </div>
        </header>

        <div className="pg-wrap">
          <section className={`st-gift${giftAvailable ? " is-ready" : ""}`} aria-live="polite">
            <ChestArt open={!giftAvailable} />
            <div className="st-gift-text">
              <h2>{t("store.giftTitle")}</h2>
              <p>{giftAvailable ? t("store.giftReady", { gems: DAILY_GIFT_FREE_GEMS }) : t("store.giftTaken")}</p>
            </div>
            <button className={giftAvailable ? "st-buy st-gift-btn" : "pg-btn-ghost"} disabled={!giftAvailable} onClick={onClaimGift} data-testid="store-gift">
              {giftAvailable && <StoreGem tone="FREE" size={18} />}
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

          {moment && (
            <section className="st-moment" data-testid="moment-offer">
              <div>
                <p className="st-moment-kicker">
                  <PerkIcon kind="CLOCK" /> {t("store.momentKicker", { time: hm(moment.expiresAt - now) })}
                </p>
                <h2>{t(`store.moment.${moment.offer.id}.name` as TranslationKey)}</h2>
                <p>{t(`store.moment.${moment.offer.id}.why` as TranslationKey)}</p>
                <p className="st-moment-list">{momentContents(moment.offer)}</p>
              </div>
              <div className="st-buybox">
                <span className="st-price">{brl.format(moment.offer.priceBrl)}</span>
                <button className="st-buy" disabled={!REAL_MONEY_PAYMENTS_ENABLED} onClick={() => onBuyPack(moment.offer.id)}>
                  {REAL_MONEY_PAYMENTS_ENABLED ? t("store.buy") : t("store.soon")}
                </button>
                <small>{t("store.adultShort", { age: PURCHASE_MIN_AGE })}</small>
              </div>
            </section>
          )}

          <section className="st-section" data-testid="daily-shop">
            <div className="pg-head st-head">
              <h2 className="pg-h2">{t("store.dailyTitle")}</h2>
              <span className="st-reset">
                <PerkIcon kind="CLOCK" /> {t("store.dailyResets", { time: hm(msToReset) })}
              </span>
            </div>
            <p className="pg-sub">{t("store.dailySub")}</p>
            <div className="st-daily">
              {daily.map(({ offer, bought, owned }) => {
                const skinDef = offer.skinId ? getTowerSkinDefinition(offer.skinId) : null;
                const done = bought || owned;
                return (
                  <article key={offer.id} className={`st-card st-day is-${offer.kind}${done ? " is-done" : ""}`} data-testid={`daily-${offer.kind}`}>
                    {offer.discountPct ? <span className="st-ribbon">−{offer.discountPct}%</span> : null}
                    {skinDef ? (
                      <div className="st-stage">
                        <Tower3DPortrait type={skinDef.towerType} level={MAX_TOWER_LEVEL} skinId={skinDef.id} width={120} height={120} />
                      </div>
                    ) : (
                      <div className={`st-stage is-mat is-${offer.kind}`} aria-hidden="true">
                        <MaterialIcon kind={offer.kind === "SPLINTERS" ? "SPLINTERS" : offer.kind === "EPIC_ESSENCE" ? "EPIC" : "RARE"} size={70} />
                      </div>
                    )}
                    <div className="st-card-body">
                      <p className="st-type">{t(`store.dailyKind.${offer.kind}` as TranslationKey)}</p>
                      <h3>{offerTitle(offer)}</h3>
                      {offer.discountPct ? <p className="st-off">{t("store.dailyOff", { pct: offer.discountPct })}</p> : <p className="st-off is-plain">{t("store.dailyForge")}</p>}
                    </div>
                    <div className="st-card-foot">
                      {done ? <p className="st-owned">✓ {owned ? t("store.owned") : t("store.dailyBoughtTag")}</p> : pay(offer.price, (c) => onBuyDaily(offer.id, c))}
                    </div>
                  </article>
                );
              })}
            </div>
          </section>

          <section className="st-section">
            <div className="pg-head st-head">
              <h2 className="pg-h2">{t("store.featuredTitle")}</h2>
            </div>
            <p className="st-adult" data-testid="adult-only">
              <span className="st-adult-badge">{PURCHASE_MIN_AGE}+</span>
              {t("store.adultOnly", { age: PURCHASE_MIN_AGE })}
            </p>
            <div className="st-featured">
              <article className="st-starter" data-testid="starter-pack">
                <span className="st-ribbon is-gold">{t("store.oneTime")}</span>
                <div className="st-starter-stage">
                  {starterSkin && (
                    <Tower3DPortrait type={starterSkin.towerType} level={MAX_TOWER_LEVEL} skinId={starterSkin.id} width={170} height={170} />
                  )}
                  <span className="st-starter-gems">
                    <GemPile tier={2} />
                  </span>
                </div>
                <h3>{t("store.starterTitle")}</h3>
                <p className="st-feat-body">{t("store.starterBody")}</p>
                <p className="st-contents-label">{t("store.contents")}</p>
                <ul className="st-contents">
                  {STARTER_PACK.contents.map((part, i) => (
                    <li key={i}>
                      <span className="st-contents-ico">
                        <PerkIcon kind={partIcon(part.kind)} />
                      </span>
                      <RewardPartsLabel parts={[part]} currentWave={save.currentWave} />
                    </li>
                  ))}
                </ul>
                <div className="st-buybox">
                  <span className="st-price">{brl.format(STARTER_PACK.priceBrl)}</span>
                  <button className="st-buy" disabled={!REAL_MONEY_PAYMENTS_ENABLED} onClick={() => onBuyPack(STARTER_PACK.id)}>
                    {REAL_MONEY_PAYMENTS_ENABLED ? t("store.buy") : t("store.soon")}
                  </button>
                  {!REAL_MONEY_PAYMENTS_ENABLED && <small>{t("store.starterSoon")}</small>}
                </div>
              </article>

              <article className={`st-vip${vipOn ? " is-on" : ""}`} data-testid="vip-card">
                <div className="st-vip-stage" aria-hidden="true">
                  <span className="st-vip-rays" />
                  <CrownArt />
                </div>
                <div className="st-vip-head">
                  <h3>{t("store.vipTitle")}</h3>
                  <span className="st-vip-days">{t("store.vipDays", { days: VIP_DAYS })}</span>
                  {vipOn && <span className="st-vip-active">✓ {t("store.vipActive")}</span>}
                </div>
                <p className="st-feat-body">{t("store.vipBody", { days: VIP_DAYS })}</p>
                <ul className="st-perks">
                  <li>
                    <span className="st-contents-ico"><PerkIcon kind="GEMS" /></span>
                    {t("store.vipPerkGems", { gems: VIP_DAILY_GEMS })}
                  </li>
                  <li>
                    <span className="st-contents-ico"><PerkIcon kind="SCOUT" /></span>
                    {t("store.vipPerkGroup", { n: VIP_EXTRA_SCOUT_GROUPS })}
                  </li>
                  <li>
                    <span className="st-contents-ico"><PerkIcon kind="MARKET" /></span>
                    {t("store.vipPerkMarket")}
                  </li>
                  <li>
                    <span className="st-contents-ico"><PerkIcon kind="FAIR" /></span>
                    {t("store.vipPerkFair")}
                  </li>
                </ul>
                <div className="st-buybox">
                  <span className="st-price">
                    {brl.format(VIP_PRICE_BRL)} <small>{t("store.vipPerMonth")}</small>
                  </span>
                  {vipOn ? (
                    <button className="st-buy is-vip" disabled={!vipGiftAvailable(save.vip, now)} onClick={onClaimVip}>
                      {vipGiftAvailable(save.vip, now) ? t("store.vipClaim", { gems: VIP_DAILY_GEMS }) : t("store.giftTomorrow")}
                    </button>
                  ) : (
                    <button className="st-buy is-vip" disabled={!REAL_MONEY_PAYMENTS_ENABLED} onClick={() => onBuyPack("VIP")}>
                      {REAL_MONEY_PAYMENTS_ENABLED ? t("store.vipSubscribe") : t("store.soon")}
                    </button>
                  )}
                </div>
              </article>
            </div>
          </section>

          <section className="st-section">
            <div className="pg-head st-head">
              <h2 className="pg-h2">{t("store.gemsTitle")}</h2>
            </div>
            <p className="pg-sub">{REAL_MONEY_PAYMENTS_ENABLED ? t("store.gemsSub") : t("store.gemsSubSoon")}</p>
            <div className="st-packs">
              {GEM_PACKS.map((pack, i) => (
                <article key={pack.id} className={`st-pack${pack.tag ? ` is-tagged is-${pack.tag}` : ""}`}>
                  {pack.tag && <span className="st-tag">{t(pack.tag === "POPULAR" ? "store.tagPopular" : "store.tagBestValue")}</span>}
                  <GemPile tier={i} />
                  <p className="st-amount">{num.format(gemPackTotal(pack))}</p>
                  <p className="st-amount-unit">{t("store.gemsTitle")}</p>
                  <p className={`st-bonus${pack.bonusGems > 0 ? "" : " is-none"}`}>{pack.bonusGems > 0 ? t("store.bonus", { gems: num.format(pack.bonusGems) }) : t("store.noBonus")}</p>
                  <button className="st-buy st-pack-buy" disabled={!REAL_MONEY_PAYMENTS_ENABLED} onClick={() => onBuyPack(pack.id)}>
                    <span className="st-pack-price">{brl.format(pack.priceBrl)}</span>
                    {!REAL_MONEY_PAYMENTS_ENABLED && <span className="st-pack-soon">{t("store.soon")}</span>}
                  </button>
                </article>
              ))}
            </div>
            <p className="pg-note">{t("store.freeGemsHow")}</p>
          </section>

          <section className="st-section" data-testid="castle-skins">
            <div className="pg-head st-head">
              <h2 className="pg-h2">{t("store.castleTitle")}</h2>
            </div>
            <p className="pg-sub">{t("store.castleSub")}</p>
            <div className="st-castles">
              <article className={`st-card st-castle${save.equippedCastleSkinId === null ? " is-on" : ""}`}>
                <div className="st-stage is-castle">
                  <CastleSkinPreview skinId={null} size={170} />
                </div>
                <h3>{t("store.castleDefault")}</h3>
                <p className="st-castle-how">{t("store.castleDefaultHow")}</p>
                <button className={save.equippedCastleSkinId === null ? "st-wear is-on" : "st-wear"} disabled={save.equippedCastleSkinId === null} onClick={() => onEquipCastle(null)}>
                  {save.equippedCastleSkinId === null ? t("store.castleOn") : t("store.castleWear")}
                </button>
              </article>
              {CASTLE_SKINS.map((c) => {
                const owned = save.unlockedCastleSkinIds.includes(c.id);
                const on = save.equippedCastleSkinId === c.id;
                const price = castleSkinPrice(c.id);
                return (
                  <article key={c.id} className={`st-card st-castle${on ? " is-on" : ""}`} data-testid={`castle-${c.id}`}>
                    <div className="st-stage is-castle">
                      <CastleSkinPreview skinId={c.id} size={170} />
                    </div>
                    <h3>{t(`castleSkins.${c.i18nKey}.name` as TranslationKey)}</h3>
                    <p className="st-castle-how">{owned ? t("store.owned") : t(`store.castleHow.${c.source}` as TranslationKey)}</p>
                    {owned ? (
                      <button className={on ? "st-wear is-on" : "st-wear"} disabled={on} onClick={() => onEquipCastle(c.id)}>
                        {on ? t("store.castleOn") : t("store.castleWear")}
                      </button>
                    ) : price ? (
                      pay(price, (cur) => onBuyCastle(c.id, cur))
                    ) : null}
                  </article>
                );
              })}
            </div>
          </section>

          <section className="st-section">
            <div className="pg-head st-head">
              <h2 className="pg-h2">{t("store.skinsTitle")}</h2>
            </div>
            <p className="pg-sub">{t("store.skinsSub")}</p>
            <div className="pg-chips st-seg" role="toolbar" aria-label={t("store.skinsTitle")}>
              <button className={filter === "ALL" ? "is-on" : ""} onClick={() => setFilter("ALL")}>
                {t("store.filterAll")}
              </button>
              {TOWER_TYPES.map((type) => (
                <button key={type} className={filter === type ? "is-on" : ""} onClick={() => setFilter(type)}>
                  {t(`towers.${type}.name` as TranslationKey)}
                </button>
              ))}
            </div>
            <div className="st-skins" key={filter}>
              {skins.map((skin) => {
                const status = getSkinStatus(skin.id, save);
                const price = getTowerSkinDualPrice(skin);
                const effects = formatGameplayEffectLines(skin.gameplayEffect, t);
                return (
                  <article key={skin.id} className={`st-card st-skin is-${skin.tier}${status?.kind === "OWNED" && status.equipped ? " is-on" : ""}`} data-testid={`skin-${skin.id}`}>
                    <div className="st-stage st-portrait">
                      <span className={`st-tier is-${skin.tier}`}>{t(`store.tier.${skin.tier}` as TranslationKey)}</span>
                      <Tower3DPortrait type={skin.towerType} level={MAX_TOWER_LEVEL} skinId={skin.id} width={150} height={150} />
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
                      <p className="st-reward">{t("store.rewardBonus", { pct: Math.round(SKIN_REWARD_BONUS_PER_TYPE * 100), mana: Math.round(SKIN_MANA_GAIN_BONUS * 100) })}</p>
                      <div className="st-actions">
                        {status?.kind === "OWNED" ? (
                          <>
                            {status.equipped ? (
                              <button className="st-wear" onClick={() => onEquip(skin, false)}>
                                {t("store.unequip")}
                              </button>
                            ) : (
                              <button className="st-wear is-cta" onClick={() => onEquip(skin, true)}>
                                {t("store.equip")}
                              </button>
                            )}
                            <span className="st-owned">✓ {status.equipped ? t("store.equipped") : t("store.owned")}</span>
                          </>
                        ) : status?.kind === "LOCKED" ? (
                          <p className="st-locked">
                            🔒 {t("store.locked", { tower: t(`towers.${skin.towerType}.name` as TranslationKey), level: status.needLevel })}
                          </p>
                        ) : (
                          pay(price, (c) => onBuySkin(skin, c))
                        )}
                      </div>
                      {status?.kind === "OWNED" && canEvolveSkin(skin) && (
                        <div className="st-evolve" data-testid={`evolve-${skin.id}`}>
                          {save.evolvedSkinIds.includes(skin.id) ? (
                            <span className="st-evolved">{t("store.evolvedTag")}</span>
                          ) : (
                            <>
                              <span className="st-evolve-label">{t("store.evolve")}</span>
                              {pay(SKIN_EVOLUTION_PRICE, (c) => onEvolve(skin, c))}
                            </>
                          )}
                        </div>
                      )}
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
/* ===== STORE =====
 * One material language for every card: dark lacquered panels with a thin
 * gilt edge, a lit "stage" where the goods stand (spotlight + floor
 * shadow), prices as gem pills, gold call-to-action buttons. The featured
 * pair (starter pack and VIP) are the only loud things on the page. */
.st-hero .pg-hero-inner { align-items: flex-end; }

/* wallet */
.st-balance { display: flex; gap: 12px; margin: 0; }
.st-wallet { display: grid; grid-template-columns: auto auto; grid-template-rows: auto auto; column-gap: 12px; align-items: center; padding: 12px 18px 12px 12px; border-radius: 14px;
  background: linear-gradient(180deg, rgba(255,214,140,0.08), rgba(0,0,0,0.25)), rgba(20,14,9,0.85);
  border: 1px solid rgba(232,176,75,0.35); box-shadow: inset 0 1px 0 rgba(255,236,190,0.12), 0 8px 22px rgba(0,0,0,0.35); }
.st-wallet.is-gem { border-color: rgba(120,190,255,0.35); }
.st-wallet-gem { grid-row: 1 / span 2; width: 46px; height: 46px; display: grid; place-items: center; border-radius: 50%;
  background: radial-gradient(circle at 50% 40%, rgba(255,210,120,0.25), rgba(0,0,0,0.4)); box-shadow: inset 0 0 0 1px rgba(255,220,150,0.25); }
.st-wallet.is-gem .st-wallet-gem { background: radial-gradient(circle at 50% 40%, rgba(120,200,255,0.25), rgba(0,0,0,0.4)); box-shadow: inset 0 0 0 1px rgba(150,210,255,0.25); }
.st-wallet-gem svg { animation: hn-float 3.4s ease-in-out infinite; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.5)); }
.st-balance dt { font-size: 12px; color: var(--ash); letter-spacing: 0.02em; }
.st-balance dd { margin: 2px 0 0; font-family: var(--display); font-weight: 700; font-size: clamp(26px, 3vw, 34px); line-height: 1; color: #ffd98a; font-variant-numeric: lining-nums tabular-nums; }
.st-balance dd.is-gem { color: #a8dcff; }

/* daily gift */
.st-gift { position: relative; display: flex; flex-wrap: wrap; align-items: center; gap: 14px 22px; margin-top: 22px; padding: 14px 22px 14px 14px; border-radius: 16px;
  border: 1px solid var(--line); background: linear-gradient(100deg, rgba(232,176,75,0.10), rgba(20,14,9,0.7) 55%); overflow: hidden; }
.st-gift.is-ready { border-color: rgba(232,176,75,0.6); box-shadow: 0 0 0 1px rgba(232,176,75,0.15), 0 10px 30px rgba(0,0,0,0.35), inset 0 0 40px rgba(232,176,75,0.08); }
.st-gift-text { flex: 1; min-width: 220px; }
.st-gift h2 { margin: 0; font-family: var(--display); font-weight: 700; font-size: 24px; color: var(--gold-hi); }
.st-gift p { margin: 4px 0 0; font-size: 14px; color: var(--ash); }
.st-gift-btn { width: auto !important; padding: 11px 22px !important; display: inline-flex; align-items: center; gap: 8px; }
.st-gift button:disabled { cursor: default; opacity: 0.7; }
.st-chest { width: 92px; height: 78px; flex: none; overflow: visible; }
.st-chest-light { opacity: 0; transform-origin: 50% 100%; }
.st-gift.is-ready .st-chest { animation: st-chest-bump 2.6s ease-in-out infinite; transform-origin: 50% 100%; }
.st-gift.is-ready .st-chest-light { animation: st-chest-glow 2.6s ease-in-out infinite; }
.st-chest.is-open .st-chest-lid { transform: translateY(-8px) rotate(-8deg); transform-origin: 14px 38px; }
@keyframes st-chest-bump { 0%, 70%, 100% { transform: none; } 76% { transform: translateY(-3px) rotate(-2deg); } 82% { transform: translateY(0) rotate(2deg); } 88% { transform: translateY(-2px) rotate(-1deg); } }
@keyframes st-chest-glow { 0%, 66%, 100% { opacity: 0; } 80% { opacity: 0.9; } }

.st-notice { display: flex; flex-wrap: wrap; align-items: baseline; gap: 6px 16px; margin: 18px 0 0; padding: 12px 16px; border-radius: 10px; background: var(--night-2); border: 1px solid rgba(232,176,75,0.4); font-size: 14px; animation: hn-pop 260ms var(--hn-ease-out) backwards; }

.st-section { padding: 44px 0 8px; }
.st-section:last-child { padding-bottom: 96px; }
.st-head { align-items: center; }
.st-head .pg-h2 { display: flex; align-items: center; gap: 12px; }
.st-head .pg-h2::after { content: ""; width: 48px; height: 1px; background: linear-gradient(90deg, var(--gold), transparent); }
.st-reset { display: inline-flex; align-items: center; gap: 6px; padding: 5px 11px; border-radius: 999px; border: 1px solid var(--line); background: rgba(0,0,0,0.3); font-size: 12.5px; color: var(--bone); font-variant-numeric: tabular-nums; }

/* shared card + stage */
.st-card { position: relative; display: flex; flex-direction: column; border-radius: 14px; overflow: hidden;
  background: linear-gradient(180deg, rgba(42,30,18,0.92), rgba(16,11,7,0.96));
  border: 1px solid rgba(232,176,75,0.22); box-shadow: inset 0 1px 0 rgba(255,236,190,0.08), 0 8px 20px rgba(0,0,0,0.35);
  transition: transform 220ms var(--hn-ease-out), border-color 200ms ease, box-shadow 220ms ease; }
.st-card:hover { transform: translateY(-4px); border-color: rgba(232,176,75,0.55); box-shadow: inset 0 1px 0 rgba(255,236,190,0.12), 0 16px 30px rgba(0,0,0,0.45), 0 0 22px rgba(232,176,75,0.12); }
.st-card.is-on { border-color: var(--gold); box-shadow: 0 0 0 1px rgba(232,176,75,0.45), 0 0 26px rgba(232,176,75,0.18); }
.st-stage { position: relative; display: grid; place-items: center; min-height: 132px;
  background: radial-gradient(60% 55% at 50% 38%, rgba(255,214,150,0.16), transparent 70%), radial-gradient(50% 14% at 50% 88%, rgba(0,0,0,0.55), transparent 70%), linear-gradient(180deg, rgba(0,0,0,0.12), rgba(0,0,0,0.35));
  border-bottom: 1px solid rgba(232,176,75,0.15); }
.st-stage canvas { display: block; transition: transform 320ms var(--hn-ease-back); }
.st-card:hover .st-stage canvas, .st-card:hover .st-stage svg { transform: translateY(-4px) scale(1.04); }
.st-stage.is-mat svg { filter: drop-shadow(0 6px 10px rgba(0,0,0,0.5)); transition: transform 320ms var(--hn-ease-back); animation: hn-float 3.6s ease-in-out infinite; }
.st-stage.is-RARE_ESSENCE { background-color: rgba(70,130,255,0.06); }
.st-stage.is-EPIC_ESSENCE { background-color: rgba(180,124,255,0.08); }
.st-card-body { padding: 12px 14px 0; flex: 1; }
.st-card-foot { padding: 12px 14px 14px; }
.st-type { margin: 0; font-size: 11.5px; letter-spacing: 0.04em; color: var(--ash); }
.st-ribbon { position: absolute; z-index: 2; top: 12px; right: -34px; width: 130px; padding: 4px 0; transform: rotate(35deg); text-align: center; font-size: 12px; font-weight: 800; color: #fff; letter-spacing: 0.02em;
  background: linear-gradient(180deg, #e8483a, #a01c14); box-shadow: 0 2px 6px rgba(0,0,0,0.5); }
.st-ribbon.is-gold { right: auto; left: -40px; top: 18px; width: 170px; transform: rotate(-35deg); color: #2b1906; background: linear-gradient(180deg, #ffe08a, #c68a2a); font-size: 11px; }

/* daily offers */
.st-daily { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 16px; }
.st-day h3 { margin: 2px 0 0; font-family: var(--display); font-weight: 700; font-size: 19px; color: var(--bone); line-height: 1.2; }
.st-day.is-SKIN { border-color: rgba(232,176,75,0.45); }
.st-day.is-done { opacity: 0.72; }
.st-off { margin: 4px 0 0; font-size: 12.5px; font-weight: 700; color: #9be37a; }
.st-off.is-plain { color: var(--ash); font-weight: 500; }

/* price pills */
.st-pricepair { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; width: 100%; }
.st-pay { display: grid; grid-template-columns: auto 1fr; grid-template-rows: auto auto; column-gap: 7px; align-items: center; text-align: left; padding: 7px 10px; border-radius: 10px; cursor: pointer;
  background: linear-gradient(180deg, rgba(255,214,140,0.10), rgba(0,0,0,0.25)); border: 1px solid rgba(242,181,60,0.45); color: var(--bone);
  transition: transform 140ms var(--hn-ease-out), border-color 160ms ease, box-shadow 180ms ease, background 180ms ease; }
.st-pay svg { grid-row: 1 / span 2; }
.st-pay b { font-size: 15px; font-weight: 800; line-height: 1.1; font-variant-numeric: tabular-nums; color: #ffd98a; }
.st-pay span { font-size: 10.5px; font-weight: 600; color: var(--ash); line-height: 1.1; }
.st-pay.is-gem { background: linear-gradient(180deg, rgba(120,190,255,0.12), rgba(0,0,0,0.25)); border-color: rgba(92,192,255,0.45); }
.st-pay.is-gem b { color: #a8dcff; }
.st-pay:hover:not(:disabled) { transform: translateY(-1px); border-color: #ffd98a; box-shadow: 0 0 14px rgba(242,181,60,0.25); }
.st-pay.is-gem:hover:not(:disabled) { border-color: #a8dcff; box-shadow: 0 0 14px rgba(92,192,255,0.3); }
.st-pay:active:not(:disabled) { transform: scale(0.97); }
.st-pay:disabled { cursor: default; opacity: 0.42; filter: saturate(0.5); }

/* featured: starter + VIP */
.st-featured { display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 18px; }
.st-starter, .st-vip { position: relative; display: flex; flex-direction: column; padding: 22px 22px 20px; border-radius: 18px; overflow: hidden; isolation: isolate; }
.st-starter { border: 1px solid rgba(232,176,75,0.6);
  background: radial-gradient(70% 50% at 70% 0%, rgba(255,200,110,0.22), transparent 70%), linear-gradient(160deg, #3a2612 0%, #1a110a 60%, #120c07 100%);
  box-shadow: inset 0 1px 0 rgba(255,236,190,0.18), 0 18px 40px rgba(0,0,0,0.45), 0 0 40px rgba(232,176,75,0.10); }
.st-starter-stage { position: relative; display: flex; align-items: flex-end; justify-content: center; height: 170px; margin: -6px 0 6px;
  background: radial-gradient(45% 60% at 50% 45%, rgba(140,180,255,0.22), transparent 70%), radial-gradient(40% 10% at 50% 94%, rgba(0,0,0,0.6), transparent 70%); }
.st-starter-stage canvas { animation: hn-float 4s ease-in-out infinite; }
.st-starter-gems { position: absolute; right: 8%; bottom: 0; width: 110px; }
.st-starter-gems .st-pile { width: 100%; height: auto; }
.st-starter h3, .st-vip h3 { margin: 0; font-family: var(--display); font-weight: 700; font-size: 30px; line-height: 1.05; color: var(--gold-hi); }
.st-feat-body { margin: 6px 0 0; font-size: 14px; color: #d9cdb6; line-height: 1.5; }
.st-contents-label { margin: 14px 0 6px; font-size: 11.5px; letter-spacing: 0.06em; color: var(--ash); }
.st-contents, .st-perks { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.st-perks { grid-template-columns: 1fr; margin-top: 14px; }
.st-contents li, .st-perks li { display: flex; align-items: center; gap: 10px; padding: 8px 10px; border-radius: 10px; background: rgba(0,0,0,0.28); border: 1px solid rgba(255,236,190,0.08); font-size: 13.5px; font-weight: 600; color: var(--bone); }
.st-contents-ico { flex: none; width: 30px; height: 30px; display: grid; place-items: center; border-radius: 8px; color: var(--gold-hi); background: radial-gradient(circle at 50% 35%, rgba(255,214,140,0.25), rgba(0,0,0,0.3)); box-shadow: inset 0 0 0 1px rgba(255,214,140,0.2); }
.st-buybox { display: flex; flex-wrap: wrap; align-items: center; gap: 10px 16px; margin-top: auto; padding-top: 18px; }
.st-buybox .st-price { font-family: var(--display); font-size: 28px; font-weight: 700; color: #fff3d6; font-variant-numeric: lining-nums tabular-nums; }
.st-buybox .st-price small { font-family: inherit; font-size: 13px; color: var(--ash); font-weight: 500; }
.st-buybox .st-buy { flex: 1; min-width: 150px; }
.st-buybox > small { width: 100%; font-size: 12px; color: var(--ash); }

/* VIP: royal violet and gold, a slow light running round its edge */
.st-vip { border: 1px solid transparent;
  background: radial-gradient(60% 50% at 20% 0%, rgba(200,120,255,0.25), transparent 70%), linear-gradient(160deg, #2a1640 0%, #160c24 55%, #0e0818 100%) padding-box,
              conic-gradient(from var(--vip-a, 0deg), #6a3aa0, #f0be52, #fff3c4, #f0be52, #6a3aa0 40%, #3a1e5a 70%, #6a3aa0) border-box;
  box-shadow: 0 18px 40px rgba(0,0,0,0.5), 0 0 40px rgba(160,90,255,0.15); animation: st-vip-edge 6s linear infinite; }
@property --vip-a { syntax: "<angle>"; initial-value: 0deg; inherits: false; }
@keyframes st-vip-edge { to { --vip-a: 360deg; } }
.st-vip::before { content: ""; position: absolute; inset: 0; z-index: -1; pointer-events: none; opacity: 0.5;
  background-image: radial-gradient(1.5px 1.5px at 20% 30%, #fff3c4, transparent), radial-gradient(1px 1px at 70% 20%, #e8c8ff, transparent), radial-gradient(1.5px 1.5px at 85% 60%, #fff3c4, transparent), radial-gradient(1px 1px at 40% 70%, #e8c8ff, transparent), radial-gradient(1px 1px at 60% 45%, #fff, transparent);
  animation: st-twinkle 4s ease-in-out infinite alternate; }
@keyframes st-twinkle { from { opacity: 0.25; } to { opacity: 0.7; } }
.st-vip-stage { position: relative; display: grid; place-items: center; height: 170px; margin: -6px 0 6px;
  background: radial-gradient(40% 55% at 50% 48%, rgba(240,190,82,0.28), transparent 70%), radial-gradient(34% 9% at 50% 94%, rgba(0,0,0,0.6), transparent 70%); }
.st-vip-rays { position: absolute; left: 50%; top: 48%; width: 260px; height: 260px; margin: -130px 0 0 -130px; border-radius: 50%; pointer-events: none; opacity: 0.55;
  background: repeating-conic-gradient(from 0deg, rgba(255,236,170,0.22) 0deg 6deg, transparent 6deg 22deg);
  -webkit-mask: radial-gradient(circle, #000 18%, transparent 68%); mask: radial-gradient(circle, #000 18%, transparent 68%); animation: hn-spin 40s linear infinite; }
.st-vip-head { display: flex; flex-wrap: wrap; align-items: baseline; gap: 6px 12px; }
.st-vip-days { font-size: 13px; font-weight: 700; color: #d8c8ec; }
.st-crown { position: relative; width: 128px; height: 104px; filter: drop-shadow(0 8px 18px rgba(240,190,82,0.5)); animation: hn-float 3.6s ease-in-out infinite; }
.st-vip h3 { font-size: 34px; letter-spacing: 0.08em; background: linear-gradient(180deg, #fff3c4, #f0be52 60%, #b07a20); -webkit-background-clip: text; background-clip: text; color: transparent; }
.st-vip .st-feat-body { color: #d8c8ec; }
.st-vip .st-perks li { background: rgba(20,8,36,0.5); border-color: rgba(220,180,255,0.14); }
.st-vip .st-contents-ico { color: #f0be52; background: radial-gradient(circle at 50% 35%, rgba(200,130,255,0.3), rgba(0,0,0,0.3)); box-shadow: inset 0 0 0 1px rgba(220,180,255,0.25); }
.st-vip-active { display: inline-block; margin-top: 4px; padding: 2px 10px; border-radius: 999px; background: rgba(110,220,120,0.15); border: 1px solid rgba(110,220,120,0.5); color: #9be37a; font-size: 12px; font-weight: 700; }
.st-buy.is-vip:not(:disabled) { border-color: #fff3c4; background: linear-gradient(180deg, #fff0b8 0%, #f0be52 50%, #b07a20 100%); }

/* gem packs */
.st-packs { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 14px; }
.st-pack { position: relative; display: flex; flex-direction: column; align-items: center; text-align: center; padding: 18px 14px 14px; border-radius: 16px;
  background: radial-gradient(80% 50% at 50% 20%, rgba(92,192,255,0.16), transparent 70%), linear-gradient(180deg, #16212e, #0e131b 70%);
  border: 1px solid rgba(92,192,255,0.25); box-shadow: inset 0 1px 0 rgba(200,235,255,0.1), 0 8px 20px rgba(0,0,0,0.35);
  transition: transform 220ms var(--hn-ease-out), border-color 200ms ease, box-shadow 220ms ease; }
.st-pack:hover { transform: translateY(-5px); border-color: rgba(168,220,255,0.6); box-shadow: inset 0 1px 0 rgba(200,235,255,0.14), 0 18px 32px rgba(0,0,0,0.5), 0 0 26px rgba(92,192,255,0.22); }
.st-pack.is-tagged { border-color: rgba(240,190,82,0.7); background: radial-gradient(80% 50% at 50% 20%, rgba(240,190,82,0.16), transparent 70%), radial-gradient(80% 50% at 50% 30%, rgba(92,192,255,0.14), transparent 70%), linear-gradient(180deg, #1c2230, #0e131b 70%); }
.st-pack.is-BEST_VALUE { box-shadow: inset 0 1px 0 rgba(255,236,190,0.14), 0 8px 20px rgba(0,0,0,0.35), 0 0 30px rgba(240,190,82,0.18); }
.st-pile { width: 100%; max-width: 132px; height: 96px; overflow: visible; transition: transform 320ms var(--hn-ease-back); }
.st-pack:hover .st-pile { transform: translateY(-4px) scale(1.06); }
.st-tag { position: absolute; z-index: 1; top: -11px; padding: 3px 12px; border-radius: 999px; background: linear-gradient(180deg, #ffe08a, #d89a30); color: #2b1906; font-size: 11.5px; font-weight: 800; box-shadow: 0 3px 8px rgba(0,0,0,0.45); white-space: nowrap; }
.st-amount { margin: 6px 0 0; font-family: var(--display); font-weight: 700; font-size: 34px; line-height: 1; color: #eaf6ff; font-variant-numeric: lining-nums tabular-nums; text-shadow: 0 2px 10px rgba(92,192,255,0.35); }
.st-amount-unit { margin: 2px 0 0; font-size: 11.5px; color: #8fb8d8; letter-spacing: 0.05em; }
.st-bonus { margin: 8px 0 12px; padding: 2px 10px; border-radius: 999px; font-size: 12px; font-weight: 700; color: #9be37a; background: rgba(110,220,120,0.12); border: 1px solid rgba(110,220,120,0.35); }
.st-bonus.is-none { color: var(--ash); background: transparent; border-color: transparent; font-weight: 500; }
.st-pack-buy { margin-top: auto; display: grid; gap: 1px; padding: 8px 10px !important; }
.st-pack-price { font-size: 16px; font-weight: 800; }
.st-pack-soon { font-size: 10.5px; font-weight: 600; opacity: 0.85; }

/* gold call to action */
.st-buy { width: 100%; padding: 11px 14px; border-radius: 10px; cursor: pointer; font-weight: 800; font-size: 14px; border: 1px solid #f2c873; color: #2b1906 !important; position: relative; overflow: hidden;
  background: linear-gradient(180deg, #f6cf7a 0%, var(--gold) 55%, #c58a2c 100%); box-shadow: inset 0 1px 0 rgba(255,255,255,0.4), 0 4px 12px rgba(0,0,0,0.35);
  transition: transform 140ms var(--hn-ease-out), filter 160ms ease, box-shadow 180ms ease; }
.st-buy:hover:not(:disabled) { transform: translateY(-1px); filter: brightness(1.08); box-shadow: inset 0 1px 0 rgba(255,255,255,0.4), 0 8px 18px rgba(0,0,0,0.4), 0 0 18px rgba(240,190,82,0.35); }
.st-buy:active:not(:disabled) { transform: scale(0.98); }
.st-buy:disabled { cursor: default; background: linear-gradient(180deg, rgba(239,229,210,0.09), rgba(239,229,210,0.04)); border-color: rgba(239,229,210,0.22); color: #cdbf9f !important; box-shadow: none; }

/* age notice */
.st-adult { display: flex; align-items: center; gap: 10px; margin: -4px 0 16px; padding: 9px 12px; border-radius: 10px; border: 1px solid var(--line); background: rgba(0,0,0,0.25); font-size: 12.5px; color: var(--ash); max-width: 820px; line-height: 1.45; }
.st-adult-badge { flex: none; display: inline-flex; align-items: center; justify-content: center; min-width: 38px; height: 26px; padding: 0 6px; border-radius: 6px; border: 1.5px solid #e0644b; color: #ff9a85; font-weight: 800; font-size: 13px; }

/* moment offer */
.st-moment { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 16px 32px; margin-top: 22px; padding: 20px 22px; border-radius: 16px; border: 1px solid rgba(224,100,75,0.6);
  background: radial-gradient(60% 80% at 0% 50%, rgba(224,100,75,0.22), transparent 70%), linear-gradient(100deg, rgba(60,20,12,0.8), rgba(20,14,9,0.85) 65%); box-shadow: 0 14px 30px rgba(0,0,0,0.4); }
.st-moment h2 { margin: 2px 0 0; font-family: var(--display); font-weight: 700; font-size: 26px; color: #ffb59f; }
.st-moment p { margin: 4px 0 0; font-size: 14px; color: #d9cdb6; max-width: 60ch; }
.st-moment-kicker { display: inline-flex; align-items: center; gap: 6px; font-size: 12.5px !important; font-weight: 700; color: #ff9a85 !important; }
.st-moment-list { color: var(--bone) !important; font-weight: 600; }
.st-moment .st-buybox { margin-top: 0; padding-top: 0; min-width: 220px; }

/* castles */
.st-castles { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 14px; margin-top: 14px; }
.st-castle { align-items: center; text-align: center; padding-bottom: 14px; }
.st-castle .st-stage { width: 100%; min-height: 176px; }
.st-castle h3 { margin: 12px 12px 0; font-family: var(--display); font-size: 18px; color: var(--bone); }
.st-castle-how { margin: 4px 12px 12px; font-size: 12.5px; color: var(--ash); min-height: 2.6em; }
.st-castle .st-pricepair, .st-castle .st-wear { width: calc(100% - 28px); margin-top: auto; }
.st-wear { padding: 9px 14px; border-radius: 10px; cursor: pointer; font-weight: 700; font-size: 13.5px; color: var(--bone); background: rgba(0,0,0,0.3); border: 1px solid rgba(232,176,75,0.4); transition: border-color 160ms ease, background 160ms ease, transform 140ms var(--hn-ease-out); }
.st-wear:hover:not(:disabled) { border-color: var(--gold-hi); background: rgba(232,176,75,0.12); }
.st-wear.is-on { color: #9be37a; border-color: rgba(110,220,120,0.45); cursor: default; }
.st-wear.is-cta { color: #2b1906; border-color: #f2c873; background: linear-gradient(180deg, #f6cf7a, var(--gold) 55%, #c58a2c); }

/* tower skins */
.pg-chips.st-seg { display: inline-flex; max-width: 100%; margin-top: 18px; padding: 4px; gap: 2px; border-radius: 999px; background: rgba(0,0,0,0.35); border: 1px solid var(--line); }
.st-seg button { border: none !important; border-radius: 999px !important; background: transparent; }
.st-seg button.is-on { background: linear-gradient(180deg, #f6cf7a, var(--gold) 55%, #c58a2c) !important; color: #2b1906 !important; font-weight: 700; }
.st-skins { display: grid; grid-template-columns: repeat(auto-fill, minmax(360px, 1fr)); gap: 16px; margin-top: 16px; }
.st-skin { flex-direction: row; }
.st-portrait { flex: none; width: 150px; min-height: 100%; border-bottom: none; border-right: 1px solid rgba(232,176,75,0.15); }
.st-skin.is-PREMIUM { border-color: rgba(200,140,255,0.35); }
.st-skin.is-PREMIUM .st-portrait { background-color: rgba(160,90,255,0.06); }
.st-skin.is-PRESTIGE { border-color: rgba(240,190,82,0.5); }
.st-tier { position: absolute; z-index: 1; top: 8px; left: 8px; padding: 2px 8px; border-radius: 999px; font-size: 10.5px; font-weight: 800; letter-spacing: 0.04em; color: var(--bone); background: rgba(0,0,0,0.55); border: 1px solid rgba(239,229,210,0.25); }
.st-tier.is-INTERMEDIATE { color: #8fd0ff; border-color: rgba(92,192,255,0.5); }
.st-tier.is-PREMIUM { color: #d6a8ff; border-color: rgba(200,140,255,0.55); }
.st-tier.is-PRESTIGE { color: #ffd98a; border-color: rgba(240,190,82,0.6); }
.st-skin-body { flex: 1; min-width: 0; padding: 14px 16px; display: flex; flex-direction: column; }
.st-skin h3 { margin: 2px 0 0; font-family: var(--display); font-weight: 700; font-size: 22px; line-height: 1.1; color: var(--bone); }
.st-desc { margin: 6px 0 0; font-size: 13px; line-height: 1.5; color: var(--ash); }
.st-effects { margin: 8px 0 0; padding: 0; list-style: none; display: flex; flex-wrap: wrap; gap: 5px; font-size: 12px; font-weight: 700; }
.st-effects li { padding: 2px 8px; border-radius: 999px; }
.st-effects .is-up { color: var(--ok); background: rgba(110,220,120,0.1); border: 1px solid rgba(110,220,120,0.3); }
.st-effects .is-down { color: #ff8a7a; background: rgba(224,100,75,0.1); border: 1px solid rgba(224,100,75,0.3); }
.st-reward { margin: 8px 0 0; font-size: 12px; font-weight: 600; color: var(--gold); line-height: 1.4; }
.st-actions { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 10px; margin-top: auto; padding-top: 12px; }
.st-locked { margin: 0; font-size: 13px; color: var(--ash-2); }
.st-owned { margin: 0; font-size: 13px; color: var(--ok); font-weight: 700; }
.st-evolve { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 8px; margin-top: 10px; padding-top: 10px; border-top: 1px dashed var(--line); }
.st-evolve-label { width: 100%; font-size: 12.5px; color: #e3cdff; font-weight: 700; }
.st-evolved { font-size: 12.5px; font-weight: 700; color: #e3cdff; }

@media (prefers-reduced-motion: reduce) {
  .st-wallet-gem svg, .st-gift.is-ready .st-chest, .st-gift.is-ready .st-chest-light, .st-vip, .st-vip::before, .st-crown, .st-vip-rays, .st-starter-stage canvas, .st-stage.is-mat svg { animation: none !important; }
  .st-card, .st-card:hover, .st-pack, .st-pack:hover, .st-pile { transform: none !important; }
}
@media (max-width: 720px) {
  .st-balance { width: 100%; }
  .st-wallet { flex: 1; padding: 10px 12px 10px 10px; }
  .st-skins { grid-template-columns: minmax(0, 1fr); }
  .st-portrait { width: 116px; }
  .st-portrait canvas { width: 116px !important; height: 116px !important; }
  .st-contents { grid-template-columns: 1fr; }
}
@media (max-width: 560px) {
  .st-packs { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
  .st-amount { font-size: 28px; }
  .st-featured { grid-template-columns: minmax(0, 1fr); }
  .st-vip h3 { font-size: 32px; }
}
`;
