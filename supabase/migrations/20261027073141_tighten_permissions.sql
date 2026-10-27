-- Separate mutation policies avoid evaluating two SELECT policies per table.
do $$ declare t text; begin
 foreach t in array array['settings','categories','limit_exceptions','combos'] loop
  execute format('drop policy admin_write on public.%I',t);
  execute format('create policy admin_insert on public.%I for insert to authenticated with check ((select private.is_admin()))',t);
  execute format('create policy admin_update on public.%I for update to authenticated using ((select private.is_admin())) with check ((select private.is_admin()))',t);
  if t<>'settings' then execute format('create policy admin_delete on public.%I for delete to authenticated using ((select private.is_admin()))',t);end if;
 end loop;
 foreach t in array array['organizations','contacts'] loop
  execute format('drop policy member_insert on public.%I',t);
  execute format('drop policy member_update on public.%I',t);
  execute format('create policy admin_insert on public.%I for insert to authenticated with check ((select private.is_admin()))',t);
  execute format('create policy admin_update on public.%I for update to authenticated using ((select private.is_admin())) with check ((select private.is_admin()))',t);
 end loop;
end $$;
create or replace function private.record_contact(p_org uuid,p_result text,p_notes text) returns void language plpgsql security definer set search_path='' as $$
begin
 perform private.require_member(true);
 update public.organizations set contact_status=p_result where id=p_org;
 if not found then raise exception 'Organización inexistente.'; end if;
 insert into public.contacts(organization_id,result,notes,created_by) values(p_org,p_result,p_notes,auth.uid());
end $$;
