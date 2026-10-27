-- Unlimited UMBRA supply; category quotas remain authoritative. Historical corrections require admin.
create or replace function private.save_order(p jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare s public.settings; old public.orders; o public.orders; org public.organizations;
 oid uuid; pid uuid; line record; cat record; qty int; used_qty bigint; cap int; avail int;
 pay text:=p->>'payment'; st text:=p->>'status'; items jsonb:=p->'items'; sub bigint:=0; wash bigint; bps int;
 old_items jsonb; price_value bigint; version_value int:=1;
begin
 perform private.require_member();
 select * into s from public.settings where id=1 for update;
 if p->>'id' is null then
   select id into oid from public.orders where request_key=(p->>'request_key')::uuid;
   if found then return oid; end if;
 else
   select * into old from public.orders where id=(p->>'id')::uuid for update;
   if not found then raise exception 'Pedido inexistente.'; end if;
   if old.historical then perform private.require_member(true); end if;
   if old.status='cancelled' then raise exception 'Un pedido anulado no puede modificarse. Duplicalo para crear otro.'; end if;
   if p->>'version' is null or old.version<>(p->>'version')::int then raise exception 'El pedido cambió. Actualizá la pantalla antes de editar.'; end if;
   oid:=old.id; version_value:=old.version+1;
   select jsonb_agg(to_jsonb(i)) into old_items from public.order_items i where order_id=oid;
 end if;
 if pay not in ('white','black') or st not in ('pending','confirmed','delivered') then raise exception 'Método de pago o estado inválido.'; end if;
 if items is null or jsonb_typeof(items)<>'array' or jsonb_array_length(items)=0 or jsonb_array_length(items)>200 then raise exception 'Agregá productos al pedido.'; end if;
 if (select count(*)<>count(distinct value->>'product_id') from jsonb_array_elements(items)) then raise exception 'Productos repetidos.'; end if;
 select * into org from public.organizations where id=(p->>'organization_id')::uuid and active;
 if not found then raise exception 'Seleccioná una organización activa.'; end if;
 -- Undo delivered quantities before recalculating the replacement, within the same transaction.
 if old.status='delivered' and not old.stock_exempt then
  for line in select * from public.order_items where order_id=oid order by product_id loop
   update public.products set physical_stock=physical_stock+line.quantity where id=line.product_id;
   insert into public.inventory_movements(product_id,delta,balance,reason,order_id,created_by)
   select id,line.quantity,physical_stock,'Reversión por edición',oid,auth.uid() from public.products where id=line.product_id;
  end loop;
 end if;
 for line in select value from jsonb_array_elements(items) loop
  pid:=(line.value->>'product_id')::uuid; qty:=(line.value->>'quantity')::int;
  if qty is null or qty<1 or qty>1000000 then raise exception 'Cantidad inválida.'; end if;
  if not exists(select 1 from public.products pr join public.categories c on c.id=pr.category_id
    where pr.id=pid and pr.active and not pr.archived and c.active) and not exists(select 1 from jsonb_array_elements(coalesce(old_items,'[]')) i where i->>'product_id'=pid::text and (i->>'quantity')::int>=qty) then raise exception 'Producto no disponible.'; end if;

 end loop;
 -- Shared category limits are checked over all valid statuses and payment methods.
 for cat in select coalesce((prev.value->>'category_id')::uuid,pr.category_id) category_id,c.name,sum((j.value->>'quantity')::int) qty
  from jsonb_array_elements(items) j join public.products pr on pr.id=(j.value->>'product_id')::uuid
  left join lateral (select value from jsonb_array_elements(coalesce(old_items,'[]')) where value->>'product_id'=pr.id::text) prev on true
  join public.categories c on c.id=coalesce((prev.value->>'category_id')::uuid,pr.category_id) group by coalesce((prev.value->>'category_id')::uuid,pr.category_id),c.name loop
  select c.weekly_limit into cap from public.categories c where c.id=cat.category_id;
  if exists(select 1 from public.limit_exceptions e where e.organization_id=org.id and e.category_id=cat.category_id) then
    select e.weekly_limit into cap from public.limit_exceptions e where e.organization_id=org.id and e.category_id=cat.category_id;
  end if;
  select coalesce(sum(i.quantity),0) into used_qty from public.order_items i join public.orders x on x.id=i.order_id
   where x.organization_id=org.id and i.category_id=cat.category_id and x.status<>'cancelled' and (oid is null or x.id<>oid)
   and coalesce(x.occurred_at,x.business_date::timestamp at time zone s.timezone)>=public.week_start(coalesce(old.occurred_at,old.business_date::timestamp at time zone s.timezone,now()))
   and coalesce(x.occurred_at,x.business_date::timestamp at time zone s.timezone)<public.week_start(coalesce(old.occurred_at,old.business_date::timestamp at time zone s.timezone,now()))+interval '7 days';
  if cap is not null and used_qty+cat.qty>cap then raise exception 'Cupo excedido en %: utilizado %, límite %.',cat.name,used_qty,cap; end if;
 end loop;
 bps:=case when pay='black' then case when old.id is not null and old.payment=pay then old.washing_bps else s.washing_bps end else 0 end;
 if oid is null then
  insert into public.orders(organization_id,organization_name,business_date,occurred_at,period_start,payment,status,washing_bps,request_key,created_by,notes,stock_exempt)
  values(org.id,org.name,(now() at time zone s.timezone)::date,now(),public.week_start(),pay,st,bps,(p->>'request_key')::uuid,auth.uid(),coalesce(p->>'notes',''),true) returning id into oid;
 else
  delete from public.order_items where order_id=oid;
  update public.orders set organization_id=org.id,organization_name=org.name,payment=pay,status=st,washing_bps=bps,notes=coalesce(p->>'notes',''),version=version_value,stock_exempt=true,updated_at=now() where id=oid;
 end if;
 for line in select value from jsonb_array_elements(items) loop
  pid:=(line.value->>'product_id')::uuid; qty:=(line.value->>'quantity')::int;
  price_value:=null;
  if old.id is not null and old.payment=pay then
   select (value->>'unit_price')::bigint into price_value from jsonb_array_elements(old_items) where value->>'product_id'=pid::text;
  end if;
  if price_value is null then select case when pay='white' then white else black end into price_value from public.prices where product_id=pid; end if;
  if price_value is null then raise exception 'Producto sin precio.'; end if;
  insert into public.order_items(order_id,product_id,category_id,product_name,category_name,quantity,unit_price)
   select oid,pr.id,coalesce((prev.value->>'category_id')::uuid,pr.category_id),coalesce(prev.value->>'product_name',pr.name),coalesce(prev.value->>'category_name',c.name),qty,price_value from public.products pr join public.categories c on c.id=pr.category_id left join lateral (select value from jsonb_array_elements(coalesce(old_items,'[]')) where value->>'product_id'=pr.id::text) prev on true where pr.id=pid;
  sub:=sub+qty::bigint*price_value;

 end loop;
 wash:=floor((sub::numeric*bps+5000)/10000)::bigint;
 if sub+wash>9000000000000 then raise exception 'El pedido supera el importe máximo permitido.'; end if;
 update public.orders set subtotal=sub,washing=wash,total=sub+wash where id=oid;
 update public.organizations set contact_status=case when st='delivered' then 'Entregada' else 'Pedido realizado' end where id=org.id;
 return oid;
end $$;

create or replace function private.save_product(p jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare pid uuid:=coalesce((p->>'id')::uuid,gen_random_uuid());
begin
 perform private.require_member(true); perform 1 from public.settings where id=1 for update;
 insert into public.products(id,name,description,category_id,image_path,low_stock,active,archived)
 values(pid,p->>'name',coalesce(p->>'description',''),(p->>'category_id')::uuid,p->>'image_path',coalesce((p->>'low_stock')::int,5),coalesce((p->>'active')::boolean,true),coalesce((p->>'archived')::boolean,false))
 on conflict(id) do update set name=excluded.name,description=excluded.description,category_id=excluded.category_id,image_path=excluded.image_path,low_stock=excluded.low_stock,active=excluded.active,archived=excluded.archived;
 insert into public.prices(product_id,white,black) values(pid,(p->>'white')::bigint,(p->>'black')::bigint)
 on conflict(product_id) do update set white=excluded.white,black=excluded.black;
 return pid;
end $$;

create or replace function private.cancel_order(p_id uuid,p_version int) returns void language plpgsql security definer set search_path='' as $$
declare o public.orders; line record;
begin
 perform private.require_member(); perform 1 from public.settings where id=1 for update;
 select * into o from public.orders where id=p_id for update;
 if not found then raise exception 'Pedido inexistente.'; end if;
 if o.status='cancelled' then return; end if;
 if p_version is null or o.version<>p_version then raise exception 'El pedido cambió. Actualizá la pantalla.'; end if;
 if o.status='delivered' and not o.stock_exempt then
  for line in select * from public.order_items where order_id=p_id loop
   update public.products set physical_stock=physical_stock+line.quantity where id=line.product_id;
   insert into public.inventory_movements(product_id,delta,balance,reason,order_id,created_by)
   select id,line.quantity,physical_stock,'Anulación de entrega',p_id,auth.uid() from public.products where id=line.product_id;
  end loop;
 end if;
 update public.orders set status='cancelled',version=version+1,updated_at=now() where id=p_id;
end $$;
