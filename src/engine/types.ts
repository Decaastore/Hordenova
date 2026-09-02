/**
 * Core Gameplay + Progression + Active Idle state machine.
 *
 * PRE_RUN       — engine constructed, resume()/startRun() not yet called.
 * OFFLINE_RETURN — a "while you were away" offline-defense summary is
 *                  waiting to be dismissed before ticking resumes.
 * RUNNING / WAVE_TRANSITION — normal automatic wave combat (WaveManager).
 * BOSS_INTRO    — brief cinematic pause before a main-boss fight starts.
 * BOSS_BATTLE   — main-boss fight in progress.
 * VICTORY       — main boss just defeated, brief pause before continuing.
 * PROGRESSION_STOPPED — the base fell; the run halts and a diagnostic
 *                  report is shown. This intentionally also covers what the
 *                  spec calls "PLAYER INTERVENTION REQUIRED" — a separate
 *                  state would be a duplicate of the same condition (the
 *                  player must act before the engine ticks again either way).
 *
 * BLESSING/REWARD/UPGRADE from the original spec draft remain out of scope
 * (see config/blessingConfig.ts, config/essenceConfig.ts) — still not wired
 * into this machine on purpose, added alongside the systems that need them.
 */
export type RunPhase =
  | "PRE_RUN"
  | "OFFLINE_RETURN"
  | "RUNNING"
  | "WAVE_TRANSITION"
  | "BOSS_INTRO"
  | "BOSS_BATTLE"
  | "VICTORY"
  | "PROGRESSION_STOPPED";
