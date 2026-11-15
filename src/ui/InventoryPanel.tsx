import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { PALETTE } from "@/rendering/theme";
import { useLanguage } from "@/i18n/LanguageContext";
import type { TranslationKey } from "@/i18n/translate";
import { getItemDefinition, type ItemCategory } from "@/config/itemDefinitions";
import { RARITIES, getRarityDefinition, type Rarity } from "@/config/rarity";
import { FUSION_ITEM_COUNT, getFusionSuccessChance, getNextRarity } from "@/config/itemFusion";
import { itemRollQuality } from "@/config/itemRolls";
import type { TowerType } from "@/config/towerStats";
import type { ItemInstance } from "@/entities/Item";
import type { FusionEligibility, FusionOutcome } from "@/engine/ItemFusion";
import { RarityBadge } from "./RarityBadge";
import { ItemDetailsBody, ItemDetailsModal } from "./ItemDetailsModal";
import { TradeScreen } from "./TradeScreen";
import { EconomyStatsPanel } from "./EconomyStatsPanel";
import { GameEngine } from "@/engine/GameEngine";
import { ItemGlyph } from "./ItemGlyph";
import type { GemCurrency } from "@/config/gemsEconomy";

/**
 * INVENTÁRIO — one wide panel instead of the old narrow scroll.
 *
 *  ┌ title · slot meter · shards → gems ─────────────── × ┐
 *  │ Items | Trade | Stats                                 │
 *  │ ┌ filters · sort · [Fuse items] ┐ ┌ details / fusion ┐│
 *  │ │ grid of slots (empty ones too) │ │ side panel       ││
 *  │ └───────────────────────────────┘ └──────────────────┘│
 *
 * Desktop shows the picked item's details in the side panel; on a phone the
 * panel fills the screen and the details open as a pop-up instead. Fusion is
 * a mode: while it's on, tapping a tile picks it for the fusion and the side
 * panel (a bottom tray on phones) becomes the fusion bench. Every rule about
 * what can be fused still comes from getFusionEligibility — the UI only
 * dims what obviously can't join the current pick.
 *
 * Pure UI overlay: nothing here touches the running wave.
 */

/** Fixed display order for the category filter row; a chip only shows when the player owns an item in it. */
const CATEGORY_DISPLAY_ORDER: readonly ItemCategory[] = ["AMULET", "MATERIAL", "RELIC", "RUNE", "ARTIFACT", "COSMETIC"];

type Tab = "items" | "trade" | "stats";
type SortMode = "rarity" | "newest";
const SORT_KEY = "hordenova.inventory.sort";

function readSort(): SortMode {
  try {
    return window.localStorage.getItem(SORT_KEY) === "newest" ? "newest" : "rarity";
  } catch {
    return "rarity";
  }
}

function writeSort(mode: SortMode): void {
  try {
    window.localStorage.setItem(SORT_KEY, mode);
  } catch {
    /* private mode — the choice just isn't remembered */
  }
}

/** True on phone-width screens, where the side panel turns into pop-ups and trays. */
function useNarrow(maxWidth = 760): boolean {
  const query = `(max-width: ${maxWidth}px)`;
  const read = () => (typeof window !== "undefined" && typeof window.matchMedia === "function" ? window.matchMedia(query).matches : false);
  const [narrow, setNarrow] = useState(read);
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia(query);
    const on = () => setNarrow(mq.matches);
    mq.addEventListener?.("change", on);
    return () => mq.removeEventListener?.("change", on);
  }, [query]);
  return narrow;
}

function rarityOf(item: ItemInstance): Rarity | null {
  return getItemDefinition(item.itemDefinitionId)?.rarity ?? null;
}

function rarityRank(item: ItemInstance): number {
  const r = rarityOf(item);
  return r ? RARITIES.indexOf(r) : -1;
}

/** Can this copy go into a fusion at all right now (UI hint only — the engine re-checks)? */
function fusable(item: ItemInstance): boolean {
  const r = rarityOf(item);
  return !!r && !!getNextRarity(r) && !item.pendingTrade && !item.pendingAuction;
}

const CSS = `
.inv-overlay{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(10,7,4,.82);z-index:30}
.inv-card{position:relative;display:flex;flex-direction:column;width:min(980px,calc(100% - 32px));height:min(720px,calc(100% - 32px));border-radius:14px;border:1px solid ${PALETTE.uiPanelBorder};background:linear-gradient(160deg,rgba(54,36,22,.985),rgba(26,17,10,.995));color:${PALETTE.uiText};box-shadow:0 20px 60px rgba(0,0,0,.6);overflow:hidden}
.inv-head{display:flex;align-items:center;gap:18px;padding:18px 22px 0;flex-wrap:wrap}
.inv-title{font-family:Georgia,'Times New Roman',serif;font-size:22px;font-weight:700;letter-spacing:1px;color:${PALETTE.uiAccentBright}}
.inv-meter{display:flex;flex-direction:column;gap:4px;min-width:150px}
.inv-meter-txt{font-size:11.5px;color:${PALETTE.uiTextDim}}
.inv-meter-track{height:5px;border-radius:3px;background:rgba(255,255,255,.1);overflow:hidden}
.inv-meter-fill{height:100%;border-radius:3px}
.inv-shards{margin-left:auto;margin-right:34px;display:flex;align-items:center;gap:10px;padding:6px 8px 6px 12px;border-radius:9px;border:1px solid ${PALETTE.gem}55;background:rgba(200,138,255,.07)}
.inv-shards-txt{font-size:12px;font-weight:700;color:#e8d4ff;white-space:nowrap}
.inv-shards-btn{padding:6px 11px;border-radius:7px;border:1px solid ${PALETTE.gem};background:rgba(200,138,255,.16);color:#f1e4ff;font-weight:700;font-size:11.5px;cursor:pointer;white-space:nowrap}
.inv-shards-btn:disabled{opacity:.5;cursor:not-allowed}
.inv-close{position:absolute;top:12px;right:14px;width:32px;height:32px;border-radius:8px;background:transparent;border:none;color:${PALETTE.uiTextDim};font-size:22px;cursor:pointer;z-index:2}
.inv-close:hover{color:${PALETTE.uiAccentBright}}
.inv-tabs{display:flex;gap:4px;padding:12px 22px 0;border-bottom:1px solid ${PALETTE.uiPanelBorder}66}
.inv-tab{padding:8px 14px;background:none;border:none;border-bottom:2px solid transparent;margin-bottom:-1px;color:${PALETTE.uiTextDim};font-weight:700;font-size:12.5px;cursor:pointer}
.inv-tab[aria-selected=true]{color:${PALETTE.uiAccentBright};border-bottom-color:${PALETTE.uiAccent}}
.inv-body{flex:1;min-height:0;display:grid;grid-template-columns:minmax(0,1fr) 320px}
.inv-body.solo{display:block;overflow-y:auto;padding:16px 22px}
.inv-main{min-height:0;overflow-y:auto;padding:14px 18px 18px 22px}
.inv-aside{min-height:0;overflow-y:auto;padding:16px 20px;border-left:1px solid ${PALETTE.uiPanelBorder}55;background:rgba(0,0,0,.18)}
.inv-tools{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:12px}
.inv-chip{padding:5px 11px;border-radius:999px;border:1px solid ${PALETTE.uiPanelBorder};background:transparent;color:${PALETTE.uiTextDim};font-weight:700;font-size:11px;cursor:pointer}
.inv-chip[aria-pressed=true]{border-color:${PALETTE.uiAccent};color:${PALETTE.uiAccentBright};background:rgba(255,210,87,.14)}
.inv-sort{margin-left:auto;display:flex;align-items:center;gap:6px;font-size:11px;color:${PALETTE.uiTextDim}}
.inv-sort select{background:rgba(0,0,0,.35);color:${PALETTE.uiText};border:1px solid ${PALETTE.uiPanelBorder};border-radius:6px;padding:4px 6px;font-size:11.5px}
.inv-fuse-toggle{padding:6px 12px;border-radius:7px;border:1px solid ${PALETTE.uiAccent};background:rgba(255,210,87,.1);color:${PALETTE.uiAccentBright};font-weight:700;font-size:11.5px;cursor:pointer}
.inv-fuse-toggle[aria-pressed=true]{background:${PALETTE.uiAccent};color:#2a1a08}
.inv-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(96px,1fr));gap:9px}
.hordenova-item-tile{position:relative;display:flex;flex-direction:column;align-items:center;justify-content:flex-start;gap:7px;aspect-ratio:1/1.12;padding:12px 6px 10px;border-radius:10px;border:1px solid;background:rgba(0,0,0,.28);color:inherit;cursor:pointer;text-align:center;transition:transform 140ms ease,box-shadow 140ms ease,opacity 140ms ease;font:inherit}
.hordenova-item-tile:hover:not(:disabled){transform:translateY(-2px)}
.hordenova-item-tile:focus-visible{outline:2px solid ${PALETTE.uiAccentBright};outline-offset:2px}
.hordenova-item-tile:disabled{cursor:default;opacity:.32}
.hordenova-item-tile[aria-pressed=true]{outline:2px solid ${PALETTE.uiAccent};outline-offset:1px}
.inv-tile-name{font-size:11px;font-weight:700;line-height:1.25;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.inv-tile-strip{position:absolute;left:10px;right:10px;bottom:5px;height:3px;border-radius:2px}
.inv-tile-eq{position:absolute;top:5px;left:6px;font-size:9px;font-weight:800;letter-spacing:.3px;padding:1px 5px;border-radius:4px;background:${PALETTE.success}2a;color:${PALETTE.success};border:1px solid ${PALETTE.success}77}
.inv-tile-check{position:absolute;top:5px;right:6px;width:18px;height:18px;border-radius:5px;background:${PALETTE.uiAccent};color:#2a1a08;font-size:12px;font-weight:800;display:flex;align-items:center;justify-content:center}
.inv-slot-empty{aspect-ratio:1/1.12;border-radius:10px;border:1px dashed ${PALETTE.uiPanelBorder}44;background:rgba(0,0,0,.12)}
.inv-empty{font-size:13px;color:${PALETTE.uiTextDim};font-style:italic;padding:30px 0;text-align:center}
.inv-sec{font-family:Georgia,'Times New Roman',serif;font-size:15px;font-weight:700;color:${PALETTE.uiAccentBright};margin:18px 0 4px}
.inv-hint{font-size:11.5px;color:${PALETTE.uiTextDim};line-height:1.45;margin-bottom:10px}
.inv-claim{font-size:10px;font-weight:700;color:${PALETTE.uiAccent}}
.inv-pick-hint{font-size:12.5px;color:${PALETTE.uiTextDim};text-align:center;margin-top:40%}
.inv-quick{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px}
.inv-quick button{padding:5px 10px;border-radius:7px;border:1px solid;background:rgba(0,0,0,.25);font-weight:700;font-size:11px;cursor:pointer}
.inv-bench{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
.inv-bench-slot{aspect-ratio:1/1;border-radius:10px;border:1px dashed ${PALETTE.uiPanelBorder}88;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.2);padding:0;color:inherit;cursor:pointer}
.inv-bench-slot:disabled{cursor:default}
.inv-count{font-size:11px;color:${PALETTE.uiTextDim};text-align:center;margin:8px 0 2px}
.inv-row{display:flex;justify-content:space-between;align-items:center;font-size:11.5px;color:${PALETTE.uiTextDim};padding:3px 0}
.inv-box{margin-top:10px;padding:9px 11px;border-radius:9px;border:1px solid ${PALETTE.uiPanelBorder}88;background:rgba(0,0,0,.18)}
.inv-warn{margin-top:6px;font-size:11.5px;font-weight:700;color:${PALETTE.danger};line-height:1.4}
.inv-blocked{font-size:11.5px;color:${PALETTE.danger};font-style:italic}
.inv-btn{margin-top:10px;width:100%;padding:10px;border-radius:8px;border:1px solid ${PALETTE.uiAccent};background:rgba(255,210,87,.16);color:${PALETTE.uiAccentBright};font-weight:700;font-size:12.5px;letter-spacing:.4px;cursor:pointer}
.inv-btn:disabled{opacity:.45;cursor:not-allowed}
.inv-btn.ghost{border-style:dashed;border-color:${PALETTE.uiPanelBorder};background:rgba(255,255,255,.02);color:${PALETTE.uiText};font-weight:600;margin-top:6px}
.inv-btn.danger{border-color:${PALETTE.danger};background:rgba(220,70,50,.18);color:#ffd9d2}
.inv-outcome{display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:10px;padding:9px 11px;border-radius:8px;border:1px solid;background:rgba(0,0,0,.25);font-size:12px}
.inv-outcome button{background:transparent;border:none;color:${PALETTE.uiTextDim};font-size:15px;cursor:pointer}
@media (max-width:760px){
  .inv-overlay{position:fixed;z-index:65;background:rgba(10,7,4,.96)}
  .inv-card{width:100%;height:100%;border-radius:0;border:none}
  .inv-head{padding:14px 16px 0;gap:12px}
  .inv-title{font-size:19px}
  .inv-meter{min-width:110px}
  .inv-shards{margin:0;width:100%;justify-content:space-between}
  .inv-tabs{padding:8px 12px 0}
  .inv-body{display:block;position:relative;overflow:hidden}
  .inv-main{height:100%;padding:12px 14px 16px}
  .inv-main.with-tray{padding-bottom:52vh}
  .inv-body.solo{padding:12px 14px}
  .inv-aside{display:none}
  .inv-aside.tray{display:block;position:absolute;left:0;right:0;bottom:0;max-height:48%;border-left:none;border-top:1px solid ${PALETTE.uiPanelBorder};background:linear-gradient(180deg,rgba(44,29,17,.99),rgba(26,17,10,.995));box-shadow:0 -12px 30px rgba(0,0,0,.5);padding:12px 14px}
  .inv-grid{grid-template-columns:repeat(auto-fill,minmax(74px,1fr));gap:7px}
  .inv-bench{grid-template-columns:repeat(3,minmax(0,80px));justify-content:center}
  .inv-sort{margin-left:0}
  .hordenova-item-tile{padding:9px 4px 8px;gap:5px}
  .inv-tile-name{font-size:10px}
}
@media (prefers-reduced-motion:reduce){.hordenova-item-tile{transition:none}.hordenova-item-tile:hover:not(:disabled){transform:none}}
`;

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
  freeGems: number;
  purchasedGems: number;
  prestigeLevel: number;
  /** The account's all-time record wave — gates whether Prestige is unlocked at all. */
  bestWave: number;
  onUpgradePrestige: (currency: GemCurrency) => void;
  /** Read-only pre-check for the fusion button. onAttemptFusion re-validates on its own; the UI's read is never trusted for the spend. */
  getFusionEligibility: (selectedInstanceIds: string[]) => FusionEligibility;
  /** The atomic fusion attempt — consumes the 3 picked items and, on success only, creates 1 better item. */
  onAttemptFusion: (selectedInstanceIds: string[]) => FusionOutcome;
  /** Re-rolls an item's values for Gem Shards (config/itemRolls.ts). */
  onRerollItem?: (instanceId: string) => number[] | null;
  /** instanceId -> the tower type wearing it (GameEngine.getEquippedItemTowers). Omitted = equipped state unknown. */
  equippedTowers?: Readonly<Record<string, TowerType>>;
}

export function InventoryPanel({
  inventory,
  localEconomyTotals,
  onClose,
  inventoryCapacity,
  overflowInventory,
  onClaimOverflowItem,
  gemShards,
  onConvertGemShards,
  freeGems,
  purchasedGems,
  prestigeLevel,
  bestWave,
  onUpgradePrestige,
  getFusionEligibility,
  onAttemptFusion,
  onRerollItem,
  equippedTowers,
}: InventoryPanelProps) {
  const { t } = useLanguage();
  const narrow = useNarrow();
  const [tab, setTab] = useState<Tab>("items");
  const [selectedInstanceId, setSelectedInstanceId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<ItemCategory | "ALL">("ALL");
  const [sort, setSort] = useState<SortMode>(readSort);
  const [fusionMode, setFusionMode] = useState(false);
  // Fusion picks are UI state only — nothing is spent until the final confirm.
  // Any id that stops existing in `inventory` (consumed, traded) drops out.
  const [fusionSelectedIds, setFusionSelectedIds] = useState<string[]>([]);
  const [fusionConfirming, setFusionConfirming] = useState(false);
  const [fusionOutcome, setFusionOutcome] = useState<FusionOutcome | null>(null);

  useEffect(() => {
    setFusionSelectedIds((prev) => prev.filter((id) => inventory.some((item) => item.instanceId === id)));
  }, [inventory]);

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (detailOpen) setDetailOpen(false);
      else onClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose, detailOpen]);

  const towerName = (id: string): string | null | undefined => {
    if (!equippedTowers) return undefined;
    const type = equippedTowers[id];
    return type ? t(`towers.${type}.name` as TranslationKey) : null;
  };

  const availableCategories = useMemo(() => {
    const present = new Set<ItemCategory>();
    for (const item of inventory) {
      const def = getItemDefinition(item.itemDefinitionId);
      if (def) present.add(def.category);
    }
    return CATEGORY_DISPLAY_ORDER.filter((c) => present.has(c));
  }, [inventory]);

  const shownItems = useMemo(() => {
    const list = categoryFilter === "ALL" ? [...inventory] : inventory.filter((item) => getItemDefinition(item.itemDefinitionId)?.category === categoryFilter);
    if (sort === "newest") list.sort((a, b) => b.acquiredAt - a.acquiredAt);
    else list.sort((a, b) => rarityRank(b) - rarityRank(a) || a.itemDefinitionId.localeCompare(b.itemDefinitionId) || b.acquiredAt - a.acquiredAt);
    return list;
  }, [inventory, categoryFilter, sort]);

  // Desktop: with nothing picked yet, the side panel shows the first tile.
  const selectedItem =
    (selectedInstanceId ? inventory.find((i) => i.instanceId === selectedInstanceId) : undefined) ?? (narrow ? null : shownItems[0] ?? null);

  const fusionRarity: Rarity | null = fusionSelectedIds.length > 0 ? rarityOf(inventory.find((i) => i.instanceId === fusionSelectedIds[0]) ?? inventory[0]!) : null;

  const toggleFusionPick = (instanceId: string) => {
    setFusionOutcome(null);
    setFusionConfirming(false);
    setFusionSelectedIds((prev) => {
      if (prev.includes(instanceId)) return prev.filter((id) => id !== instanceId);
      if (prev.length >= FUSION_ITEM_COUNT) return prev; // a 4th pick is ignored
      return [...prev, instanceId];
    });
  };

  const onTile = (item: ItemInstance) => {
    if (fusionMode) {
      toggleFusionPick(item.instanceId);
      return;
    }
    setSelectedInstanceId(item.instanceId);
    if (narrow) setDetailOpen(true);
  };

  const setFusion = (on: boolean) => {
    setFusionMode(on);
    setFusionConfirming(false);
    if (!on) {
      setFusionSelectedIds([]);
      setFusionOutcome(null);
    }
  };

  const used = inventory.length;
  const fillPct = Math.min(100, inventoryCapacity > 0 ? (used / inventoryCapacity) * 100 : 0);
  const meterColor = used >= inventoryCapacity ? PALETTE.danger : fillPct >= 80 ? "#ffb347" : PALETTE.uiAccent;
  const rate = GameEngine.GEM_SHARD_TO_GEM_RATE;
  const canConvert = GameEngine.canConvertGemShards(gemShards);
  const emptySlots = categoryFilter === "ALL" ? Math.max(0, inventoryCapacity - inventory.length) : 0;
  const showAside = !narrow || fusionMode;

  const panel = (
    <div className="inv-overlay" onClick={onClose}>
      <style>{CSS}</style>
      <div className="inv-card" role="dialog" aria-modal="true" aria-label={t("inventory.title")} onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} className="inv-close" aria-label={t("inventory.close")}>
          ×
        </button>
        <div className="inv-head">
          <div className="inv-title">{t("inventory.title")}</div>
          <div className="inv-meter" data-testid="inventory-capacity">
            <span className="inv-meter-txt">{t("inventory.capacity", { used, capacity: inventoryCapacity })}</span>
            <div className="inv-meter-track">
              <div className="inv-meter-fill" style={{ width: `${fillPct}%`, background: meterColor }} />
            </div>
          </div>
          {gemShards > 0 && (
            // GameEngine.canConvertGemShards is the one rule both this button and convertGemShards() read.
            <div className="inv-shards" title={t("inventory.convertNeed", { rate })}>
              <span className="inv-shards-txt">{t("inventory.shardsLine", { count: gemShards })}</span>
              <button className="inv-shards-btn" onClick={onConvertGemShards} disabled={!canConvert} data-testid="inventory-convert">
                {canConvert ? t("inventory.convertShort", { gems: Math.floor(gemShards / rate) }) : t("inventory.convertNeed", { rate })}
              </button>
            </div>
          )}
        </div>

        <div className="inv-tabs" role="tablist">
          {(["items", "trade", "stats"] as const).map((id) => (
            <button key={id} role="tab" aria-selected={tab === id} className="inv-tab" onClick={() => setTab(id)}>
              {t(`inventory.tabs.${id}` as TranslationKey)}
            </button>
          ))}
        </div>

        {tab === "items" && (
          <div className="inv-body">
            <div className={`inv-main${narrow && fusionMode ? " with-tray" : ""}`}>
              <div className="inv-tools">
                {availableCategories.length > 1 && (
                  <>
                    <button className="inv-chip" aria-pressed={categoryFilter === "ALL"} onClick={() => setCategoryFilter("ALL")}>
                      {t("inventory.categoryAll")}
                    </button>
                    {availableCategories.map((category) => (
                      <button key={category} className="inv-chip" aria-pressed={categoryFilter === category} onClick={() => setCategoryFilter(category)}>
                        {t(`itemCategory.${category}` as TranslationKey)}
                      </button>
                    ))}
                  </>
                )}
                {inventory.length > 1 && (
                  <label className="inv-sort">
                    {t("inventory.sortLabel")}
                    <select
                      value={sort}
                      onChange={(e) => {
                        const next = e.target.value === "newest" ? "newest" : "rarity";
                        setSort(next);
                        writeSort(next);
                      }}
                    >
                      <option value="rarity">{t("inventory.sortRarity")}</option>
                      <option value="newest">{t("inventory.sortNewest")}</option>
                    </select>
                  </label>
                )}
                {inventory.length > 0 && (
                  <button className="inv-fuse-toggle" aria-pressed={fusionMode} onClick={() => setFusion(!fusionMode)} data-testid="inventory-fusion-toggle">
                    {fusionMode ? t("inventory.fusion.exitMode") : t("inventory.fusion.mode")}
                  </button>
                )}
              </div>

              {inventory.length === 0 ? (
                <div className="inv-empty">{t("inventory.empty")}</div>
              ) : shownItems.length === 0 ? (
                <div className="inv-empty">{t("inventory.noItemsInCategory")}</div>
              ) : (
                <div className="inv-grid">
                  {shownItems.map((item) => {
                    const picked = fusionSelectedIds.includes(item.instanceId);
                    const blocked = fusionMode && !picked && (!fusable(item) || (fusionRarity !== null && rarityOf(item) !== fusionRarity) || fusionSelectedIds.length >= FUSION_ITEM_COUNT);
                    return (
                      <ItemTile
                        key={item.instanceId}
                        item={item}
                        equipped={!!equippedTowers?.[item.instanceId]}
                        current={!fusionMode && selectedItem?.instanceId === item.instanceId && !narrow}
                        picked={picked}
                        fusionMode={fusionMode}
                        disabled={blocked}
                        onClick={() => onTile(item)}
                      />
                    );
                  })}
                  {Array.from({ length: emptySlots }, (_, i) => (
                    <div key={`empty-${i}`} className="inv-slot-empty" aria-hidden="true" />
                  ))}
                </div>
              )}

              {overflowInventory.length > 0 && (
                <>
                  <div className="inv-sec" style={{ color: PALETTE.danger }}>
                    {t("inventory.overflowTitle")}
                  </div>
                  <div className="inv-hint">{t("inventory.overflowHint")}</div>
                  <div className="inv-grid">
                    {overflowInventory.map((item) => (
                      <OverflowItemTile key={item.instanceId} item={item} onClaim={() => onClaimOverflowItem(item.instanceId)} />
                    ))}
                  </div>
                </>
              )}
            </div>

            {showAside && (
              <aside className={`inv-aside${narrow ? " tray" : ""}`}>
                {fusionMode ? (
                  <FusionBench
                    inventory={inventory}
                    selectedIds={fusionSelectedIds}
                    onDeselect={(id) => setFusionSelectedIds((prev) => prev.filter((x) => x !== id))}
                    onQuickPick={(ids) => {
                      setFusionOutcome(null);
                      setFusionConfirming(false);
                      setFusionSelectedIds(ids);
                    }}
                    equippedTowers={equippedTowers}
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
                ) : selectedItem ? (
                  <ItemDetailsBody key={selectedItem.instanceId} item={selectedItem} gemShards={gemShards} onReroll={onRerollItem} equippedOn={towerName(selectedItem.instanceId)} />
                ) : (
                  <div className="inv-pick-hint">{t("inventory.pickHint")}</div>
                )}
              </aside>
            )}
          </div>
        )}

        {tab === "trade" && (
          <div className="inv-body solo">
            <TradeScreen />
          </div>
        )}

        {tab === "stats" && (
          <div className="inv-body solo">
            <EconomyStatsPanel
              summary={{
                bossesDefeatedTotal: localEconomyTotals.bossesDefeatedTotal,
                miniBossesDefeatedTotal: localEconomyTotals.miniBossesDefeatedTotal,
                itemsOwnedTotal: inventory.length,
                itemsFoundTotal: inventory.length,
              }}
              freeGems={freeGems}
              purchasedGems={purchasedGems}
              prestigeLevel={prestigeLevel}
              bestWave={bestWave}
              onUpgradePrestige={onUpgradePrestige}
            />
          </div>
        )}
      </div>

      {narrow && detailOpen && selectedItem && (
        <ItemDetailsModal
          item={selectedItem}
          onClose={() => setDetailOpen(false)}
          gemShards={gemShards}
          onReroll={onRerollItem}
          equippedOn={towerName(selectedItem.instanceId)}
        />
      )}
    </div>
  );
  // On a phone the game stage is a thin strip between the HUD and the tower
  // bar, so the panel is lifted out to cover the whole screen instead.
  return narrow && typeof document !== "undefined" ? createPortal(panel, document.body) : panel;
}

function ItemTile({
  item,
  equipped,
  current,
  picked,
  fusionMode,
  disabled,
  onClick,
}: {
  item: ItemInstance;
  equipped: boolean;
  /** The item shown in the side panel right now. */
  current: boolean;
  /** Picked for the fusion. */
  picked: boolean;
  fusionMode: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  const { t } = useLanguage();
  const def = getItemDefinition(item.itemDefinitionId);
  if (!def) return null;
  const rarityDef = getRarityDefinition(def.rarity);
  const name = t(`items.${def.i18nKey}.name` as TranslationKey);
  const pulse = rarityDef.order >= 3 && !disabled;
  const style: CSSProperties = {
    borderColor: picked || current ? PALETTE.uiAccent : `${rarityDef.color}aa`,
    boxShadow: picked || current ? `0 0 14px ${PALETTE.uiAccent}88` : `inset 0 0 18px ${rarityDef.glow}`,
    background: `linear-gradient(180deg, ${rarityDef.color}14, rgba(0,0,0,0.3) 70%)`,
    ...(pulse && !picked && !current ? ({ animation: "hn-inv-pulse 2.4s ease-in-out infinite", "--pulse": rarityDef.glow } as CSSProperties) : {}),
  };
  return (
    <button
      className="hordenova-item-tile"
      style={style}
      onClick={onClick}
      disabled={disabled}
      aria-pressed={fusionMode ? picked : current}
      title={fusionMode ? t(picked ? "inventory.fusion.deselectItem" : "inventory.fusion.selectItem") : name}
      data-rarity={def.rarity}
    >
      <style>{"@keyframes hn-inv-pulse{0%,100%{box-shadow:inset 0 0 14px var(--pulse)}50%{box-shadow:inset 0 0 26px var(--pulse),0 0 10px var(--pulse)}}@media (prefers-reduced-motion:reduce){.hordenova-item-tile{animation:none!important}}"}</style>
      {equipped && <span className="inv-tile-eq">{t("inventory.equippedBadge")}</span>}
      {picked && <span className="inv-tile-check">✓</span>}
      <ItemGlyph itemDefinitionId={def.id} size={46} />
      <span className="inv-tile-name">{name}</span>
      <span className="inv-tile-strip" style={{ background: rarityDef.color }} aria-label={t(`rarity.${def.rarity}` as TranslationKey)} />
    </button>
  );
}

function OverflowItemTile({ item, onClaim }: { item: ItemInstance; onClaim: () => void }) {
  const { t } = useLanguage();
  const def = getItemDefinition(item.itemDefinitionId);
  if (!def) return null;
  const rarityDef = getRarityDefinition(def.rarity);
  return (
    <button className="hordenova-item-tile" onClick={onClaim} style={{ borderColor: rarityDef.color, opacity: 0.85 }}>
      <ItemGlyph itemDefinitionId={def.id} size={40} />
      <span className="inv-tile-name">{t(`items.${def.i18nKey}.name` as TranslationKey)}</span>
      <span className="inv-claim">{t("inventory.claim")}</span>
    </button>
  );
}

/**
 * The fusion bench: quick picks, the 3 slots, the odds and the two-step
 * confirm. Eligibility and the odds are read from the engine every render.
 */
function FusionBench({
  inventory,
  selectedIds,
  onDeselect,
  onQuickPick,
  equippedTowers,
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
  onQuickPick: (ids: string[]) => void;
  equippedTowers?: Readonly<Record<string, TowerType>>;
  getFusionEligibility: (selectedInstanceIds: string[]) => FusionEligibility;
  confirming: boolean;
  onRequestConfirm: () => void;
  onCancelConfirm: () => void;
  onConfirm: () => void;
  outcome: FusionOutcome | null;
  onDismissOutcome: () => void;
}) {
  const { t } = useLanguage();
  const selectedItems = selectedIds.map((id) => inventory.find((item) => item.instanceId === id)).filter((item): item is ItemInstance => !!item);
  const ready = selectedIds.length === FUSION_ITEM_COUNT;
  const eligibility = ready ? getFusionEligibility([...selectedIds]) : null;
  const canConfirm = ready && !!eligibility?.ok;

  // Quick picks: per rarity with 3+ fusable copies, the 3 weakest rolls,
  // unequipped ones first — never the best copy the player owns.
  const quick = useMemo(() => {
    const byRarity = new Map<Rarity, ItemInstance[]>();
    for (const item of inventory) {
      const r = rarityOf(item);
      if (!r || !fusable(item)) continue;
      byRarity.set(r, [...(byRarity.get(r) ?? []), item]);
    }
    return RARITIES.filter((r) => (byRarity.get(r)?.length ?? 0) >= FUSION_ITEM_COUNT).map((r) => {
      const pool = [...byRarity.get(r)!].sort(
        (a, b) =>
          Number(!!equippedTowers?.[a.instanceId]) - Number(!!equippedTowers?.[b.instanceId]) ||
          (itemRollQuality(a) ?? 0) - (itemRollQuality(b) ?? 0),
      );
      return { rarity: r, ids: pool.slice(0, FUSION_ITEM_COUNT).map((i) => i.instanceId) };
    });
  }, [inventory, equippedTowers]);

  return (
    <div data-testid="inventory-fusion">
      <div className="inv-sec" style={{ marginTop: 0 }}>
        {t("inventory.fusion.title")}
      </div>
      <div className="inv-hint">{t("inventory.fusion.modeHint")}</div>

      {outcome && outcome.status !== "BLOCKED" && (
        <div className="inv-outcome" style={{ borderColor: outcome.status === "SUCCESS" ? PALETTE.success : PALETTE.danger }}>
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
          <button onClick={onDismissOutcome} aria-label="×">
            ×
          </button>
        </div>
      )}

      {quick.length > 0 ? (
        <>
          <div className="inv-row" style={{ paddingTop: 0 }}>
            {t("inventory.fusion.readyTitle")}
          </div>
          <div className="inv-quick">
            {quick.map((q) => {
              const def = getRarityDefinition(q.rarity);
              return (
                <button key={q.rarity} style={{ borderColor: def.color, color: def.color }} onClick={() => onQuickPick(q.ids)}>
                  {t("inventory.fusion.quickPick", { rarity: t(`rarity.${q.rarity}` as TranslationKey) })}
                </button>
              );
            })}
          </div>
        </>
      ) : (
        <div className="inv-hint">{t("inventory.fusion.nothingReady")}</div>
      )}

      <div className="inv-bench">
        {Array.from({ length: FUSION_ITEM_COUNT }, (_, i) => {
          const item = selectedItems[i];
          if (!item)
            return (
              <button key={i} className="inv-bench-slot" disabled aria-label={t("inventory.fusion.emptySlot")}>
                <span style={{ fontSize: 10.5, color: PALETTE.uiTextDim, fontStyle: "italic" }}>{t("inventory.fusion.emptySlot")}</span>
              </button>
            );
          const def = getItemDefinition(item.itemDefinitionId);
          if (!def) return null;
          return (
            <button
              key={item.instanceId}
              className="inv-bench-slot"
              style={{ borderStyle: "solid", borderColor: getRarityDefinition(def.rarity).color }}
              onClick={() => onDeselect(item.instanceId)}
              title={t("inventory.fusion.deselectItem")}
            >
              <ItemGlyph itemDefinitionId={def.id} size={40} />
            </button>
          );
        })}
      </div>
      <div className="inv-count">{t("inventory.fusion.selectedCount", { count: selectedIds.length })}</div>

      {ready && eligibility && (
        <div className="inv-box">
          {eligibility.ok ? (
            <>
              <div className="inv-row">
                <span>{t("inventory.fusion.currentRarity")}</span>
                <RarityBadge rarity={eligibility.rarity!} />
              </div>
              <div className="inv-row">
                <span>{t("inventory.fusion.targetRarity")}</span>
                <RarityBadge rarity={eligibility.nextRarity!} />
              </div>
              <div className="inv-row">
                <span>{t("inventory.fusion.successChance")}</span>
                <strong style={{ color: PALETTE.uiAccentBright }}>{(getFusionSuccessChance(eligibility.rarity!) * 100).toFixed(2)}%</strong>
              </div>
              <div className="inv-warn">{t("inventory.fusion.warning")}</div>
            </>
          ) : (
            <div className="inv-blocked">{t(fusionBlockedReasonKey(eligibility.reason))}</div>
          )}
        </div>
      )}

      {confirming ? (
        <div className="inv-box">
          <div style={{ fontSize: 11.5, lineHeight: 1.45 }}>
            {t("inventory.fusion.confirmPrompt", {
              rarity: eligibility?.ok ? t(`rarity.${eligibility.rarity}` as TranslationKey) : "",
              chance: eligibility?.ok ? (getFusionSuccessChance(eligibility.rarity!) * 100).toFixed(2) : "0",
            })}
          </div>
          <button onClick={onConfirm} className="inv-btn danger">
            {t("inventory.fusion.confirmYes")}
          </button>
          <button onClick={onCancelConfirm} className="inv-btn ghost">
            {t("inventory.fusion.confirmNo")}
          </button>
        </div>
      ) : (
        <button onClick={onRequestConfirm} disabled={!canConfirm} className="inv-btn">
          {t("inventory.fusion.confirmButton")}
        </button>
      )}
    </div>
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
