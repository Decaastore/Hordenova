-- HORDENOVA — Fase 1: conta + save na nuvem.
-- Rode isto uma vez no SQL Editor do projeto Supabase.
-- Cada jogador só consegue ler e gravar a PRÓPRIA linha (Row Level Security).

create table if not exists public.saves (
  user_id uuid primary key references auth.users (id) on delete cascade,
  save jsonb not null,
  eternal jsonb,
  client_updated_at bigint not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.saves enable row level security;

drop policy if exists "saves_select_own" on public.saves;
create policy "saves_select_own" on public.saves
  for select using (auth.uid() = user_id);

drop policy if exists "saves_insert_own" on public.saves;
create policy "saves_insert_own" on public.saves
  for insert with check (auth.uid() = user_id);

drop policy if exists "saves_update_own" on public.saves;
create policy "saves_update_own" on public.saves
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- updated_at sempre no relógio do servidor
create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists saves_touch on public.saves;
create trigger saves_touch before insert or update on public.saves
  for each row execute function public.touch_updated_at();

-- limite de tamanho por save (evita abuso do armazenamento: 512 KB)
alter table public.saves drop constraint if exists saves_size_limit;
alter table public.saves add constraint saves_size_limit
  check (pg_column_size(save) + coalesce(pg_column_size(eternal), 0) < 524288);
