-- Oche : schéma Supabase
-- À coller une seule fois dans Supabase > SQL Editor > New query, puis "Run".
-- AVANT de lancer : remplace CHANGE-MOI tout en bas par votre code de groupe.

create extension if not exists pgcrypto with schema extensions;

-- ---------- Tables ----------

create table if not exists public.players (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  color       text not null default '#5fc8ff',
  created_at  timestamptz not null default now()
);
create unique index if not exists players_name_unique on public.players (lower(name));

create table if not exists public.games (
  id          uuid primary key,
  mode        text not null,
  settings    jsonb not null default '{}'::jsonb,
  player_ids  uuid[] not null,
  data        jsonb not null,
  status      text not null check (status in ('in_progress', 'finished')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists games_created_idx on public.games (created_at desc);

create table if not exists public.app_config (
  key   text primary key,
  value text not null
);

-- RLS activée sans aucune policy : la clé publique ne peut RIEN lire ni écrire
-- directement. Tout passe par les fonctions ci-dessous, qui vérifient le code.
alter table public.players    enable row level security;
alter table public.games      enable row level security;
alter table public.app_config enable row level security;

-- ---------- Fonctions ----------

create or replace function public.oche_valid(p_code text)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from app_config
    where key = 'group_code_hash'
      and value = encode(extensions.digest(coalesce(p_code, ''), 'sha256'), 'hex')
  );
$$;

create or replace function public.oche_check(p_code text)
returns boolean
language plpgsql security definer set search_path = public
as $$
begin
  if not oche_valid(p_code) then
    perform pg_sleep(1); -- freine les essais au hasard
    return false;
  end if;
  return true;
end;
$$;

create or replace function public.oche_players(p_code text)
returns setof public.players
language plpgsql stable security definer set search_path = public
as $$
begin
  if not oche_valid(p_code) then raise exception 'bad_code'; end if;
  return query select * from players order by name;
end;
$$;

create or replace function public.oche_add_player(p_code text, p_name text, p_color text)
returns public.players
language plpgsql security definer set search_path = public
as $$
declare r players;
begin
  if not oche_valid(p_code) then raise exception 'bad_code'; end if;
  if length(trim(p_name)) = 0 or length(trim(p_name)) > 24 then raise exception 'bad_name'; end if;
  insert into players (name, color) values (trim(p_name), coalesce(p_color, '#5fc8ff'))
  returning * into r;
  return r;
end;
$$;

create or replace function public.oche_games(p_code text)
returns setof public.games
language plpgsql stable security definer set search_path = public
as $$
begin
  if not oche_valid(p_code) then raise exception 'bad_code'; end if;
  return query select * from games order by created_at;
end;
$$;

-- Ajoute ou met à jour une partie. Une partie terminée ne peut plus être modifiée.
-- Aucune fonction de suppression n'existe.
create or replace function public.oche_save_game(p_code text, p_game jsonb)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not oche_valid(p_code) then raise exception 'bad_code'; end if;
  insert into games (id, mode, settings, player_ids, data, status, created_at, updated_at)
  values (
    (p_game->>'id')::uuid,
    p_game->>'mode',
    coalesce(p_game->'settings', '{}'::jsonb),
    array(select jsonb_array_elements_text(p_game->'player_ids'))::uuid[],
    p_game->'data',
    p_game->>'status',
    coalesce((p_game->>'created_at')::timestamptz, now()),
    now()
  )
  on conflict (id) do update
    set data = excluded.data,
        status = excluded.status,
        settings = excluded.settings,
        player_ids = excluded.player_ids,
        updated_at = now()
    where games.status <> 'finished';
end;
$$;

revoke all on function public.oche_valid(text) from public, anon, authenticated;
grant execute on function public.oche_check(text)                   to anon, authenticated;
grant execute on function public.oche_players(text)                 to anon, authenticated;
grant execute on function public.oche_add_player(text, text, text)  to anon, authenticated;
grant execute on function public.oche_games(text)                   to anon, authenticated;
grant execute on function public.oche_save_game(text, jsonb)        to anon, authenticated;

-- ---------- Code de groupe ----------
-- Remplace CHANGE-MOI par votre code (ex : un mot ou 6 chiffres). Pour le changer
-- plus tard, relance juste ces 3 lignes avec le nouveau code.
insert into public.app_config (key, value)
values ('group_code_hash', encode(extensions.digest('CHANGE-MOI', 'sha256'), 'hex'))
on conflict (key) do update set value = excluded.value;
