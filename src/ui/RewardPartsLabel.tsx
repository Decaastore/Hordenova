import { useLanguage } from "@/i18n/LanguageContext";
import type { TranslationKey } from "@/i18n/translate";
import type { RewardPart } from "@/config/seasonPass";
import { goldForKills } from "@/engine/RewardGrant";

/** One line per reward part, in plain words ("Lendário: Olho do Guardião", "320 de ouro"). Gold is shown at the player's current wave. */
export function RewardPartsLabel({ parts, currentWave }: { parts: readonly RewardPart[]; currentWave: number }) {
  const { t, language } = useLanguage();
  const num = new Intl.NumberFormat(language === "ptBR" ? "pt-BR" : "en-US");
  return (
    <>
      {parts.map((part, i) => {
        switch (part.kind) {
          case "SHARDS":
            return <span key={i}>{t("reward.shards", { n: part.amount })}</span>;
          case "GEMS":
            return (
              <span key={i} className="rw-gem">
                {t(part.amount === 1 ? "reward.gem" : "reward.gems", { n: part.amount })}
              </span>
            );
          case "PURCHASED_GEMS":
            return (
              <span key={i} className="rw-gem">
                {t("reward.purchasedGems", { n: num.format(part.amount) })}
              </span>
            );
          case "GOLD":
            return (
              <span key={i} className="rw-gold">
                {t("reward.gold", { n: num.format(goldForKills({ currentWave }, part.kills)) })}
              </span>
            );
          case "INVENTORY_SLOTS":
            return <span key={i}>{t("reward.slots", { n: part.amount })}</span>;
          case "ITEM":
            return (
              <span key={i} className={`rw-item rw-${part.rarity.toLowerCase()}`}>
                {t("reward.item", { rarity: t(`rarity.${part.rarity}` as TranslationKey) })}
              </span>
            );
          case "SKIN":
            return (
              <span key={i} className="rw-skin">
                {t("reward.skin", { name: t(`towerSkins.${part.skinId}.name` as TranslationKey) })}
              </span>
            );
        }
      })}
    </>
  );
}

export const REWARD_CSS = `
.rw-gem { color: #9fd3ff; font-weight: 700; }
.rw-gold { color: var(--gold-hi); font-weight: 600; }
.rw-item { font-weight: 700; }
.rw-uncommon { color: #8ed39b; } .rw-rare { color: #8fc6ff; } .rw-epic { color: #c79bff; } .rw-legendary { color: #f2c873; }
.rw-skin { color: #f7dc9c; font-weight: 700; }
`;
