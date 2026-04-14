begin;

create or replace function public.friend_merge_key(
  p_user_a uuid,
  p_user_b uuid
)
returns text
language plpgsql
immutable
strict
set search_path = pg_catalog
as $$
begin
  if p_user_a::text <= p_user_b::text then
    return p_user_a::text || ':' || p_user_b::text;
  end if;

  return p_user_b::text || ':' || p_user_a::text;
end;
$$;

commit;
