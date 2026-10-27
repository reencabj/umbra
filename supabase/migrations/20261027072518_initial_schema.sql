-- UMBRA: all money is integer pesos. Washing uses basis points, rounded half up once per order.
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create table public.profiles (
 id uuid primary key references auth.users(id), email text not null,
 role text not null check(role in ('admin','operator')), enabled boolean not null default true
);
create table public.authorized_users (
 email text primary key check(email=lower(email)), role text not null check(role in ('admin','operator')),
 enabled boolean not null default true, created_at timestamptz not null default now()
);
create table public.settings (
 id int primary key default 1 check(id=1), system_name text not null default 'UMBRA',
 washing_bps int not null default 5000 check(washing_bps between 0 and 100000),
 reset_day int not null default 1 check(reset_day between 1 and 7),
 reset_minute int not null default 0 check(reset_minute between 0 and 1439),
 timezone text not null default 'America/Argentina/Buenos_Aires' check(timezone='America/Argentina/Buenos_Aires'),
 ticket_footer text not null default 'Gracias por tu compra.', report_heading text not null default 'VENTAS',
 ticket_compact boolean not null default false, report_compact boolean not null default true
);
insert into public.settings(id) values(1);
create table public.categories (
 id uuid primary key default gen_random_uuid(), name text not null unique,
 weekly_limit int check(weekly_limit>=0), active boolean not null default true
);
create table public.products (
 id uuid primary key default gen_random_uuid(), name text not null, description text not null default '',
 category_id uuid not null references public.categories(id), image_path text,
 physical_stock int not null default 0 check(physical_stock>=0), low_stock int not null default 5 check(low_stock>=0),
 active boolean not null default true, archived boolean not null default false,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.prices (
 product_id uuid primary key references public.products(id), white bigint not null check(white between 0 and 1000000000),
 black bigint not null check(black between 0 and 1000000000), updated_at timestamptz not null default now()
);
create table public.organizations (
 id uuid primary key default gen_random_uuid(), name text not null, code text not null unique,
 contact_status text not null default 'Pendiente' check(contact_status in ('Pendiente','Contactada','No respondió','Pedido realizado','Entregada')),
 notes text not null default '', active boolean not null default true, created_at timestamptz not null default now()
);
create table public.contacts (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id),
 contact_date date not null default (now() at time zone 'America/Argentina/Buenos_Aires')::date,
 occurred_at timestamptz default now(), result text not null, notes text not null default '',
 created_by uuid references public.profiles(id), created_at timestamptz not null default now()
);
create table public.limit_exceptions (
 organization_id uuid not null references public.organizations(id), category_id uuid not null references public.categories(id),
 weekly_limit int check(weekly_limit>=0), primary key(organization_id,category_id)
);
create table public.combos (
 id uuid primary key default gen_random_uuid(), name text not null, items jsonb not null check(jsonb_typeof(items)='array'), active boolean not null default true
);
create table public.orders (
 id uuid primary key default gen_random_uuid(), number bigint generated always as identity unique,
 organization_id uuid not null references public.organizations(id), organization_name text not null,
 business_date date not null, occurred_at timestamptz, period_start timestamptz not null,
 payment text not null check(payment in ('white','black')),
 status text not null check(status in ('pending','confirmed','delivered','cancelled')),
 subtotal bigint not null default 0, washing_bps int not null default 0, washing bigint not null default 0, total bigint not null default 0,
 notes text not null default '', historical boolean not null default false, stock_exempt boolean not null default false,
 request_key uuid not null unique, import_key text unique, version int not null default 1,
 created_by uuid references public.profiles(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check(total=subtotal+washing and subtotal>=0 and washing>=0)
);
create table public.order_items (
 id uuid primary key default gen_random_uuid(), order_id uuid not null references public.orders(id),
 product_id uuid not null references public.products(id), category_id uuid not null references public.categories(id),
 product_name text not null, category_name text not null, quantity int not null check(quantity between 1 and 1000000),
 unit_price bigint not null check(unit_price>=0), unique(order_id,product_id)
);
create table public.inventory_movements (
 id uuid primary key default gen_random_uuid(), product_id uuid not null references public.products(id),
 delta int not null, balance int not null check(balance>=0), reason text not null,
 order_id uuid references public.orders(id), created_by uuid references public.profiles(id), created_at timestamptz not null default now()
);
create table public.audit_log (
 id bigint generated always as identity primary key, actor uuid, entity text not null, record_id text,
 action text not null, before_data jsonb, after_data jsonb, created_at timestamptz not null default now()
);
create index orders_org_period on public.orders(organization_id,business_date,status);
create index order_items_order on public.order_items(order_id);
create index order_items_product on public.order_items(product_id);
create index order_items_category on public.order_items(category_id);
create index contacts_org_date on public.contacts(organization_id,contact_date);
create index inventory_product on public.inventory_movements(product_id,created_at);
create index products_category on public.products(category_id);
create index exceptions_category on public.limit_exceptions(category_id);
create index orders_created_by on public.orders(created_by);
create index contacts_created_by on public.contacts(created_by);
create index inventory_order on public.inventory_movements(order_id);
create index inventory_created_by on public.inventory_movements(created_by);

create function private.is_member() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.profiles p join public.authorized_users a on a.email=lower(p.email)
 where p.id=(select auth.uid()) and p.enabled and a.enabled)
$$;
create function private.is_admin() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.profiles p join public.authorized_users a on a.email=lower(p.email)
 where p.id=(select auth.uid()) and p.enabled and a.enabled and a.role='admin')
$$;
create function private.require_member(admin_only boolean default false) returns void language plpgsql security invoker set search_path='' as $$
begin
 if auth.uid() is null or not private.is_member() or (admin_only and not private.is_admin()) then
 raise exception 'No tenés permiso para realizar esta operación.' using errcode='42501'; end if;
end $$;
create function private.new_user() returns trigger language plpgsql security definer set search_path='' as $$
declare a public.authorized_users;
begin
 select * into a from public.authorized_users where email=lower(new.email) and enabled;
 if not found then raise exception 'Correo no autorizado. Contactá al administrador.'; end if;
 insert into public.profiles(id,email,role) values(new.id,lower(new.email),a.role);
 return new;
end $$;
create trigger rp_new_user after insert on auth.users for each row execute function private.new_user();
create function private.audit() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.audit_log(actor,entity,record_id,action,before_data,after_data)
 values(auth.uid(),tg_table_name,coalesce(to_jsonb(new)->>'id',to_jsonb(old)->>'id',to_jsonb(new)->>'email'),tg_op,
 case when tg_op<>'INSERT' then to_jsonb(old) end,case when tg_op<>'DELETE' then to_jsonb(new) end);
 if tg_op='UPDATE' and tg_table_name in ('products','prices') then new.updated_at=now(); end if;
 return coalesce(new,old);
end $$;

create function public.week_start(p_at timestamptz default now()) returns timestamptz language sql stable security invoker set search_path='' as $$
 with s as (select * from public.settings where id=1), c as (
 select s.*,date_trunc('day',p_at at time zone timezone)-((extract(isodow from p_at at time zone timezone)::int-reset_day+7)%7)*interval '1 day'+reset_minute*interval '1 minute' as candidate from s)
 select (case when candidate>p_at at time zone timezone then candidate-interval '7 days' else candidate end) at time zone timezone from c
$$;
create view public.stock with (security_invoker=true) as
 select p.id,p.physical_stock,coalesce(r.reserved,0)::int as reserved,
 (p.physical_stock-coalesce(r.reserved,0))::int as available
 from public.products p left join (
 select i.product_id,sum(i.quantity) reserved from public.order_items i join public.orders o on o.id=i.order_id
 where o.status in ('pending','confirmed') and not o.stock_exempt group by i.product_id) r on r.product_id=p.id;
create view public.weekly_usage with (security_invoker=true) as
 select o.organization_id,i.category_id,sum(i.quantity)::int used
 from public.orders o join public.order_items i on i.order_id=o.id
 where o.status<>'cancelled' and coalesce(o.occurred_at,o.business_date::timestamp at time zone 'America/Argentina/Buenos_Aires')>=public.week_start()
 and coalesce(o.occurred_at,o.business_date::timestamp at time zone 'America/Argentina/Buenos_Aires')<public.week_start()+interval '7 days'
 group by o.organization_id,i.category_id;

-- One short settings-row lock serializes mutations, including different organizations sharing physical stock.
create function private.save_order(p jsonb) returns uuid language plpgsql security definer set search_path='' as $$
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
   if old.historical then raise exception 'El pedido importado solo admite anulación para conservar su información original.'; end if;
   if old.status='cancelled' then raise exception 'Un pedido anulado no puede modificarse. Duplicalo para crear otro.'; end if;
   if old.version<>(p->>'version')::int then raise exception 'El pedido cambió. Actualizá la pantalla antes de editar.'; end if;
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
    where pr.id=pid and pr.active and not pr.archived and c.active) then raise exception 'Producto no disponible.'; end if;
  select sp.physical_stock-coalesce((select sum(i.quantity) from public.order_items i join public.orders x on x.id=i.order_id
   where i.product_id=pid and x.status in ('pending','confirmed') and not x.stock_exempt and (oid is null or x.id<>oid)),0)
   into avail from public.products sp where sp.id=pid;
  if avail<qty then raise exception 'Stock insuficiente para %. Disponible: %.',(select name from public.products where id=pid),avail; end if;
 end loop;
 -- Shared category limits are checked over all valid statuses and payment methods.
 for cat in select pr.category_id,c.name,sum((j.value->>'quantity')::int) qty
  from jsonb_array_elements(items) j join public.products pr on pr.id=(j.value->>'product_id')::uuid
  join public.categories c on c.id=pr.category_id group by pr.category_id,c.name loop
  select c.weekly_limit into cap from public.categories c where c.id=cat.category_id;
  if exists(select 1 from public.limit_exceptions e where e.organization_id=org.id and e.category_id=cat.category_id) then
    select e.weekly_limit into cap from public.limit_exceptions e where e.organization_id=org.id and e.category_id=cat.category_id;
  end if;
  select coalesce(sum(i.quantity),0) into used_qty from public.order_items i join public.orders x on x.id=i.order_id
   where x.organization_id=org.id and i.category_id=cat.category_id and x.status<>'cancelled' and (oid is null or x.id<>oid)
   and coalesce(x.occurred_at,x.business_date::timestamp at time zone s.timezone)>=public.week_start(coalesce(old.occurred_at,now()))
   and coalesce(x.occurred_at,x.business_date::timestamp at time zone s.timezone)<public.week_start(coalesce(old.occurred_at,now()))+interval '7 days';
  if cap is not null and used_qty+cat.qty>cap then raise exception 'Cupo excedido en %: utilizado %, límite %.',cat.name,used_qty,cap; end if;
 end loop;
 bps:=case when pay='black' then case when old.id is not null and old.payment=pay then old.washing_bps else s.washing_bps end else 0 end;
 if oid is null then
  insert into public.orders(organization_id,organization_name,business_date,occurred_at,period_start,payment,status,washing_bps,request_key,created_by,notes)
  values(org.id,org.name,(now() at time zone s.timezone)::date,now(),public.week_start(),pay,st,bps,(p->>'request_key')::uuid,auth.uid(),coalesce(p->>'notes','')) returning id into oid;
 else
  delete from public.order_items where order_id=oid;
  update public.orders set organization_id=org.id,organization_name=org.name,payment=pay,status=st,washing_bps=bps,notes=coalesce(p->>'notes',''),version=version_value,updated_at=now() where id=oid;
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
   select oid,pr.id,pr.category_id,pr.name,c.name,qty,price_value from public.products pr join public.categories c on c.id=pr.category_id where pr.id=pid;
  sub:=sub+qty::bigint*price_value;
  if st='delivered' then
   update public.products set physical_stock=physical_stock-qty where id=pid;
   insert into public.inventory_movements(product_id,delta,balance,reason,order_id,created_by)
   select id,-qty,physical_stock,'Entrega de pedido',oid,auth.uid() from public.products where id=pid;
  end if;
 end loop;
 wash:=floor((sub::numeric*bps+5000)/10000)::bigint;
 if sub+wash>9000000000000 then raise exception 'El pedido supera el importe máximo permitido.'; end if;
 update public.orders set subtotal=sub,washing=wash,total=sub+wash where id=oid;
 update public.organizations set contact_status=case when st='delivered' then 'Entregada' else 'Pedido realizado' end where id=org.id;
 return oid;
end $$;
create function public.save_order(p jsonb) returns uuid language sql security invoker set search_path='' as $$ select private.save_order(p) $$;

create function private.cancel_order(p_id uuid,p_version int) returns void language plpgsql security definer set search_path='' as $$
declare o public.orders; line record;
begin
 perform private.require_member(); perform 1 from public.settings where id=1 for update;
 select * into o from public.orders where id=p_id for update;
 if not found then raise exception 'Pedido inexistente.'; end if;
 if o.status='cancelled' then return; end if;
 if o.version<>p_version then raise exception 'El pedido cambió. Actualizá la pantalla.'; end if;
 if o.status='delivered' and not o.stock_exempt then
  for line in select * from public.order_items where order_id=p_id loop
   update public.products set physical_stock=physical_stock+line.quantity where id=line.product_id;
   insert into public.inventory_movements(product_id,delta,balance,reason,order_id,created_by)
   select id,line.quantity,physical_stock,'Anulación de entrega',p_id,auth.uid() from public.products where id=line.product_id;
  end loop;
 end if;
 update public.orders set status='cancelled',version=version+1,updated_at=now() where id=p_id;
end $$;
create function public.cancel_order(p_id uuid,p_version int) returns void language sql security invoker set search_path='' as $$ select private.cancel_order(p_id,p_version) $$;
create function private.adjust_stock(p_id uuid,p_delta int,p_reason text) returns void language plpgsql security definer set search_path='' as $$
declare av int;
begin
 perform private.require_member(true); perform 1 from public.settings where id=1 for update;
 if p_delta=0 or length(trim(p_reason))<3 then raise exception 'Indicá una cantidad y un motivo.'; end if;
 select available into av from public.stock where id=p_id;
 if av is null or av+p_delta<0 then raise exception 'El ajuste dejaría stock disponible negativo.'; end if;
 update public.products set physical_stock=physical_stock+p_delta where id=p_id;
 insert into public.inventory_movements(product_id,delta,balance,reason,created_by)
 select id,p_delta,physical_stock,p_reason,auth.uid() from public.products where id=p_id;
end $$;
create function public.adjust_stock(p_id uuid,p_delta int,p_reason text) returns void language sql security invoker set search_path='' as $$ select private.adjust_stock(p_id,p_delta,p_reason) $$;
create function private.save_product(p jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare pid uuid:=coalesce((p->>'id')::uuid,gen_random_uuid());
begin
 perform private.require_member(true);
 insert into public.products(id,name,description,category_id,image_path,low_stock,active,archived)
 values(pid,p->>'name',coalesce(p->>'description',''),(p->>'category_id')::uuid,p->>'image_path',coalesce((p->>'low_stock')::int,5),coalesce((p->>'active')::boolean,true),coalesce((p->>'archived')::boolean,false))
 on conflict(id) do update set name=excluded.name,description=excluded.description,category_id=excluded.category_id,image_path=excluded.image_path,low_stock=excluded.low_stock,active=excluded.active,archived=excluded.archived;
 insert into public.prices(product_id,white,black) values(pid,(p->>'white')::bigint,(p->>'black')::bigint)
 on conflict(product_id) do update set white=excluded.white,black=excluded.black;
 return pid;
end $$;
create function public.save_product(p jsonb) returns uuid language sql security invoker set search_path='' as $$ select private.save_product(p) $$;

create function private.set_authorized_user(p_email text,p_role text,p_enabled boolean) returns void language plpgsql security definer set search_path='' as $$
begin
 perform private.require_member(true);
 perform 1 from public.settings where id=1 for update;
 if p_email=(select email from public.profiles where id=auth.uid()) and (p_role<>'admin' or not p_enabled) then raise exception 'No podés quitar tu propio acceso de administrador.'; end if;
 insert into public.authorized_users(email,role,enabled) values(lower(trim(p_email)),p_role,p_enabled)
 on conflict(email) do update set role=excluded.role,enabled=excluded.enabled;
 update public.profiles set role=p_role,enabled=p_enabled where email=lower(trim(p_email));
end $$;
create function public.set_authorized_user(p_email text,p_role text,p_enabled boolean) returns void language sql security invoker set search_path='' as $$ select private.set_authorized_user(p_email,p_role,p_enabled) $$;

-- RLS: no anonymous sales access; all protected writes go through checked RPCs.
revoke all on public.profiles,public.authorized_users,public.settings,public.categories,public.products,public.prices,public.organizations,public.contacts,public.limit_exceptions,public.combos,public.orders,public.order_items,public.inventory_movements,public.audit_log from anon,authenticated;
do $$ declare t text; begin
 foreach t in array array['profiles','authorized_users','settings','categories','products','prices','organizations','contacts','limit_exceptions','combos','orders','order_items','inventory_movements','audit_log'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('create policy member_read on public.%I for select to authenticated using ((select private.is_member()))',t);
  if t<>'audit_log' then
   execute format('create trigger audit_change before insert or update or delete on public.%I for each row execute function private.audit()',t);
  end if;
 end loop;
 foreach t in array array['settings','categories','limit_exceptions','combos'] loop
  execute format('create policy admin_write on public.%I for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()))',t);
  execute format('grant insert,update,delete on public.%I to authenticated',t);
 end loop;
 foreach t in array array['organizations','contacts'] loop
  execute format('create policy member_insert on public.%I for insert to authenticated with check ((select private.is_member()))',t);
  execute format('create policy member_update on public.%I for update to authenticated using ((select private.is_member())) with check ((select private.is_member()))',t);
  execute format('grant insert,update on public.%I to authenticated',t);
 end loop;
end $$;
revoke delete on public.settings from authenticated;
-- Restrict sensitive lists beyond the general member read policy.
drop policy member_read on public.authorized_users;
create policy admin_read on public.authorized_users for select to authenticated using ((select private.is_admin()));
drop policy member_read on public.audit_log;
create policy admin_read on public.audit_log for select to authenticated using ((select private.is_admin()));
grant select on public.profiles,public.authorized_users,public.settings,public.categories,public.products,public.prices,public.organizations,public.contacts,public.limit_exceptions,public.combos,public.orders,public.order_items,public.inventory_movements,public.audit_log,public.stock,public.weekly_usage to authenticated;
revoke all on all functions in schema private from public,anon;
grant execute on function private.is_member(),private.is_admin(),private.require_member(boolean),private.save_order(jsonb),private.cancel_order(uuid,int),private.adjust_stock(uuid,int,text),private.save_product(jsonb),private.set_authorized_user(text,text,boolean) to authenticated;
revoke all on function public.save_order(jsonb),public.cancel_order(uuid,int),public.adjust_stock(uuid,int,text),public.save_product(jsonb),public.set_authorized_user(text,text,boolean),public.week_start(timestamptz) from public,anon;
grant execute on function public.save_order(jsonb),public.cancel_order(uuid,int),public.adjust_stock(uuid,int,text),public.save_product(jsonb),public.set_authorized_user(text,text,boolean),public.week_start(timestamptz) to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('product-photos','product-photos',false,2097152,array['image/jpeg','image/png','image/webp']);
create policy rp_photo_read on storage.objects for select to authenticated using(bucket_id='product-photos' and (select private.is_member()));
create policy rp_photo_insert on storage.objects for insert to authenticated with check(bucket_id='product-photos' and (select private.is_admin()));
create policy rp_photo_update on storage.objects for update to authenticated using(bucket_id='product-photos' and (select private.is_admin())) with check(bucket_id='product-photos' and (select private.is_admin()));
create policy rp_photo_delete on storage.objects for delete to authenticated using(bucket_id='product-photos' and (select private.is_admin()));

-- The initial administrator is provisioned separately; personal emails are never committed.
insert into public.categories(name,weekly_limit) values('Pistolas',5),('Cargadores',15),('Balas',250),('Chalecos',15),('Placas',15);
insert into public.products(name,category_id) select v.name,c.id from (values
 ('Pistola Puissance','Pistolas'),('Pistola .50','Pistolas'),('Balas','Balas'),('Cargador Puissance','Cargadores'),('Cargador .50','Cargadores'),('Chaleco','Chalecos'),('Placa azul','Placas')) v(name,category) join public.categories c on c.name=v.category;
insert into public.prices(product_id,white,black) select p.id,v.w,v.b from (values
 ('Pistola Puissance',12500,17500),('Pistola .50',15000,21000),('Balas',60,84),('Cargador Puissance',500,700),('Cargador .50',500,700),('Chaleco',300,420),('Placa azul',2000,2800)) v(name,w,b) join public.products p on p.name=v.name;
