/**
 * PRE_RUN, RUNNING and WAVE_TRANSITION and DEFEAT are the only phases this
 * phase of the project drives. The spec's full state list (BLESSING, BOSS,
 * REWARD, UPGRADE, READY_FOR_NEXT_RUN) will be added alongside the systems
 * that need them (Blessings, Boss, Essence) — adding unused states now
 * would just be dead branches nothing transitions into or out of.
 */
export type RunPhase = "PRE_RUN" | "RUNNING" | "WAVE_TRANSITION" | "DEFEAT";
