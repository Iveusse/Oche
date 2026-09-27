-- Oche : migration 002, remise à zéro d'un profil
-- À coller une fois dans Supabase > SQL Editor > New query, puis "Run".
--
-- Principe : on ne supprime aucune partie (les autres joueurs gardent leurs stats).
-- On note juste la date de remise à zéro du joueur, et l'appli ignore
-- tout ce qu'il a joué avant cette date pour SES stats et SES succès.

alter table public.players add column if not exists reset_at timestamptz;

create or replace function public.oche_reset_player(p_code text, p_player uuid)
returns timestamptz
language plpgsql security definer set search_path = public
as $$
declare r timestamptz;
begin
  if not oche_check(p_code) then raise exception 'bad_code'; end if;
  update players set reset_at = now() where id = p_player returning reset_at into r;
  if r is null then raise exception 'unknown_player'; end if;
  return r;
end;
$$;

grant execute on function public.oche_reset_player(text, uuid) to anon, authenticated;

-- oche_players renvoie la nouvelle colonne automatiquement (select *).
-- On la recrée quand même pour que le changement de structure soit pris en compte.
create or replace function public.oche_players(p_code text)
returns setof public.players
language plpgsql stable security definer set search_path = public
as $$
begin
  if not oche_valid(p_code) then raise exception 'bad_code'; end if;
  return query select * from players order by name;
end;
$$;
