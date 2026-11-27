// HORDENOVA — o criador aprovado conecta a Twitch dele (uma vez), para o
// servidor poder ver quem está no chat das lives (Recompensas da Live).
//
// Como usar (no dia em que o servidor estiver ligado):
//   1. Em dev.twitch.tv, no app do HORDE NOVA, cadastre como "OAuth Redirect URL":
//        https://<seu-projeto>.functions.supabase.co/creator-connect
//   2. Envie ao criador aprovado este link (troque CODIGO pelo código dele):
//        https://id.twitch.tv/oauth2/authorize?client_id=<TWITCH_CLIENT_ID>&redirect_uri=https://<seu-projeto>.functions.supabase.co/creator-connect&response_type=code&scope=moderator:read:chatters&state=CODIGO
//   3. Ele entra com a Twitch dele; esta função confere que a conta da Twitch é
//      a cadastrada para aquele código (creators.twitch_login) e guarda a autorização.
//
// Variáveis: TWITCH_CLIENT_ID, TWITCH_CLIENT_SECRET, SITE_URL (ex.: https://hordenova.vercel.app).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const env = (k: string) => {
  const v = Deno.env.get(k);
  if (!v) throw new Error(`missing env ${k}`);
  return v;
};

const back = (status: string) => Response.redirect(`${env("SITE_URL")}/?criador_conectado=${status}`, 302);

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const creatorCode = (url.searchParams.get("state") ?? "").toUpperCase();
  if (!code || !/^[A-Z0-9_]{3,16}$/.test(creatorCode)) return back("erro");

  const db = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"));
  const { data: creator } = await db.from("creators").select("code, twitch_login, status").eq("code", creatorCode).maybeSingle();
  if (!creator || creator.status !== "APPROVED" || !creator.twitch_login) return back("nao_aprovado");

  const tok = await fetch("https://id.twitch.tv/oauth2/token", {
    method: "POST",
    body: new URLSearchParams({
      client_id: env("TWITCH_CLIENT_ID"),
      client_secret: env("TWITCH_CLIENT_SECRET"),
      code,
      grant_type: "authorization_code",
      redirect_uri: `${url.origin}${url.pathname}`,
    }),
  });
  if (!tok.ok) return back("erro");
  const t = await tok.json();

  // who signed in: must be the channel registered for this code
  const me = await fetch("https://api.twitch.tv/helix/users", { headers: { "Client-Id": env("TWITCH_CLIENT_ID"), Authorization: `Bearer ${t.access_token}` } });
  const user = me.ok ? (await me.json()).data?.[0] : null;
  if (!user || String(user.login).toLowerCase() !== String(creator.twitch_login).toLowerCase()) return back("outra_conta");

  await db.from("creator_tokens").upsert({
    creator_code: creatorCode,
    twitch_user_id: String(user.id),
    access_token: t.access_token,
    refresh_token: t.refresh_token,
    expires_at: new Date(Date.now() + (t.expires_in ?? 3600) * 1000).toISOString(),
  });
  return back("ok");
});
