import { loadSave } from "@/engine/SaveSystem";
import { buildProfileFromSave, defaultDisplayName, parsePublicProfile, sanitizeDisplayName, type PublicPlayerProfile } from "./playerProfile";

/**
 * Where profiles come from. Two implementations, one interface, so the
 * Ranking/Profile screens never care which one is active:
 *
 * - LocalProfileService (today): the game has no server yet, so the only
 *   profile that exists is the player's own. The leaderboard therefore
 *   lists just "you" — no invented rivals, ever.
 * - HttpProfileService (when the game goes public): enabled by setting the
 *   build variable VITE_PROFILE_API_URL (e.g. "https://hordenova.app/api").
 *   It expects this small REST contract on the server:
 *
 *     GET  {base}/leaderboard?limit=50  -> { entries: LeaderboardEntry[] }
 *     GET  {base}/profiles/{playerId}   -> PublicPlayerProfile (404 if unknown)
 *     PUT  {base}/profiles/{playerId}   <- PublicPlayerProfile (the player's own snapshot)
 *
 *   Every profile received is passed through parsePublicProfile before it
 *   reaches the UI. The server is expected to rank by seasonBestWave
 *   (ties: prestigeLevel, then earliest updatedAt).
 */
export interface LeaderboardEntry {
  rank: number;
  playerId: string;
  displayName: string;
  seasonBestWave: number;
  prestigeLevel: number;
}

export interface ProfileService {
  /** True when profiles of other players can be fetched (a server is configured). */
  readonly online: boolean;
  getMyProfile(): PublicPlayerProfile;
  getLeaderboard(limit?: number): Promise<LeaderboardEntry[]>;
  getProfile(playerId: string): Promise<PublicPlayerProfile | null>;
  /** Uploads the local player's current snapshot (no-op offline). */
  publishMyProfile(): Promise<void>;
}

const DISPLAY_NAME_KEY = "hordenova.displayName";

export function getMyDisplayName(playerId: string): string {
  try {
    return sanitizeDisplayName(localStorage.getItem(DISPLAY_NAME_KEY), playerId);
  } catch {
    return defaultDisplayName(playerId);
  }
}

export function setMyDisplayName(name: string, playerId: string): string {
  const clean = sanitizeDisplayName(name, playerId);
  try {
    localStorage.setItem(DISPLAY_NAME_KEY, clean);
  } catch {
    /* storage unavailable: name lives for this session only */
  }
  return clean;
}

function myProfile(): PublicPlayerProfile {
  const save = loadSave();
  return buildProfileFromSave(save, getMyDisplayName(save.playerId));
}

function toEntry(p: PublicPlayerProfile, rank: number): LeaderboardEntry {
  return { rank, playerId: p.playerId, displayName: p.displayName, seasonBestWave: p.seasonBestWave, prestigeLevel: p.prestigeLevel };
}

export class LocalProfileService implements ProfileService {
  readonly online = false;
  getMyProfile(): PublicPlayerProfile {
    return myProfile();
  }
  async getLeaderboard(): Promise<LeaderboardEntry[]> {
    return [toEntry(myProfile(), 1)];
  }
  async getProfile(playerId: string): Promise<PublicPlayerProfile | null> {
    const me = myProfile();
    return me.playerId === playerId ? me : null;
  }
  async publishMyProfile(): Promise<void> {}
}

export class HttpProfileService implements ProfileService {
  readonly online = true;
  constructor(
    private readonly baseUrl: string,
    private readonly fetchImpl: typeof fetch = (...a) => fetch(...a),
  ) {}

  getMyProfile(): PublicPlayerProfile {
    return myProfile();
  }

  async getLeaderboard(limit = 50): Promise<LeaderboardEntry[]> {
    const res = await this.fetchImpl(`${this.baseUrl}/leaderboard?limit=${Math.max(1, Math.min(100, limit))}`);
    if (!res.ok) throw new Error(`leaderboard ${res.status}`);
    const body = (await res.json()) as { entries?: unknown };
    const entries = Array.isArray(body.entries) ? body.entries : [];
    return entries.flatMap((e, i) => {
      const p = parsePublicProfile({ ...(e as object), towers: [] });
      if (!p) return [];
      const rank = typeof (e as { rank?: unknown }).rank === "number" ? Math.max(1, Math.floor((e as { rank: number }).rank)) : i + 1;
      return [toEntry(p, rank)];
    });
  }

  async getProfile(playerId: string): Promise<PublicPlayerProfile | null> {
    const me = myProfile();
    if (me.playerId === playerId) return me;
    const res = await this.fetchImpl(`${this.baseUrl}/profiles/${encodeURIComponent(playerId)}`);
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`profile ${res.status}`);
    return parsePublicProfile(await res.json());
  }

  async publishMyProfile(): Promise<void> {
    const me = myProfile();
    await this.fetchImpl(`${this.baseUrl}/profiles/${encodeURIComponent(me.playerId)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(me),
    });
  }
}

let service: ProfileService | null = null;

export function getProfileService(): ProfileService {
  if (!service) {
    const base = (import.meta.env?.VITE_PROFILE_API_URL as string | undefined)?.replace(/\/+$/, "");
    service = base ? new HttpProfileService(base) : new LocalProfileService();
  }
  return service;
}
