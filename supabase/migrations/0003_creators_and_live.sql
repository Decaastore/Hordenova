-- HORDENOVA — Programa de Criadores + Recompensas da Live.
-- Rode isto uma vez no SQL Editor do projeto Supabase (depois do 0001 e do 0002).
--
-- O que fica aqui:
--   * creators ............ os criadores (inscritos e aprovados). Só os admins do suporte aprovam.
--   * creator_sales ....... cada compra com dinheiro feita com um código (gravada só pelo servidor de pagamento).
--   * creator_tokens ...... a autorização da Twitch de cada criador (para saber quem está no chat da live). Só o servidor lê.
--   * live_reward_catalog . os prêmios e o custo em Pontos da Live (o custo vale daqui, nunca do navegador).
--   * live_points ......... o extrato de pontos de cada conta (+ assistir, − resgatar).
--   * live_redemptions .... os resgates.
--
-- Os pontos só entram pela função do servidor (supabase/functions/live-watch) e só saem
-- pelo resgate abaixo — o jogador não consegue dar pontos a si mesmo.

-- ── criadores ──────────────────────────────────────────────────────────────
create table if not exists public.creators (
  code text primary key check (code ~ '^[A-Z0-9_]{3,16}$'),
  name text not null check (length(name) between 1 and 60),
  platform text not null check (platform in ('TWITCH', 'YOUTUBE', 'KICK', 'TIKTOK', 'INSTAGRAM', 'OTHER')),
  channel_url text not null check (length(channel_url) between 8 and 300),
  -- o login da Twitch (para as Recompensas da Live), quando a plataforma é a Twitch
  twitch_login text,
  status text not null default 'PENDING' check (status in ('PENDING', 'APPROVED', 'CANCELLED')),
  created_at timestamptz not null default now(),
  approved_at timestamptz
);
alter table public.creators enable row level security;
-- todos veem os aprovados (a lista do site); os admins do suporte veem e editam tudo
create policy creators_read on public.creators for select using (status = 'APPROVED' or public.is_support_admin());
create policy creators_admin_write on public.creators for all using (public.is_support_admin()) with check (public.is_support_admin());

-- ── vendas com código (para o pagamento) ───────────────────────────────────
create table if not exists public.creator_sales (
  id bigserial primary key,
  created_at timestamptz not null default now(),
  creator_code text not null references public.creators (code),
  user_id uuid references auth.users (id) on delete set null,
  pack_id text not null,
  price_cents integer not null check (price_cents > 0),
  -- o id da transação no provedor de pagamento (nunca grava a mesma duas vezes)
  provider_ref text not null unique
);
alter table public.creator_sales enable row level security;
create policy creator_sales_admin_read on public.creator_sales for select using (public.is_support_admin());
-- sem política de escrita: só o servidor de pagamento (service role) grava

create or replace view public.creator_monthly_sales with (security_invoker = true) as
  select creator_code, date_trunc('month', created_at) as month, sum(price_cents) / 100.0 as sales_brl, count(*) as purchases
  from public.creator_sales group by 1, 2;

-- ── autorização da Twitch dos criadores (só o servidor) ────────────────────
create table if not exists public.creator_tokens (
  creator_code text primary key references public.creators (code) on delete cascade,
  twitch_user_id text not null,
  access_token text not null,
  refresh_token text not null,
  expires_at timestamptz not null
);
alter table public.creator_tokens enable row level security;
-- nenhuma política: ninguém lê pelo site

-- ── Recompensas da Live ────────────────────────────────────────────────────
create table if not exists public.live_reward_catalog (
  id text primary key,
  cost integer not null check (cost > 0),
  once boolean not null default false
);
alter table public.live_reward_catalog enable row level security;
create policy live_catalog_read on public.live_reward_catalog for select using (true);
-- o mesmo catálogo de src/config/liveRewards.ts
insert into public.live_reward_catalog (id, cost, once) values
  ('LIVE_BANNER', 600, true),
  ('LIVE_FRAME', 1200, true),
  ('LIVE_KILL_FX', 2400, true),
  ('LIVE_SHARDS', 150, false),
  ('LIVE_ITEM', 400, false)
on conflict (id) do update set cost = excluded.cost, once = excluded.once;

create table if not exists public.live_points (
  id bigserial primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  delta integer not null,
  reason text not null,
  creator_code text,
  created_at timestamptz not null default now()
);
create index if not exists live_points_user_idx on public.live_points (user_id, created_at);
alter table public.live_points enable row level security;
create policy live_points_own on public.live_points for select using (user_id = auth.uid());

create or replace view public.live_points_balance with (security_invoker = true) as
  select user_id, coalesce(sum(delta), 0)::integer as points from public.live_points where user_id = auth.uid() group by user_id;

create table if not exists public.live_redemptions (
  id bigserial primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  reward_id text not null references public.live_reward_catalog (id),
  cost integer not null,
  created_at timestamptz not null default now()
);
alter table public.live_redemptions enable row level security;
create policy live_redemptions_own on public.live_redemptions for select using (user_id = auth.uid());

-- Resgate: confere saldo e "só uma vez" com o custo do catálogo, grava o resgate e desconta os pontos.
create or replace function public.redeem_live_reward(reward text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  item public.live_reward_catalog%rowtype;
  bal integer;
begin
  if uid is null then return jsonb_build_object('ok', false, 'reason', 'AUTH'); end if;
  select * into item from public.live_reward_catalog where id = reward;
  if not found then return jsonb_build_object('ok', false, 'reason', 'UNKNOWN'); end if;
  perform pg_advisory_xact_lock(hashtext(uid::text));
  if item.once and exists (select 1 from public.live_redemptions where user_id = uid and reward_id = reward) then
    return jsonb_build_object('ok', false, 'reason', 'ONCE');
  end if;
  select coalesce(sum(delta), 0) into bal from public.live_points where user_id = uid;
  if bal < item.cost then return jsonb_build_object('ok', false, 'reason', 'POINTS'); end if;
  insert into public.live_redemptions (user_id, reward_id, cost) values (uid, reward, item.cost);
  insert into public.live_points (user_id, delta, reason) values (uid, -item.cost, 'redeem:' || reward);
  return jsonb_build_object('ok', true, 'points', bal - item.cost);
end;
$$;
grant execute on function public.redeem_live_reward(text) to authenticated;

-- Só o servidor: quais contas do jogo estão ligadas a estes usuários da Twitch.
create or replace function public.live_accounts_for(twitch_ids text[]) returns table (user_id uuid, twitch_id text)
language sql stable security definer set search_path = public, auth as $$
  select i.user_id, i.provider_id from auth.identities i where i.provider = 'twitch' and i.provider_id = any (twitch_ids);
$$;
revoke all on function public.live_accounts_for(text[]) from public, anon, authenticated;

-- Só o servidor: credita pontos de tempo assistido respeitando o limite do dia (fuso de Brasília).
create or replace function public.credit_watch_points(users uuid[], points integer, daily_cap integer, creator text) returns integer
language plpgsql security definer set search_path = public as $$
declare
  u uuid;
  today_total integer;
  give integer;
  credited integer := 0;
begin
  foreach u in array users loop
    select coalesce(sum(delta), 0) into today_total from public.live_points
      where user_id = u and reason = 'watch' and (created_at at time zone 'America/Sao_Paulo')::date = (now() at time zone 'America/Sao_Paulo')::date;
    give := least(points, daily_cap - today_total);
    if give > 0 then
      insert into public.live_points (user_id, delta, reason, creator_code) values (u, give, 'watch', creator);
      credited := credited + 1;
    end if;
  end loop;
  return credited;
end;
$$;
revoke all on function public.credit_watch_points(uuid[], integer, integer, text) from public, anon, authenticated;
