import type { RewardBundle } from "./rewardBundle";

/**
 * LOGIN DE 7 DIAS — one reward per day you open the game (UTC day). Missing
 * a day never resets anything: the next login simply pays the next day.
 * After day 7 the week starts again.
 */
export const LOGIN_REWARDS: readonly RewardBundle[] = [
  { shards: 3 },
  { gold: 500 },
  { splinters: 20 },
  { rare: 3 },
  { shards: 5, gold: 1000 },
  { epic: 1 },
  { freeGems: 2, splinters: 40 },
];

export interface DailyLoginState {
  /** UTC day of the last claim (-1 = never). */
  lastDay: number;
  /** 0..6 — the next day to be paid. */
  step: number;
}

export function createDailyLogin(): DailyLoginState {
  return { lastDay: -1, step: 0 };
}

export function sanitizeDailyLogin(raw: unknown): DailyLoginState {
  if (!raw || typeof raw !== "object") return createDailyLogin();
  const r = raw as Record<string, unknown>;
  const lastDay = typeof r.lastDay === "number" && Number.isFinite(r.lastDay) ? Math.floor(r.lastDay) : -1;
  const step = typeof r.step === "number" && Number.isFinite(r.step) ? Math.max(0, Math.min(6, Math.floor(r.step))) : 0;
  return { lastDay, step };
}

export const loginDay = (nowMs: number) => Math.floor(nowMs / 86_400_000);

export function canClaimLogin(s: DailyLoginState, nowMs: number): boolean {
  return s.lastDay !== loginDay(nowMs);
}

/** Claims today's reward. null if already claimed today. */
export function claimLogin(s: DailyLoginState, nowMs: number): { state: DailyLoginState; reward: RewardBundle; day: number } | null {
  if (!canClaimLogin(s, nowMs)) return null;
  const reward = LOGIN_REWARDS[s.step]!;
  return { state: { lastDay: loginDay(nowMs), step: (s.step + 1) % LOGIN_REWARDS.length }, reward, day: s.step + 1 };
}
