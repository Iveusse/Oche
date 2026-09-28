-- Oche : migration 003, plusieurs équipes (et remise à zéro de profil incluse)
-- À coller une fois dans Supabase > SQL Editor > New query, puis "Run".
-- On peut le relancer sans risque : il ne refait que ce qui manque.
--
-- Ce que ça fait :
--  * crée la table des équipes ; votre groupe actuel devient la 1re équipe, AVEC LE MÊME CODE
--  * range tous les joueurs et toutes les parties existants dans cette équipe
--  * toutes les fonctions ne voient plus que l'équipe du code utilisé
--  * l'ancienne version de l'appli continue de marcher pendant la mise à jour
--
-- Tu peux changer le nom de votre équipe ici (ligne marquée NOM) ou plus tard dans l'appli.

create extension if not exists pgcrypto with schema extensions;

-- ---------- Tables ----------

create table if not exists public.teams (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  code_hash   text not null unique,
  admin_hash  text,
  created_at  timestamptz not null default now()
);
alter table public.teams enable row level security;

alter table public.players add column if not exists reset_at timestamptz;
alter table public.players add column if not exists team_id uuid references public.teams(id);
alter table public.games   add column if not exists team_id uuid references public.teams(id);

-- votre groupe actuel -> 1re équipe (même code)
do $$
declare t uuid; h text;
begin
  select value into h from public.app_config where key = 'group_code_hash';
  if h is not null and not exists (select 1 from public.teams where code_hash = h) then
    insert into public.teams (name, code_hash) values ('Famille', h)   -- NOM
    returning id into t;
    update public.players set team_id = t where team_id is null;
    update public.games   set team_id = t where team_id is null;
  end if;
end $$;

-- un même prénom peut exister dans deux équipes différentes
drop index if exists public.players_name_unique;
create unique index if not exists players_team_name_unique on public.players (team_id, lower(name));
create index if not exists games_team_idx on public.games (team_id, created_at);

-- ---------- Codes ----------

-- « k7p-4qx », « K7P4QX » ou « k7p 4qx » : même code
create or replace function public.oche_norm(p_code text)
returns text language sql immutable as $$
  select upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'));
$$;

create or replace function public.oche_hash(p text)
returns text language sql immutable as $$
  select encode(extensions.digest(coalesce(p, ''), 'sha256'), 'hex');
$$;

-- équipe correspondant à un code (null si aucune). Accepte aussi les anciens codes libres tels quels.
create or replace function public.oche_team_of(p_code text)
returns uuid language sql stable security definer set search_path = public as $$
  select id from teams
  where code_hash in (oche_hash(oche_norm(p_code)), oche_hash(p_code))
  limit 1;
$$;

-- 6 caractères sans 0/O/1/I/L pour éviter les confusions, affiché « K7P-4QX »
create or replace function public.oche_new_code()
returns text language plpgsql volatile as $$
declare a text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; c text; i int;
begin
  loop
    c := '';
    for i in 1..6 loop c := c || substr(a, 1 + floor(random() * length(a))::int, 1); end loop;
    exit when not exists (select 1 from public.teams where code_hash = oche_hash(c));
  end loop;
  return substr(c, 1, 3) || '-' || substr(c, 4, 3);
end;
$$;

create or replace function public.oche_new_token()
returns text language sql volatile as $$
  select encode(extensions.gen_random_bytes(18), 'hex');
$$;

-- ---------- Équipes ----------

-- rejoindre : renvoie l'équipe, ou null (avec 1 s d'attente pour freiner les essais au hasard)
create or replace function public.oche_join(p_code text)
returns json language plpgsql security definer set search_path = public as $$
declare t teams;
begin
  select * into t from teams where id = oche_team_of(p_code);
  if t.id is null then perform pg_sleep(1); return null; end if;
  return json_build_object('id', t.id, 'name', t.name, 'has_admin', t.admin_hash is not null);
end;
$$;

-- créer : renvoie le code (en clair, une seule fois) et la clé du créateur
create or replace function public.oche_create_team(p_name text)
returns json language plpgsql security definer set search_path = public as $$
declare c text; tok text; t teams;
begin
  if length(trim(coalesce(p_name, ''))) = 0 or length(trim(p_name)) > 40 then raise exception 'bad_name'; end if;
  c := oche_new_code(); tok := oche_new_token();
  insert into teams (name, code_hash, admin_hash) values (trim(p_name), oche_hash(oche_norm(c)), oche_hash(tok))
  returning * into t;
  return json_build_object('id', t.id, 'name', t.name, 'code', c, 'admin_token', tok);
end;
$$;

-- équipe sans créateur (votre équipe migrée) : le premier qui le demande le devient
create or replace function public.oche_claim_admin(p_code text)
returns text language plpgsql security definer set search_path = public as $$
declare t uuid := oche_team_of(p_code); tok text := oche_new_token();
begin
  if t is null then perform pg_sleep(1); raise exception 'bad_code'; end if;
  update teams set admin_hash = oche_hash(tok) where id = t and admin_hash is null;
  if not found then raise exception 'already_admin'; end if;
  return tok;
end;
$$;

create or replace function public.oche_is_admin(p_code text, p_token text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from teams where id = oche_team_of(p_code) and admin_hash = oche_hash(p_token));
$$;

create or replace function public.oche_rename_team(p_code text, p_token text, p_name text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not oche_is_admin(p_code, p_token) then raise exception 'not_admin'; end if;
  if length(trim(coalesce(p_name, ''))) = 0 or length(trim(p_name)) > 40 then raise exception 'bad_name'; end if;
  update teams set name = trim(p_name) where id = oche_team_of(p_code);
end;
$$;

-- nouveau code : l'ancien ne marche plus du tout (chacun devra saisir le nouveau)
create or replace function public.oche_regen_code(p_code text, p_token text)
returns text language plpgsql security definer set search_path = public as $$
declare c text; t uuid := oche_team_of(p_code);
begin
  if not oche_is_admin(p_code, p_token) then raise exception 'not_admin'; end if;
  c := oche_new_code();
  update teams set code_hash = oche_hash(oche_norm(c)) where id = t;
  return c;
end;
$$;

-- ---------- Données (toujours limitées à l'équipe du code) ----------

create or replace function public.oche_valid(p_code text)
returns boolean language sql stable security definer set search_path = public as $$
  select oche_team_of(p_code) is not null;
$$;

create or replace function public.oche_check(p_code text)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if not oche_valid(p_code) then perform pg_sleep(1); return false; end if;
  return true;
end;
$$;

create or replace function public.oche_players(p_code text)
returns setof public.players language plpgsql stable security definer set search_path = public as $$
declare t uuid := oche_team_of(p_code);
begin
  if t is null then raise exception 'bad_code'; end if;
  return query select * from players where team_id = t order by name;
end;
$$;

create or replace function public.oche_add_player(p_code text, p_name text, p_color text)
returns public.players language plpgsql security definer set search_path = public as $$
declare r players; t uuid := oche_team_of(p_code);
begin
  if t is null then raise exception 'bad_code'; end if;
  if length(trim(p_name)) = 0 or length(trim(p_name)) > 24 then raise exception 'bad_name'; end if;
  insert into players (name, color, team_id) values (trim(p_name), coalesce(p_color, '#5fc8ff'), t)
  returning * into r;
  return r;
end;
$$;

create or replace function public.oche_games(p_code text)
returns setof public.games language plpgsql stable security definer set search_path = public as $$
declare t uuid := oche_team_of(p_code);
begin
  if t is null then raise exception 'bad_code'; end if;
  return query select * from games where team_id = t order by created_at;
end;
$$;

-- ajoute ou met à jour une partie de SON équipe ; une partie terminée ne bouge plus
create or replace function public.oche_save_game(p_code text, p_game jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare t uuid := oche_team_of(p_code);
begin
  if t is null then raise exception 'bad_code'; end if;
  insert into games (id, mode, settings, player_ids, data, status, created_at, updated_at, team_id)
  values (
    (p_game->>'id')::uuid, p_game->>'mode', coalesce(p_game->'settings', '{}'::jsonb),
    array(select jsonb_array_elements_text(p_game->'player_ids'))::uuid[],
    p_game->'data', p_game->>'status',
    coalesce((p_game->>'created_at')::timestamptz, now()), now(), t
  )
  on conflict (id) do update
    set data = excluded.data, status = excluded.status, settings = excluded.settings,
        player_ids = excluded.player_ids, updated_at = now()
    where games.status <> 'finished' and games.team_id = t;
end;
$$;

create or replace function public.oche_reset_player(p_code text, p_player uuid)
returns timestamptz language plpgsql security definer set search_path = public as $$
declare r timestamptz; t uuid := oche_team_of(p_code);
begin
  if t is null then perform pg_sleep(1); raise exception 'bad_code'; end if;
  update players set reset_at = now() where id = p_player and team_id = t returning reset_at into r;
  if r is null then raise exception 'unknown_player'; end if;
  return r;
end;
$$;

-- ---------- Droits ----------
revoke all on function public.oche_valid(text), public.oche_team_of(text), public.oche_is_admin(text, text),
  public.oche_new_code(), public.oche_new_token(), public.oche_hash(text), public.oche_norm(text)
  from public, anon, authenticated;
grant execute on function public.oche_check(text)                      to anon, authenticated;
grant execute on function public.oche_join(text)                       to anon, authenticated;
grant execute on function public.oche_create_team(text)                to anon, authenticated;
grant execute on function public.oche_claim_admin(text)                to anon, authenticated;
grant execute on function public.oche_rename_team(text, text, text)    to anon, authenticated;
grant execute on function public.oche_regen_code(text, text)           to anon, authenticated;
grant execute on function public.oche_players(text)                    to anon, authenticated;
grant execute on function public.oche_add_player(text, text, text)     to anon, authenticated;
grant execute on function public.oche_games(text)                      to anon, authenticated;
grant execute on function public.oche_save_game(text, jsonb)           to anon, authenticated;
grant execute on function public.oche_reset_player(text, uuid)         to anon, authenticated;
