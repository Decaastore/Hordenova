-- HORDENOVA — Suporte: tickets dos jogadores + Central de Tickets do dono.
-- Rode isto uma vez no SQL Editor do projeto Supabase (depois do 0001_init.sql).
--
-- Quem pode o quê (Row Level Security):
--   * Qualquer jogador (com ou sem conta) ABRE um ticket.
--   * Cada jogador vê só os PRÓPRIOS tickets: pela conta (user_id) ou, sem
--     conta, pela chave secreta que o próprio navegador guardou ao enviar.
--   * Só os e-mails da tabela support_admins veem TODOS os tickets,
--     respondem e mudam o status (a Central de Tickets no site).
--
-- PARA LIBERAR A CENTRAL PARA VOCÊ: troque o e-mail abaixo pelo e-mail da sua
-- conta no jogo e rode:
--   insert into public.support_admins (email) values ('seu-email@exemplo.com');

create table if not exists public.support_admins (
  email text primary key
);
alter table public.support_admins enable row level security;
-- ninguém lê ou altera a lista de admins pelo site; só pelo painel do Supabase

create or replace function public.is_support_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.support_admins a
    where lower(a.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;
grant execute on function public.is_support_admin() to anon, authenticated;

create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  user_id uuid references auth.users (id) on delete set null,
  -- a chave secreta do navegador que enviou (deixa ver o ticket sem conta)
  access_key uuid not null,
  -- identifica o aparelho só para o limite anti-spam
  client_id text not null check (length(client_id) between 8 and 64),
  topic text not null check (topic in ('SUGGESTION', 'BUG', 'BALANCE', 'PAYMENT', 'ACCOUNT', 'REPORT', 'OTHER')),
  area text check (area is null or area in ('GAME', 'DUEL', 'COLOSSUS', 'ETERNAL', 'STORE', 'SITE', 'OTHER')),
  subject text not null check (length(subject) between 4 and 120),
  body text not null check (length(body) between 10 and 4000),
  contact_email text check (contact_email is null or (length(contact_email) <= 160 and contact_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$')),
  player_name text check (player_name is null or length(player_name) <= 40),
  language text check (language is null or length(language) <= 8),
  game_version text check (game_version is null or length(game_version) <= 20),
  device jsonb check (device is null or pg_column_size(device) < 2048),
  status text not null default 'OPEN' check (status in ('OPEN', 'IN_REVIEW', 'ANSWERED', 'CLOSED')),
  reply text check (reply is null or length(reply) <= 4000),
  replied_at timestamptz
);

create index if not exists support_tickets_created_idx on public.support_tickets (created_at desc);
create index if not exists support_tickets_status_idx on public.support_tickets (status, topic);
create index if not exists support_tickets_client_idx on public.support_tickets (client_id, created_at desc);

alter table public.support_tickets enable row level security;

-- abrir: qualquer um, sempre como ticket novo, sem resposta, e só em nome da própria conta
drop policy if exists "tickets_insert_any" on public.support_tickets;
create policy "tickets_insert_any" on public.support_tickets
  for insert with check (
    status = 'OPEN' and reply is null and replied_at is null
    and (user_id is null or user_id = auth.uid())
  );

-- ler: o dono do ticket (pela conta) ou o admin
drop policy if exists "tickets_select_own_or_admin" on public.support_tickets;
create policy "tickets_select_own_or_admin" on public.support_tickets
  for select using ((user_id is not null and user_id = auth.uid()) or public.is_support_admin());

-- responder / mudar status: só o admin
drop policy if exists "tickets_update_admin" on public.support_tickets;
create policy "tickets_update_admin" on public.support_tickets
  for update using (public.is_support_admin()) with check (public.is_support_admin());

-- sem conta: ver os próprios tickets pelas chaves que o navegador guardou
create or replace function public.get_tickets_by_keys(keys uuid[])
returns setof public.support_tickets
language sql stable security definer set search_path = public as $$
  select * from public.support_tickets
  where access_key = any(keys[1:50])
  order by created_at desc;
$$;
grant execute on function public.get_tickets_by_keys(uuid[]) to anon, authenticated;

-- anti-spam: no máximo 5 tickets por hora e 15 por dia por aparelho
create or replace function public.support_tickets_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    if (select count(*) from public.support_tickets where client_id = new.client_id and created_at > now() - interval '1 hour') >= 5
       or (select count(*) from public.support_tickets where client_id = new.client_id and created_at > now() - interval '1 day') >= 15 then
      raise exception 'TICKET_RATE_LIMIT';
    end if;
    new.created_at := now();
  end if;
  new.updated_at := now();
  if tg_op = 'UPDATE' and new.reply is distinct from old.reply and new.reply is not null then
    new.replied_at := now();
  end if;
  return new;
end $$;

drop trigger if exists support_tickets_guard on public.support_tickets;
create trigger support_tickets_guard before insert or update on public.support_tickets
  for each row execute function public.support_tickets_guard();
