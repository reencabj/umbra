-- Existing members select their own pseudonym at their next application entry.
alter table public.profiles add column pseudonym text;
alter table public.profiles add constraint profiles_pseudonym_format check (
 pseudonym is null or (
  char_length(pseudonym) between 3 and 24
  and pseudonym=upper(btrim(pseudonym))
  and pseudonym ~ '^[A-Z0-9ÁÉÍÓÚÜÑ][A-Z0-9ÁÉÍÓÚÜÑ _-]*[A-Z0-9ÁÉÍÓÚÜÑ]$'
 )
);
create unique index profiles_pseudonym_unique on public.profiles(pseudonym) where pseudonym is not null;

create function private.save_pseudonym(p_pseudonym text) returns text
language plpgsql security definer set search_path='' as $$
declare chosen text:=upper(regexp_replace(btrim(coalesce(p_pseudonym,'')),'[[:space:]]+',' ','g'));
begin
 perform private.require_member();
 if char_length(chosen) not between 3 and 24 or chosen !~ '^[A-Z0-9ÁÉÍÓÚÜÑ][A-Z0-9ÁÉÍÓÚÜÑ _-]*[A-Z0-9ÁÉÍÓÚÜÑ]$' then
  raise exception 'Usá entre 3 y 24 letras, números, espacios o guiones. Empezá y terminá con una letra o número.' using errcode='22023';
 end if;
 update public.profiles set pseudonym=chosen where id=(select auth.uid());
 return chosen;
exception when unique_violation then
 raise exception 'Ese pseudónimo ya está en uso. Elegí otro.' using errcode='23505';
end $$;
create function public.save_pseudonym(p_pseudonym text) returns text
language sql security invoker set search_path='' as $$ select private.save_pseudonym(p_pseudonym) $$;
revoke all on function private.save_pseudonym(text),public.save_pseudonym(text) from public,anon;
grant execute on function private.save_pseudonym(text),public.save_pseudonym(text) to authenticated;
