/**
 * BALANCEAMENTO DEFINITIVO spec section 6 — Tower Repositioning.
 *
 * "1 change" definition (documented per the task's explicit instruction to
 * pick whatever fits the current architecture and write down the choice):
 * this game has NO free-form tower placement — towers only ever occupy one
 * of the map's fixed TOWER_SLOTS positions (see data/mapWhisperingWoods.ts;
 * historical fix "FIX-5" deliberately rejected manual/arbitrary placement
 * in favor of this structural min-spacing rule, and that rule is preserved
 * here unchanged). So "repositioning" can only ever mean: move ONE already-
 * placed tower to a DIFFERENT fixed slot. If that destination slot is
 * empty, it's a move; if it already holds another tower, the two towers
 * SWAP slots atomically as part of the SAME action. Either way, exactly one
 * player-initiated action (pick a tower, pick a destination slot) = exactly
 * ONE "change" for the free-per-day / 200-Gems-after accounting below —
 * never counted per-tower-moved (a swap moving 2 towers is still 1 change).
 */
export const FREE_REPOSITIONS_PER_DAY = 1;

/** Gems cost for every repositioning beyond the day's free one. Matches the task's own reference point (200 Gems ~= R$10 at 1000 Gems = R$49.90) — no separate price, no token, no parallel currency. */
export const REPOSITION_GEM_COST = 200;
