import { useCallback, useEffect, useState } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import type { TranslationKey } from "@/i18n/translate";
import type { NavView } from "@/ui/TopNav";
import { getCloudClient, getCloudState, subscribeCloud } from "@/net/cloud";
import { DAILY_WATCH_POINTS_CAP, LIVE_REWARDS, WATCH_TICK_MINUTES, WATCH_TICK_POINTS, type LiveReward } from "@/config/liveRewards";
import { loadSave, updateSave } from "@/engine/SaveSystem";
import { applyRewardParts } from "@/engine/RewardGrant";
import { getShopItem } from "@/config/duel";

/**
 * RECOMPENSAS DA LIVE — link Twitch, see your Live Points, redeem. Shown
 * only when LIVE_REWARDS_ENABLED (config/liveRewards.ts). The balance and
 * every redemption live on the server (0003_creators_and_live.sql); the
 * reward reaches the save only after the server accepted the redemption.
 */
export function LiveRewardsPanel({ onNavigate }: { onNavigate: (view: NavView) => void }) {
  const { t } = useLanguage();
  const [cloud, setCloud] = useState(getCloudState());
  useEffect(() => subscribeCloud(setCloud), []);
  const signedIn = cloud.email !== null && cloud.status !== "SIGNED_OUT";
  const [linked, setLinked] = useState<string | null>(null);
  const [points, setPoints] = useState<number | null>(null);
  const [redeemed, setRedeemed] = useState<string[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    const sb = await getCloudClient();
    if (!sb || !signedIn) return;
    const { data: user } = await sb.auth.getUser();
    const twitch = user.user?.identities?.find((i) => i.provider === "twitch");
    setLinked(twitch ? String((twitch.identity_data as Record<string, unknown>)?.["nickname"] ?? (twitch.identity_data as Record<string, unknown>)?.["name"] ?? "Twitch") : null);
    const { data: bal } = await sb.from("live_points_balance").select("points").maybeSingle();
    setPoints(typeof bal?.points === "number" ? bal.points : 0);
    const { data: red } = await sb.from("live_redemptions").select("reward_id");
    setRedeemed((red ?? []).map((r: { reward_id: string }) => r.reward_id));
  }, [signedIn]);
  useEffect(() => {
    void refresh();
  }, [refresh]);

  const linkTwitch = async () => {
    const sb = await getCloudClient();
    if (!sb) return;
    await sb.auth.linkIdentity({ provider: "twitch", options: { redirectTo: window.location.href } });
  };

  const redeem = async (r: LiveReward) => {
    const sb = await getCloudClient();
    if (!sb || busy) return;
    setBusy(true);
    setMsg(null);
    // the cost and the "only once" rule come from the server's catalogue, never from here
    const { data, error } = await sb.rpc("redeem_live_reward", { reward: r.id });
    setBusy(false);
    if (error || !data?.ok) {
      setMsg(t(data?.reason === "POINTS" ? "live.errPoints" : data?.reason === "ONCE" ? "live.errOnce" : "live.errServer"));
      return;
    }
    const save = loadSave();
    if (r.duelLook && getShopItem(r.duelLook) && !save.duel.owned.includes(r.duelLook)) updateSave({ duel: { ...save.duel, owned: [...save.duel.owned, r.duelLook] } });
    if (r.parts?.length) updateSave(applyRewardParts(loadSave(), r.parts, { type: "STORE", refId: `live:${r.id}` }));
    setMsg(t("live.done", { name: t(`live.reward.${r.id}` as TranslationKey) }));
    void refresh();
  };

  return (
    <section className="cr8-block" aria-labelledby="cr8-live" data-testid="live-rewards">
      <h2 id="cr8-live" className="pg-h2">{t("live.title")}</h2>
      <p className="pg-sub">{t("live.lead", { minutes: WATCH_TICK_MINUTES, points: WATCH_TICK_POINTS, cap: DAILY_WATCH_POINTS_CAP })}</p>
      {!signedIn ? (
        <button className="pg-btn" onClick={() => onNavigate("ACCOUNT")}>
          {t("live.signIn")}
        </button>
      ) : !linked ? (
        <button className="pg-btn" onClick={linkTwitch}>
          {t("live.linkTwitch")}
        </button>
      ) : (
        <p className="cr8-example">{t("live.linked", { name: linked, points: points ?? 0 })}</p>
      )}
      {msg && <p className="cr8-example" role="status">{msg}</p>}
      <ul className="cr8-list">
        {LIVE_REWARDS.map((r) => {
          const done = !!r.once && redeemed.includes(r.id);
          return (
            <li key={r.id}>
              <strong>{t(`live.reward.${r.id}` as TranslationKey)}</strong>
              <span>{t("live.cost", { n: r.cost })}</span>
              <button className="pg-btn-ghost" disabled={!linked || busy || done || (points ?? 0) < r.cost} onClick={() => redeem(r)}>
                {done ? t("live.owned") : t("live.redeem")}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
