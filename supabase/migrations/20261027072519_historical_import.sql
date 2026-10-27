create function private.import_history() returns int language plpgsql security definer set search_path='' as $$
declare row_data record; orgid uuid; oid uuid; pid uuid; cid uuid; product_names text[]:=array['Pistola Puissance','Pistola .50','Cargador Puissance','Cargador .50','Balas','Chaleco','Placa azul'];
 prices bigint[]:=array[12500,15000,500,500,60,300,2000]; i int; count_imported int:=0; subtotal_value bigint;
begin
 perform private.require_member(true); perform 1 from public.settings where id=1 for update;
 for row_data in select * from (values
 ('Las Panteras',array[3,2,10,5,250,15,15],124500),('Requiem',array[0,5,0,15,250,5,10],119000),
 ('Krenak',array[3,2,10,5,250,0,15],120000),('Trinita',array[0,5,15,0,250,15,15],132000),
 ('King Crips',array[5,0,0,0,250,0,0],77500),('Families',array[5,0,15,0,250,15,15],119500),
 ('SM13',array[3,2,10,5,250,15,15],124500),('La Clicka',array[0,5,15,0,250,0,0],97500),
 ('Imperium',array[0,5,0,15,250,15,15],132000),('Silent Monarchy',array[4,1,10,5,250,0,0],87500)) v(name,quantities,expected) loop
  if exists(select 1 from public.orders where import_key='2026-10-27:'||row_data.name) then continue; end if;
  insert into public.organizations(name,code,contact_status) values(row_data.name,upper(replace(row_data.name,' ','-')),'Entregada')
   on conflict(code) do update set code=excluded.code returning id into orgid;
  insert into public.orders(organization_id,organization_name,business_date,occurred_at,period_start,payment,status,historical,stock_exempt,request_key,import_key,created_by)
  values(orgid,row_data.name,'2026-10-27',null,public.week_start('2026-10-27 03:00:00+00'),'white','delivered',true,true,gen_random_uuid(),'2026-10-27:'||row_data.name,auth.uid()) returning id into oid;
  subtotal_value:=0;
  for i in 1..7 loop
   if row_data.quantities[i]=0 then continue; end if;
   select id,category_id into pid,cid from public.products where name=product_names[i] order by created_at limit 1;
   if pid is null then raise exception 'Falta el producto histórico %.',product_names[i]; end if;
   insert into public.order_items(order_id,product_id,category_id,product_name,category_name,quantity,unit_price)
   select oid,pid,cid,product_names[i],name,row_data.quantities[i],prices[i] from public.categories where id=cid;
   subtotal_value:=subtotal_value+row_data.quantities[i]*prices[i];
  end loop;
  if subtotal_value<>row_data.expected then raise exception 'El total histórico no coincide para %.',row_data.name; end if;
  update public.orders set subtotal=subtotal_value,total=subtotal_value where id=oid;
  count_imported:=count_imported+1;
 end loop;
 for row_data in select unnest(array['Reds Rows','Rust','Legacy']) name loop
  insert into public.organizations(name,code,contact_status) values(row_data.name,upper(replace(row_data.name,' ','-')),'No respondió')
  on conflict(code) do update set code=excluded.code returning id into orgid;
  if not exists(select 1 from public.contacts where organization_id=orgid and contact_date='2026-10-27' and result='No respondió') then
   insert into public.contacts(organization_id,contact_date,occurred_at,result,created_by) values(orgid,'2026-10-27',null,'No respondió',auth.uid());
  end if;
 end loop;
 return count_imported;
end $$;
create function public.import_history() returns int language sql security invoker set search_path='' as $$ select private.import_history() $$;
revoke all on function private.import_history(),public.import_history() from public,anon;
grant execute on function private.import_history(),public.import_history() to authenticated;

create function private.record_contact(p_org uuid,p_result text,p_notes text) returns void language plpgsql security definer set search_path='' as $$
begin
 perform private.require_member();
 update public.organizations set contact_status=p_result where id=p_org;
 if not found then raise exception 'Organización inexistente.'; end if;
 insert into public.contacts(organization_id,result,notes,created_by) values(p_org,p_result,p_notes,auth.uid());
end $$;
create function public.record_contact(p_org uuid,p_result text,p_notes text) returns void language sql security invoker set search_path='' as $$ select private.record_contact(p_org,p_result,p_notes) $$;
revoke all on function private.record_contact(uuid,text,text),public.record_contact(uuid,text,text) from public,anon;
grant execute on function private.record_contact(uuid,text,text),public.record_contact(uuid,text,text) to authenticated;
