/**
 * CONTA ONLINE — pure rules for the cloud save (no network here, so it is
 * unit-tested). The network side lives in ./cloud.ts.
 *
 * The device keeps a small sync record next to the save:
 *   - lastSyncedAt: the cloud row's clientUpdatedAt we last uploaded or
 *     downloaded (0 = this device never synced with that account);
 *   - dirtyAt: when this device last changed its save after that sync.
 * On login we compare that record with the cloud row and decide which side
 * wins. When BOTH changed since the last sync (played offline on two
 * devices), the one with more progress wins and the other is kept as a
 * local backup — progress is never silently thrown away.
 */

export interface CloudSnapshot {
  /** The main save (hordenova.save.v1), raw JSON text. */
  save: string | null;
  /** The Eternal castle (hordenova.eternal.save.v1), raw JSON text. */
  eternal: string | null;
}

export interface CloudRow extends CloudSnapshot {
  /** Device clock (ms) of the upload that produced this row. */
  clientUpdatedAt: number;
}

export interface SyncRecord {
  userId: string;
  lastSyncedAt: number;
  dirtyAt: number;
}

export type SyncDecision = "UPLOAD" | "DOWNLOAD" | "NOTHING";

export interface ProgressScore {
  bestWave: number;
  bosses: number;
  /** A last resort tie-break. */
  size: number;
}

export function progressOf(saveJson: string | null): ProgressScore {
  if (!saveJson) return { bestWave: 0, bosses: 0, size: 0 };
  try {
    const s = JSON.parse(saveJson) as Record<string, unknown>;
    const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
    return { bestWave: num(s.bestWave), bosses: num(s.bossesDefeatedTotal), size: saveJson.length };
  } catch {
    return { bestWave: 0, bosses: 0, size: 0 };
  }
}

/** >0 when a has more progress than b. */
export function compareProgress(a: ProgressScore, b: ProgressScore): number {
  return a.bestWave - b.bestWave || a.bosses - b.bosses || a.size - b.size;
}

/**
 * What to do right after signing in (or on start with a remembered session).
 * `deviceRecord` is this device's sync record (null if it never synced; a
 * record of a different user means the local progress is that other account's).
 */
export function decideSync(userId: string, local: CloudSnapshot, cloud: CloudRow | null, deviceRecord: SyncRecord | null): SyncDecision {
  const localHas = progressOf(local.save).bestWave > 0 || !!local.eternal;
  if (!cloud || !cloud.save) return localHas ? "UPLOAD" : "NOTHING";
  if (!localHas) return "DOWNLOAD";
  // this device's progress belongs to ANOTHER account: never push it into this one
  if (deviceRecord && deviceRecord.userId !== userId) return "DOWNLOAD";
  const record = deviceRecord;
  if (!record) {
    // first time this device meets this account: keep whichever went further
    return compareProgress(progressOf(local.save), progressOf(cloud.save)) >= 0 ? "UPLOAD" : "DOWNLOAD";
  }
  const cloudChanged = cloud.clientUpdatedAt > record.lastSyncedAt;
  const localChanged = record.dirtyAt > record.lastSyncedAt;
  if (cloudChanged && !localChanged) return "DOWNLOAD";
  if (localChanged && !cloudChanged) return "UPLOAD";
  if (!cloudChanged && !localChanged) return "NOTHING";
  return compareProgress(progressOf(local.save), progressOf(cloud.save)) >= 0 ? "UPLOAD" : "DOWNLOAD";
}

/** Delay between the last save write and the upload, so a busy run uploads at most every few seconds. */
export const CLOUD_UPLOAD_DEBOUNCE_MS = 5000;

export function parseSyncRecord(raw: string | null): SyncRecord | null {
  if (!raw) return null;
  try {
    const r = JSON.parse(raw) as Partial<SyncRecord>;
    if (typeof r.userId !== "string") return null;
    return { userId: r.userId, lastSyncedAt: Number(r.lastSyncedAt) || 0, dirtyAt: Number(r.dirtyAt) || 0 };
  } catch {
    return null;
  }
}
