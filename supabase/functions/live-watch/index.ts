// HORDENOVA — Recompensas da Live: credita Pontos da Live a quem está assistindo.
//
// Roda a cada 5 minutos (agendada no Supabase, chamando esta função com o
// cabeçalho x-cron-secret). A cada vez:
//   1. pega os criadores aprovados que têm a Twitch autorizada (creator_tokens);
//   2. pergunta à Twitch quais deles estão AO VIVO na categoria do HORDE NOVA;
//   3. para cada live, lista quem está no chat (precisa da autorização do criador);
//   4. acha as contas do jogo ligadas a essas contas da Twitch e credita os pontos,
//      respeitando o limite do dia (função credit_watch_points do 0003).
//
// Variáveis de ambiente (Supabase → Edge Functions → Secrets):
//   TWITCH_CLIENT_ID, TWITCH_CLIENT_SECRET  — do app registrado em dev.twitch.tv
//   HORDENOVA_TWITCH_GAME_ID                — o id da categoria HORDE NOVA na Twitch
//   CRON_SECRET                             — qualquer senha longa; a agenda envia no cabeçalho
//   (SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY já existem nas funções do Supabase)
//
// Os números (5 min, 10 pontos, 300 por dia) são os de src/config/liveRewards.ts.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const WATCH_TICK_POINTS = 10;
const DAILY_WATCH_POINTS_CAP = 300;

const env = (k: string) => {
  const v = Deno.env.get(k);
  if (!v) throw new Error(`missing env ${k}`);
  return v;
};

interface Token {
  creator_code: string;
  twitch_user_id: string;
  access_token: string;
  refresh_token: string;
  expires_at: string;
}

async function twitch(path: string, token: string): Promise<Response> {
  return fetch(`https://api.twitch.tv/helix/${path}`, { headers: { "Client-Id": env("TWITCH_CLIENT_ID"), Authorization: `Bearer ${token}` } });
}

async function appToken(): Promise<string> {
  const r = await fetch("https://id.twitch.tv/oauth2/token", {
    method: "POST",
    body: new URLSearchParams({ client_id: env("TWITCH_CLIENT_ID"), client_secret: env("TWITCH_CLIENT_SECRET"), grant_type: "client_credentials" }),
  });
  if (!r.ok) throw new Error(`twitch app token ${r.status}`);
  return (await r.json()).access_token as string;
}

/** A creator's user token, refreshed when it is about to expire. */
async function userToken(db: ReturnType<typeof createClient>, t: Token): Promise<string | null> {
  if (new Date(t.expires_at).getTime() - Date.now() > 120_000) return t.access_token;
  const r = await fetch("https://id.twitch.tv/oauth2/token", {
    method: "POST",
    body: new URLSearchParams({ client_id: env("TWITCH_CLIENT_ID"), client_secret: env("TWITCH_CLIENT_SECRET"), grant_type: "refresh_token", refresh_token: t.refresh_token }),
  });
  if (!r.ok) return null;
  const j = await r.json();
  await db
    .from("creator_tokens")
    .update({ access_token: j.access_token, refresh_token: j.refresh_token ?? t.refresh_token, expires_at: new Date(Date.now() + (j.expires_in ?? 3600) * 1000).toISOString() })
    .eq("creator_code", t.creator_code);
  return j.access_token as string;
}

/** Everyone in a live's chat (paged), as Twitch user ids. */
async function chatters(broadcasterId: string, token: string): Promise<string[]> {
  const ids: string[] = [];
  let cursor = "";
  for (let page = 0; page < 50; page++) {
    const r = await twitch(`chat/chatters?broadcaster_id=${broadcasterId}&moderator_id=${broadcasterId}&first=1000${cursor ? `&after=${cursor}` : ""}`, token);
    if (!r.ok) break;
    const j = await r.json();
    for (const c of j.data ?? []) ids.push(String(c.user_id));
    cursor = j.pagination?.cursor ?? "";
    if (!cursor) break;
  }
  return ids;
}

Deno.serve(async (req) => {
  if (req.headers.get("x-cron-secret") !== env("CRON_SECRET")) return new Response("forbidden", { status: 403 });
  const db = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"));
  const { data: tokens } = await db.from("creator_tokens").select("*, creators!inner(status)").eq("creators.status", "APPROVED");
  if (!tokens?.length) return Response.json({ lives: 0, credited: 0 });

  // which of them are live in the HORDE NOVA category right now
  const app = await appToken();
  const live = new Set<string>();
  for (let i = 0; i < tokens.length; i += 100) {
    const q = tokens.slice(i, i + 100).map((t: Token) => `user_id=${t.twitch_user_id}`).join("&");
    const r = await twitch(`streams?${q}&game_id=${env("HORDENOVA_TWITCH_GAME_ID")}&first=100`, app);
    if (r.ok) for (const s of (await r.json()).data ?? []) live.add(String(s.user_id));
  }

  let credited = 0;
  for (const t of tokens as Token[]) {
    if (!live.has(t.twitch_user_id)) continue;
    const token = await userToken(db, t);
    if (!token) continue;
    const ids = (await chatters(t.twitch_user_id, token)).filter((id) => id !== t.twitch_user_id);
    if (!ids.length) continue;
    const { data: accounts } = await db.rpc("live_accounts_for", { twitch_ids: ids });
    const users = [...new Set((accounts ?? []).map((a: { user_id: string }) => a.user_id))];
    if (!users.length) continue;
    const { data: n } = await db.rpc("credit_watch_points", { users, points: WATCH_TICK_POINTS, daily_cap: DAILY_WATCH_POINTS_CAP, creator: t.creator_code });
    credited += Number(n ?? 0);
  }
  return Response.json({ lives: live.size, credited });
});
