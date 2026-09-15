import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { PALETTE } from "@/rendering/theme";
import { useLanguage } from "@/i18n/LanguageContext";
import type { TranslationKey } from "@/i18n/translate";
import { getItemDefinition, type ItemCategory } from "@/config/itemDefinitions";
import { getRarityDefinition } from "@/config/rarity";
import { FUSION_ITEM_COUNT, getFusionSuccessChance } from "@/config/itemFusion";
import type { ItemInstance } from "@/entities/Item";
import type { FusionEligibility, FusionOutcome } from "@/engine/ItemFusion";
import { RarityBadge } from "./RarityBadge";
import { ItemDetailsModal } from "./ItemDetailsModal";
import { TradeScreen } from "./TradeScreen";
import { EconomyStatsPanel } from "./EconomyStatsPanel";
import { GameEngine } from "@/engine/GameEngine";
import { ItemGlyph } from "./ItemGlyph";
import { ItemHoverCard, ITEM_TOOLTIP_KEYFRAMES } from "./ItemTooltip";

/**
 * ITENS COMO ITENS REAIS — fixed display order for the inventory's category
 * filter row (real ItemCategory values only — never a fabricated one). A
 * category only shows as a filter chip when the player actually owns at
 * least one item in it (see `availableCategories` below), so a 1-item
 * catalog phase like this one doesn't clutter the UI with empty tabs.
 */
const CATEGORY_DISPLAY_ORDER: readonly ItemCategory[] = ["AMULET", "MATERIAL", "RELIC", "RUNE", "ARTIFACT", "COSMETIC"];

/**
 * IDENTIDADE VISUAL HORDENOVA — CAMADA 2 (Núcleo) for rare items: EPIC+
 * tiles pulse their rarity-colored glow slowly instead of holding a static
 * shadow, the same "power heart" read a tower's core gets. Items aren't
 * canvas-rendered on the map (see RarityBadge/ItemTile), so this layer is
 * CSS rather than a canvas draw call — same underlying idea (a magical
 * object's glow breathes, it isn't decoration painted on top).
 */
const ITEM_PULSE_KEYFRAMES = `
@keyframes hordenova-item-core-pulse {
  0%, 100% { box-shadow: 0 0 10px var(--pulse-color); }
  50% { box-shadow: 0 0 20px var(--pulse-color); }
}
`;

/** A subtle lift on hover — collectible-card feel without any exaggerated motion. */
const ITEM_TILE_HOVER_CSS = `
.hordenova-item-tile:hover { transform: translateY(-2px); }
`;

/** EPIC (order 3) and above get the pulsing core read; COMMON/UNCOMMON/RARE stay static. */
function rarityPulseStyle(rarityDef: { order: number; glow: string }): CSSProperties {
  if (rarityDef.order < 3) return {};
  return {
    animation: "hordenova-item-core-pulse 2.2s ease-in-out infinite",
    "--pulse-color": rarityDef.glow,
  } as CSSProperties;
}

interface InventoryPanelProps {
  inventory: readonly ItemInstance[];
  localEconomyTotals: { bossesDefeatedTotal: number; miniBossesDefeatedTotal: number };
  onClose: () => void;
  /** Progression 2.0 spec section 36/39 — usable slots and the never-deletes-anything overflow waiting area. */
  inventoryCapacity: number;
  overflowInventory: readonly ItemInstance[];
  onClaimOverflowItem: (instanceId: string) => void;
  /** Progression 2.0 spec section 34 — manual, player-triggered Shards -> Gems conversion. */
  gemShards: number;
  onConvertGemShards: () => void;
  /** Master Implementation Pass spec section 7-8 — Profile Prestige, the recurring cosmetic Gem sink. */
  gems: number;
  prestigeLevel: number;
  /** The account's all-time record wave — gates whether Prestige is unlocked at all (see config/prestige.ts's canUnlockPrestige). */
  bestWave: number;
  onUpgradePrestige: () => void;
  /** SISTEMA DE FUSÃO DE ITENS — read-only pre-check for the UI (enables/disables CONFIRMAR FUSÃO, explains why blocked). Re-validated again, unconditionally, by onAttemptFusion itself — the UI's own read is never trusted for the actual spend. */
  getFusionEligibility: (selectedInstanceIds: string[]) => FusionEligibility;
  /** Pays out the atomic fusion attempt — consumes the 3 selected items and, on success only, creates 1 superior item. See engine/GameEngine.ts's attemptFusion for the exact 8-step guarantee. */
  onAttemptFusion: (selectedInstanceIds: string[]) => FusionOutcome;
}

type Tab = "items" | "trade" | "stats";

/**
 * Item System spec section 32 — the one entry point for Inventory / Item
 * Details / Drop Table / Trade / Stats, opened from a single HUD button.
 *
 * This is a PURE UI OVERLAY: it renders on top of GameScreen while the
 * engine keeps running underneath exactly as it would with the panel
 * closed. Nothing here reads or writes engine state beyond the read-only
 * `inventory`/`localEconomyTotals` props GameScreen passes in — opening or
 * closing it can never reset a wave, an enemy, a tower, a boss, a timer,
 * or Active Idle progression, because it has no way to touch any of that.
 * Closes via the X button, the same HUD toggle, clicking the backdrop, or
 * Escape (LanguageSelector is the only other Escape listener in the app,
 * and it's scoped to the main menu, so there's no conflict here).
 */
export function InventoryPanel({
  inventory,
  localEconomyTotals,
  onClose,
  inventoryCapacity,
  overflowInventory,
  onClaimOverflowItem,
  gemShards,
  onConvertGemShards,
  gems,
  prestigeLevel,
  bestWave,
  onUpgradePrestige,
  getFusionEligibility,
  onAttemptFusion,
}: InventoryPanelProps) {
  const { t } = useLanguage();
  const [tab, setTab] = useState<Tab>("items");
  const [selectedInstanceId, setSelectedInstanceId] = useState<string | null>(null);
  // ITENS COMO ITENS REAIS — category filter is local UI state; "ALL" (the
  // default) shows every real item exactly as before this feature, so
  // nothing about the existing grid changes unless the player actively
  // narrows it down.
  const [categoryFilter, setCategoryFilter] = useState<ItemCategory | "ALL">("ALL");
  // SISTEMA DE FUSÃO DE ITENS — selection is local UI state, not engine
  // state (nothing is consumed until CONFIRMAR FUSÃO). Auto-drops any
  // instanceId that stops existing in `inventory` — e.g. after a
  // successful/failed fusion consumes it, or it gets equipped/traded away
  // in another tab — so the selection can never silently reference a
  // now-gone item.
  const [fusionSelectedIds, setFusionSelectedIds] = useState<string[]>([]);
  const [fusionConfirming, setFusionConfirming] = useState(false);
  const [fusionOutcome, setFusionOutcome] = useState<FusionOutcome | null>(null);

  useEffect(() => {
    setFusionSelectedIds((prev) => prev.filter((id) => inventory.some((item) => item.instanceId === id)));
  }, [inventory]);

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  const selectedItem = selectedInstanceId ? inventory.find((i) => i.instanceId === selectedInstanceId) ?? null : null;

  // ITENS COMO ITENS REAIS — a category only ever appears as a filter chip
  // if the player actually owns a real item in it (never a fabricated
  // category placeholder), and the filter itself only ever excludes items
  // the player already owns — it never changes what's actually in
  // `inventory`.
  const availableCategories = useMemo(() => {
    const present = new Set<ItemCategory>();
    for (const item of inventory) {
      const def = getItemDefinition(item.itemDefinitionId);
      if (def) present.add(def.category);
    }
    return CATEGORY_DISPLAY_ORDER.filter((c) => present.has(c));
  }, [inventory]);

  const filteredInventory = useMemo(() => {
    if (categoryFilter === "ALL") return inventory;
    return inventory.filter((item) => getItemDefinition(item.itemDefinitionId)?.category === categoryFilter);
  }, [inventory, categoryFilter]);

  return (
    <div style={overlayStyle} onClick={onClose}>
      {/* IDENTIDADE VISUAL HORDENOVA — CAMADA 2 (Núcleo) for rare items:
          EPIC+ tiles get a slow pulsing glow instead of a static shadow, the
          same "power heart" read a tower's core gets. Rarity itself already
          drives every item tile's border/shadow color (see ItemTile/
          OverflowItemTile below); this only adds the pulse animation. */}
      <style>{ITEM_PULSE_KEYFRAMES}{ITEM_TOOLTIP_KEYFRAMES}{ITEM_TILE_HOVER_CSS}</style>
      <div style={cardStyle} onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} style={closeButtonStyle}>
          ×
        </button>
        <div style={titleStyle}>{t("inventory.title")}</div>

        <div style={tabRowStyle}>
          <TabButton active={tab === "items"} onClick={() => setTab("items")} label={t("inventory.tabs.items")} />
          <TabButton active={tab === "trade"} onClick={() => setTab("trade")} label={t("inventory.tabs.trade")} />
          <TabButton active={tab === "stats"} onClick={() => setTab("stats")} label={t("inventory.tabs.stats")} />
        </div>

        {tab === "items" && (
          <>
            <div style={capacityRowStyle}>
              <span>{t("inventory.capacity", { used: inventory.length, capacity: inventoryCapacity })}</span>
            </div>

            {gemShards > 0 && (
              // AUDITORIA E CORREÇÃO GERAL spec section 18 — exact raw
              // values (never a "1.2K"-style abbreviation), and section 15's
              // "a mesma função/regra deve ser usada por UI/clique/validação"
              // — GameEngine.canConvertGemShards is the ONE eligibility rule
              // both this button's disabled state and convertGemShards()
              // itself check, so they can never disagree.
              <div style={convertBoxStyle}>
                <div style={convertRowStyle}>
                  <span>{t("gems.shardsAvailable")}</span>
                  <span>{gemShards}</span>
                </div>
                <div style={convertRowStyle}>
                  <span>{t("gems.cost")}</span>
                  <span>{GameEngine.GEM_SHARD_TO_GEM_RATE}</span>
                </div>
                <div style={convertRowStyle}>
                  <span>{t("gems.receive")}</span>
                  <span>1</span>
                </div>
                <button
                  onClick={onConvertGemShards}
                  disabled={!GameEngine.canConvertGemShards(gemShards)}
                  style={{
                    ...convertButtonStyle,
                    opacity: GameEngine.canConvertGemShards(gemShards) ? 1 : 0.45,
                    cursor: GameEngine.canConvertGemShards(gemShards) ? "pointer" : "not-allowed",
                  }}
                >
                  {t("gems.convert")}
                </button>
              </div>
            )}

            {inventory.length === 0 ? (
              <div style={emptyStyle}>{t("inventory.empty")}</div>
            ) : (
              <>
                {availableCategories.length > 1 && (
                  <div style={categoryFilterRowStyle}>
                    <CategoryChip
                      active={categoryFilter === "ALL"}
                      label={t("inventory.categoryAll")}
                      onClick={() => setCategoryFilter("ALL")}
                    />
                    {availableCategories.map((category) => (
                      <CategoryChip
                        key={category}
                        active={categoryFilter === category}
                        label={t(`itemCategory.${category}` as TranslationKey)}
                        onClick={() => setCategoryFilter(category)}
                      />
                    ))}
                  </div>
                )}

                {filteredInventory.length === 0 ? (
                  <div style={emptyStyle}>{t("inventory.noItemsInCategory")}</div>
                ) : (
                  <div style={gridStyle}>
                    {filteredInventory.map((item) => (
                      <ItemTile
                        key={item.instanceId}
                        item={item}
                        onClick={() => setSelectedInstanceId(item.instanceId)}
                        fusionSelected={fusionSelectedIds.includes(item.instanceId)}
                        onToggleFusionSelect={() => {
                          setFusionOutcome(null);
                          setFusionConfirming(false);
                          setFusionSelectedIds((prev) => {
                            if (prev.includes(item.instanceId)) return prev.filter((id) => id !== item.instanceId);
                            if (prev.length >= FUSION_ITEM_COUNT) return prev; // never selects a 4th — the extra is simply ignored
                            return [...prev, item.instanceId];
                          });
                        }}
                      />
                    ))}
                  </div>
                )}
              </>
            )}

            <FusionSection
              inventory={inventory}
              selectedIds={fusionSelectedIds}
              onDeselect={(instanceId) => setFusionSelectedIds((prev) => prev.filter((id) => id !== instanceId))}
              getFusionEligibility={getFusionEligibility}
              confirming={fusionConfirming}
              onRequestConfirm={() => setFusionConfirming(true)}
              onCancelConfirm={() => setFusionConfirming(false)}
              onConfirm={() => {
                const outcome = onAttemptFusion(fusionSelectedIds);
                setFusionOutcome(outcome);
                setFusionConfirming(false);
                if (outcome.status !== "BLOCKED") setFusionSelectedIds([]);
              }}
              outcome={fusionOutcome}
              onDismissOutcome={() => setFusionOutcome(null)}
            />

            {overflowInventory.length > 0 && (
              <>
                <div style={overflowTitleStyle}>{t("inventory.overflowTitle")}</div>
                <div style={overflowHintStyle}>{t("inventory.overflowHint")}</div>
                <div style={gridStyle}>
                  {overflowInventory.map((item) => (
                    <OverflowItemTile key={item.instanceId} item={item} onClaim={() => onClaimOverflowItem(item.instanceId)} />
                  ))}
                </div>
              </>
            )}
          </>
        )}

        {tab === "trade" && <TradeScreen />}

        {tab === "stats" && (
          <EconomyStatsPanel
            summary={{
              bossesDefeatedTotal: localEconomyTotals.bossesDefeatedTotal,
              miniBossesDefeatedTotal: localEconomyTotals.miniBossesDefeatedTotal,
              itemsOwnedTotal: inventory.length,
              itemsFoundTotal: inventory.length,
            }}
            gems={gems}
            prestigeLevel={prestigeLevel}
            bestWave={bestWave}
            onUpgradePrestige={onUpgradePrestige}
          />
        )}
      </div>

      {selectedItem && <ItemDetailsModal item={selectedItem} onClose={() => setSelectedInstanceId(null)} />}
    </div>
  );
}

function TabButton({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      style={{
        ...tabButtonStyle,
        borderColor: active ? PALETTE.uiAccent : PALETTE.uiPanelBorder,
        color: active ? PALETTE.uiAccentBright : PALETTE.uiTextDim,
        background: active ? "rgba(255,210,87,0.14)" : "transparent",
      }}
    >
      {label}
    </button>
  );
}

function CategoryChip({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        ...categoryChipStyle,
        borderColor: active ? PALETTE.uiAccent : PALETTE.uiPanelBorder,
        color: active ? PALETTE.uiAccentBright : PALETTE.uiTextDim,
        background: active ? "rgba(255,210,87,0.14)" : "transparent",
      }}
    >
      {label}
    </button>
  );
}

function ItemTile({
  item,
  onClick,
  fusionSelected,
  onToggleFusionSelect,
}: {
  item: ItemInstance;
  onClick: () => void;
  /** SISTEMA DE FUSÃO DE ITENS — whether this item is currently one of the (at most 3) selected for a fusion attempt. */
  fusionSelected: boolean;
  onToggleFusionSelect: () => void;
}) {
  const { t } = useLanguage();
  const def = getItemDefinition(item.itemDefinitionId);
  if (!def) return null;
  const rarityDef = getRarityDefinition(def.rarity);

  return (
    <ItemHoverCard itemDefinitionId={item.itemDefinitionId}>
      <div
        className="hordenova-item-tile"
        style={{
          ...tileStyle,
          position: "relative",
          borderColor: fusionSelected ? PALETTE.uiAccent : rarityDef.color,
          boxShadow: fusionSelected ? `0 0 12px ${PALETTE.uiAccent}` : `0 0 12px ${rarityDef.glow}`,
          padding: 0,
          cursor: "default",
          ...(fusionSelected ? {} : rarityPulseStyle(rarityDef)),
        }}
      >
        <button onClick={onClick} style={tileContentButtonStyle}>
          <ItemGlyph itemDefinitionId={def.id} size={44} />
          <div style={tileNameStyle}>{t(`items.${def.i18nKey}.name` as TranslationKey)}</div>
          <RarityBadge rarity={def.rarity} />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleFusionSelect();
          }}
          title={t(fusionSelected ? "inventory.fusion.deselectItem" : "inventory.fusion.selectItem")}
          style={{ ...fusionCheckboxStyle, borderColor: fusionSelected ? PALETTE.uiAccent : PALETTE.uiPanelBorder }}
        >
          {fusionSelected ? "✓" : ""}
        </button>
      </div>
    </ItemHoverCard>
  );
}

function OverflowItemTile({ item, onClaim }: { item: ItemInstance; onClaim: () => void }) {
  const { t } = useLanguage();
  const def = getItemDefinition(item.itemDefinitionId);
  if (!def) return null;
  const rarityDef = getRarityDefinition(def.rarity);

  return (
    <ItemHoverCard itemDefinitionId={item.itemDefinitionId}>
      <button
        className="hordenova-item-tile"
        onClick={onClaim}
        style={{ ...tileStyle, borderColor: rarityDef.color, opacity: 0.85, ...rarityPulseStyle(rarityDef) }}
      >
        <ItemGlyph itemDefinitionId={def.id} size={44} />
        <div style={tileNameStyle}>{t(`items.${def.i18nKey}.name` as TranslationKey)}</div>
        <RarityBadge rarity={def.rarity} />
        <span style={claimLabelStyle}>{t("inventory.claim")}</span>
      </button>
    </ItemHoverCard>
  );
}

/**
 * SISTEMA DE FUSÃO DE ITENS — "select exactly 3 items of the SAME rarity ->
 * attempt exactly 1 item of the NEXT rarity tier." All engine validation
 * (ownership/rarity/eligibility/max-rarity) is re-read from
 * getFusionEligibility on every render — this component never invents its
 * own copy of those rules, so the UI can never disagree with what
 * onAttemptFusion will actually enforce.
 */
function FusionSection({
  inventory,
  selectedIds,
  onDeselect,
  getFusionEligibility,
  confirming,
  onRequestConfirm,
  onCancelConfirm,
  onConfirm,
  outcome,
  onDismissOutcome,
}: {
  inventory: readonly ItemInstance[];
  selectedIds: readonly string[];
  onDeselect: (instanceId: string) => void;
  getFusionEligibility: (selectedInstanceIds: string[]) => FusionEligibility;
  confirming: boolean;
  onRequestConfirm: () => void;
  onCancelConfirm: () => void;
  onConfirm: () => void;
  outcome: FusionOutcome | null;
  onDismissOutcome: () => void;
}) {
  const { t } = useLanguage();
  const selectedItems = selectedIds
    .map((id) => inventory.find((item) => item.instanceId === id))
    .filter((item): item is ItemInstance => !!item);

  const ready = selectedIds.length === FUSION_ITEM_COUNT;
  const eligibility = ready ? getFusionEligibility([...selectedIds]) : null;
  const canConfirm = ready && !!eligibility?.ok;

  return (
    <>
      <div style={fusionSectionDividerStyle} />
      <div style={overflowTitleStyle}>{t("inventory.fusion.title")}</div>

      {outcome && outcome.status !== "BLOCKED" && (
        <div
          style={{
            ...fusionOutcomeBoxStyle,
            borderColor: outcome.status === "SUCCESS" ? PALETTE.success : PALETTE.danger,
          }}
        >
          <span>
            {outcome.status === "SUCCESS"
              ? t("inventory.fusion.successResult", {
                  item: (() => {
                    const resultDef = getItemDefinition(outcome.resultItem.itemDefinitionId);
                    return resultDef ? t(`items.${resultDef.i18nKey}.name` as TranslationKey) : outcome.resultItem.itemDefinitionId;
                  })(),
                })
              : t("inventory.fusion.failureResult")}
          </span>
          <button onClick={onDismissOutcome} style={fusionDismissButtonStyle}>
            ×
          </button>
        </div>
      )}

      <div style={fusionHintStyle}>{t("inventory.fusion.selectHint")}</div>
      <div style={fusionSelectedRowStyle}>
        {Array.from({ length: FUSION_ITEM_COUNT }, (_, i) => {
          const item = selectedItems[i];
          if (!item) return <div key={i} style={fusionSlotEmptyStyle}>{t("inventory.fusion.emptySlot")}</div>;
          const def = getItemDefinition(item.itemDefinitionId);
          if (!def) return null;
          const rarityDef = getRarityDefinition(def.rarity);
          return (
            <button
              key={item.instanceId}
              onClick={() => onDeselect(item.instanceId)}
              style={{ ...fusionSlotFilledStyle, borderColor: rarityDef.color }}
              title={t("inventory.fusion.deselectItem")}
            >
              {t(`items.${def.i18nKey}.name` as TranslationKey)}
            </button>
          );
        })}
      </div>
      <div style={fusionCountStyle}>{t("inventory.fusion.selectedCount", { count: selectedIds.length })}</div>

      {ready && eligibility && (
        <div style={fusionDetailsBoxStyle}>
          {eligibility.ok ? (
            <>
              <div style={convertRowStyle}>
                <span>{t("inventory.fusion.currentRarity")}</span>
                <RarityBadge rarity={eligibility.rarity!} />
              </div>
              <div style={convertRowStyle}>
                <span>{t("inventory.fusion.targetRarity")}</span>
                <RarityBadge rarity={eligibility.nextRarity!} />
              </div>
              <div style={convertRowStyle}>
                <span>{t("inventory.fusion.successChance")}</span>
                <span>{(getFusionSuccessChance(eligibility.rarity!) * 100).toFixed(2)}%</span>
              </div>
              <div style={fusionWarningStyle}>{t("inventory.fusion.warning")}</div>
            </>
          ) : (
            <div style={fusionBlockedStyle}>{t(fusionBlockedReasonKey(eligibility.reason))}</div>
          )}
        </div>
      )}

      {confirming ? (
        <div style={fusionConfirmBoxStyle}>
          <div style={{ fontSize: 10.5, color: PALETTE.uiText, marginBottom: 6 }}>
            {t("inventory.fusion.confirmPrompt", {
              rarity: eligibility?.ok ? t(`rarity.${eligibility.rarity}` as TranslationKey) : "",
              chance: eligibility?.ok ? (getFusionSuccessChance(eligibility.rarity!) * 100).toFixed(2) : "0",
            })}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <button onClick={onConfirm} style={fusionConfirmButtonStyle}>
              {t("inventory.fusion.confirmYes")}
            </button>
            <button onClick={onCancelConfirm} style={fusionCancelButtonStyle}>
              {t("inventory.fusion.confirmNo")}
            </button>
          </div>
        </div>
      ) : (
        <button onClick={onRequestConfirm} disabled={!canConfirm} style={{ ...fusionConfirmButtonStyle, opacity: canConfirm ? 1 : 0.45 }}>
          {t("inventory.fusion.confirmButton")}
        </button>
      )}
    </>
  );
}

function fusionBlockedReasonKey(reason: FusionEligibility["reason"]): TranslationKey {
  switch (reason) {
    case "WRONG_COUNT":
      return "inventory.fusion.blockedWrongCount";
    case "DUPLICATE_SELECTION":
      return "inventory.fusion.blockedDuplicate";
    case "ITEM_NOT_FOUND":
      return "inventory.fusion.blockedNotFound";
    case "NOT_OWNED":
      return "inventory.fusion.blockedNotOwned";
    case "NOT_ELIGIBLE":
      return "inventory.fusion.blockedNotEligible";
    case "MIXED_RARITY":
      return "inventory.fusion.blockedMixedRarity";
    case "MAX_RARITY":
      return "inventory.fusion.blockedMaxRarity";
    default:
      return "inventory.fusion.blockedWrongCount";
  }
}

const overlayStyle: CSSProperties = {
  position: "absolute",
  inset: 0,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "rgba(10,7,4,0.8)",
  zIndex: 7,
};

const cardStyle: CSSProperties = {
  position: "relative",
  width: 460,
  maxWidth: "90%",
  maxHeight: "82%",
  overflowY: "auto",
  padding: "22px 24px",
  borderRadius: 14,
  border: `1px solid ${PALETTE.uiPanelBorder}`,
  background: "linear-gradient(160deg, rgba(54,36,22,0.98), rgba(30,20,12,0.99))",
  color: PALETTE.uiText,
  boxShadow: "0 20px 60px rgba(0,0,0,0.6)",
};

const closeButtonStyle: CSSProperties = {
  position: "absolute",
  top: 12,
  right: 14,
  background: "transparent",
  border: "none",
  color: PALETTE.uiTextDim,
  fontSize: 20,
  cursor: "pointer",
};

const titleStyle: CSSProperties = {
  fontFamily: "Georgia, 'Times New Roman', serif",
  fontSize: 20,
  fontWeight: 700,
  letterSpacing: 2,
  color: PALETTE.uiAccentBright,
  marginBottom: 14,
};

const tabRowStyle: CSSProperties = {
  display: "flex",
  gap: 8,
  marginBottom: 16,
};

const tabButtonStyle: CSSProperties = {
  padding: "7px 14px",
  borderRadius: 6,
  border: "1px solid",
  fontWeight: 700,
  fontSize: 11,
  letterSpacing: 0.6,
  cursor: "pointer",
};

const gridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))",
  gap: 10,
};

const categoryFilterRowStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 6,
  marginBottom: 10,
};

const categoryChipStyle: CSSProperties = {
  padding: "5px 11px",
  borderRadius: 999,
  border: "1px solid",
  fontWeight: 700,
  fontSize: 10,
  letterSpacing: 0.4,
  textTransform: "uppercase",
  cursor: "pointer",
};

const tileStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: 6,
  padding: "14px 10px 10px",
  borderRadius: 10,
  border: "1px solid",
  background: "rgba(0,0,0,0.25)",
  textAlign: "center",
  cursor: "pointer",
  transition: "transform 140ms ease, box-shadow 140ms ease",
};

const tileNameStyle: CSSProperties = {
  fontSize: 11.5,
  fontWeight: 700,
  color: PALETTE.uiText,
  textAlign: "center",
};

const emptyStyle: CSSProperties = {
  fontSize: 12.5,
  color: PALETTE.uiTextDim,
  fontStyle: "italic",
  padding: "20px 0",
  textAlign: "center",
};

const capacityRowStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  fontSize: 11,
  color: PALETTE.uiTextDim,
  marginBottom: 10,
};

const convertBoxStyle: CSSProperties = {
  border: `1px solid #c88aff55`,
  borderRadius: 8,
  padding: "8px 10px",
  marginBottom: 10,
  display: "flex",
  flexDirection: "column",
  gap: 3,
};

const convertRowStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  fontSize: 10.5,
  color: PALETTE.uiTextDim,
};

const convertButtonStyle: CSSProperties = {
  marginTop: 4,
  padding: "5px 10px",
  borderRadius: 6,
  border: `1px solid #c88aff`,
  background: "rgba(200,138,255,0.12)",
  color: "#e8d4ff",
  fontWeight: 700,
  fontSize: 10.5,
  width: "100%",
};

const overflowTitleStyle: CSSProperties = {
  fontSize: 11,
  letterSpacing: 1,
  textTransform: "uppercase",
  fontWeight: 700,
  color: PALETTE.danger,
  marginTop: 16,
  marginBottom: 3,
};

const overflowHintStyle: CSSProperties = {
  fontSize: 10.5,
  color: PALETTE.uiTextDim,
  marginBottom: 10,
  lineHeight: 1.4,
};

const claimLabelStyle: CSSProperties = {
  fontSize: 9.5,
  fontWeight: 700,
  color: PALETTE.uiAccent,
  letterSpacing: 0.4,
};

const tileContentButtonStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: 8,
  width: "100%",
  padding: "4px 10px 10px",
  border: "none",
  background: "transparent",
  color: "inherit",
  textAlign: "center",
  cursor: "pointer",
};

const fusionCheckboxStyle: CSSProperties = {
  position: "absolute",
  top: 5,
  right: 5,
  width: 16,
  height: 16,
  borderRadius: 4,
  border: "1.5px solid",
  background: "rgba(0,0,0,0.35)",
  color: PALETTE.uiAccent,
  fontSize: 10,
  fontWeight: 700,
  lineHeight: 1,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
};

const fusionSectionDividerStyle: CSSProperties = {
  height: 1,
  background: PALETTE.uiPanelBorder,
  margin: "16px 0 10px",
};

const fusionHintStyle: CSSProperties = {
  fontSize: 10.5,
  color: PALETTE.uiTextDim,
  marginBottom: 8,
  lineHeight: 1.4,
};

const fusionSelectedRowStyle: CSSProperties = {
  display: "flex",
  gap: 8,
};

const fusionSlotEmptyStyle: CSSProperties = {
  flex: 1,
  padding: "8px 6px",
  borderRadius: 7,
  border: `1px dashed ${PALETTE.uiPanelBorder}`,
  fontSize: 10,
  color: PALETTE.uiTextDim,
  fontStyle: "italic",
  textAlign: "center",
};

const fusionSlotFilledStyle: CSSProperties = {
  flex: 1,
  padding: "8px 6px",
  borderRadius: 7,
  border: "1px solid",
  background: "rgba(255,255,255,0.04)",
  color: PALETTE.uiText,
  fontSize: 10,
  fontWeight: 700,
  cursor: "pointer",
  textAlign: "center",
};

const fusionCountStyle: CSSProperties = {
  fontSize: 10,
  color: PALETTE.uiTextDim,
  marginTop: 6,
  textAlign: "center",
};

const fusionDetailsBoxStyle: CSSProperties = {
  marginTop: 10,
  padding: "8px 10px",
  borderRadius: 8,
  border: `1px solid ${PALETTE.uiPanelBorder}`,
  background: "rgba(0,0,0,0.15)",
  display: "flex",
  flexDirection: "column",
  gap: 3,
};

const fusionWarningStyle: CSSProperties = {
  marginTop: 4,
  fontSize: 10.5,
  fontWeight: 700,
  color: PALETTE.danger,
};

const fusionBlockedStyle: CSSProperties = {
  fontSize: 10.5,
  color: PALETTE.danger,
  fontStyle: "italic",
};

const fusionConfirmButtonStyle: CSSProperties = {
  marginTop: 8,
  padding: "8px 10px",
  borderRadius: 7,
  border: `1px solid ${PALETTE.uiAccent}`,
  background: "rgba(255,210,87,0.14)",
  color: PALETTE.uiAccentBright,
  fontWeight: 700,
  fontSize: 12,
  letterSpacing: 0.5,
  width: "100%",
  cursor: "pointer",
};

const fusionCancelButtonStyle: CSSProperties = {
  marginTop: 0,
  padding: "7px 10px",
  borderRadius: 7,
  border: `1px dashed ${PALETTE.uiPanelBorder}`,
  background: "rgba(255,255,255,0.02)",
  color: PALETTE.uiText,
  fontWeight: 600,
  fontSize: 10.5,
  letterSpacing: 0.4,
  width: "100%",
  cursor: "pointer",
};

const fusionConfirmBoxStyle: CSSProperties = {
  marginTop: 10,
  padding: "8px 10px",
  borderRadius: 7,
  border: `1px solid ${PALETTE.uiPanelBorder}`,
  background: "rgba(255,255,255,0.03)",
};

const fusionOutcomeBoxStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 8,
  marginBottom: 8,
  padding: "8px 10px",
  borderRadius: 7,
  border: "1px solid",
  background: "rgba(0,0,0,0.2)",
  fontSize: 11,
  color: PALETTE.uiText,
};

const fusionDismissButtonStyle: CSSProperties = {
  background: "transparent",
  border: "none",
  color: PALETTE.uiTextDim,
  fontSize: 14,
  cursor: "pointer",
  flexShrink: 0,
};
