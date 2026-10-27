-- Runs entirely inside a transaction: safe against a new UMBRA database as well as PGlite.
begin;
create function pg_temp.assert_ok(ok boolean,message text) returns void language plpgsql as $$ begin if ok is distinct from true then raise exception 'TEST FAILED: %',message;end if;end $$;
insert into public.authorized_users(email,role) values('test-admin@example.invalid','admin'),('test-operator@example.invalid','operator');
insert into auth.users(id,email) values('11111111-1111-4111-8111-111111111111','test-admin@example.invalid'),('22222222-2222-4222-8222-222222222222','test-operator@example.invalid');
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
set local role authenticated;
select pg_temp.assert_ok(private.is_admin(),'admin authorization');
select pg_temp.assert_ok(public.week_start('2026-10-26 02:59:59+00')='2026-10-19 03:00:00+00','Sunday before midnight Argentina');
select pg_temp.assert_ok(public.week_start('2026-10-26 03:00:00+00')='2026-10-26 03:00:00+00','Monday reset Argentina');
create temporary table test_baseline as select (select coalesce(sum(physical_stock),0) from public.products) stock, (select count(*) from public.inventory_movements) movements;
select public.import_history();
select pg_temp.assert_ok((select sum(total)=1134000 from public.orders where import_key like '2026-10-27:%'),'historical total');
select pg_temp.assert_ok((select count(*)=10 and count(occurred_at)=0 from public.orders where historical),'no invented historical times');
select pg_temp.assert_ok(public.import_history()=0,'idempotent import');
select pg_temp.assert_ok((select count(*)=3 from public.contacts where occurred_at is null and contact_date='2026-10-27'),'historical contacts');
select pg_temp.assert_ok((select sum(physical_stock)=(select stock from test_baseline) from public.products),'historical import does not change stock');
do $$ declare o public.orders; p uuid; begin
 select * into o from public.orders where historical order by number limit 1;
 select product_id into p from public.order_items where order_id=o.id limit 1;
 perform public.save_order(jsonb_build_object('id',o.id,'version',o.version,'organization_id',o.organization_id,'payment','white','status','delivered','items',jsonb_build_array(jsonb_build_object('product_id',p,'quantity',1))));
 perform pg_temp.assert_ok((select occurred_at is null and business_date='2026-10-27' and stock_exempt and historical from public.orders where id=o.id),'historical correction preserves date without invented time');
 perform pg_temp.assert_ok((select count(*)=10 from public.orders where historical),'historical edit replaces, never duplicates');
 perform pg_temp.assert_ok(public.import_history()=0,'reimport never duplicates corrected history');
end $$;
insert into public.organizations(id,name,code) values('33333333-3333-4333-8333-333333333333','TEST ORGANIZATION','__TEST__');
-- No initial warehouse inventory is needed: UMBRA supply is unlimited.
do $$ declare a uuid; b uuid; oid uuid; oid2 uuid; rec public.orders; payload jsonb; blocked boolean:=false;
begin
 select id into a from public.products where name='Pistola Puissance'; select id into b from public.products where name='Pistola .50';
 payload:=jsonb_build_object('request_key',gen_random_uuid(),'organization_id','33333333-3333-4333-8333-333333333333','payment','white','status','pending','items',jsonb_build_array(jsonb_build_object('product_id',a,'quantity',3),jsonb_build_object('product_id',b,'quantity',2)));
 oid:=public.save_order(payload); select * into rec from public.orders where id=oid;
 perform pg_temp.assert_ok(rec.total=67500 and rec.washing=0,'white price');
 perform pg_temp.assert_ok(public.save_order(payload)=oid,'double submit is idempotent');
 perform pg_temp.assert_ok((select physical_stock=0 and reserved=0 from public.stock where id=a),'pending consumes only organization quota');
 begin perform public.save_order(jsonb_build_object('request_key',gen_random_uuid(),'organization_id','33333333-3333-4333-8333-333333333333','payment','black','status','confirmed','items',jsonb_build_array(jsonb_build_object('product_id',b,'quantity',1))));exception when others then blocked:=sqlerrm like 'Cupo excedido%';end;
 perform pg_temp.assert_ok(blocked,'shared and accumulated category limits across payment methods');
 -- Delivery preserves original prices and consumes physical stock exactly once.
 perform public.save_order(payload||jsonb_build_object('id',oid,'version',rec.version,'status','delivered'));
 perform pg_temp.assert_ok((select physical_stock=0 and reserved=0 from public.stock where id=a),'delivery does not affect UMBRA supply');
 select * into rec from public.orders where id=oid;
 perform public.cancel_order(oid,rec.version);perform public.cancel_order(oid,rec.version);
 perform pg_temp.assert_ok((select physical_stock=0 from public.stock where id=a),'cancellation leaves unlimited supply unchanged');
 oid2:=public.save_order(jsonb_build_object('request_key',gen_random_uuid(),'organization_id','33333333-3333-4333-8333-333333333333','payment','black','status','confirmed','items',jsonb_build_array(jsonb_build_object('product_id',a,'quantity',1))));
 select * into rec from public.orders where id=oid2;
 perform pg_temp.assert_ok(rec.subtotal=17500 and rec.washing=8750 and rec.total=26250,'black washing exactly once');
 perform public.save_product((select to_jsonb(p)||jsonb_build_object('white',99999,'black',88888) from public.products p where id=a));
 perform pg_temp.assert_ok((select unit_price=17500 from public.order_items where order_id=oid2),'historical price after catalog change');
 payload:=jsonb_build_object('id',oid2,'version',rec.version,'organization_id','33333333-3333-4333-8333-333333333333','payment','black','status','confirmed','items',jsonb_build_array(jsonb_build_object('product_id',a,'quantity',2)));
 perform public.save_order(payload);
 perform pg_temp.assert_ok((select total=52500 and washing_bps=5000 from public.orders where id=oid2),'edit retains original price and washing');
 perform pg_temp.assert_ok((select count(*)=2 from public.orders where organization_id='33333333-3333-4333-8333-333333333333'),'edit does not create additional order');
 blocked:=false;begin perform public.save_order(payload);exception when others then blocked:=sqlerrm like 'El pedido cambió%';end;
 perform pg_temp.assert_ok(blocked,'stale edit rejected');
 select * into rec from public.orders where id=oid2;perform public.cancel_order(oid2,rec.version);
end $$;
-- Test category exceptions, inventory deficit, dynamic products, and half-up rounding.
do $$ declare c uuid; p uuid; oid uuid; blocked boolean:=false; begin
 insert into public.categories(name,weekly_limit) values('__TEST CATEGORY__',1) returning id into c;
 p:=public.save_product(jsonb_build_object('name','__TEST PRODUCT__','category_id',c,'white',1,'black',1,'low_stock',2));

 insert into public.limit_exceptions(organization_id,category_id,weekly_limit) values('33333333-3333-4333-8333-333333333333',c,null);
 oid:=public.save_order(jsonb_build_object('request_key',gen_random_uuid(),'organization_id','33333333-3333-4333-8333-333333333333','payment','black','status','confirmed','items',jsonb_build_array(jsonb_build_object('product_id',p,'quantity',3))));
 perform pg_temp.assert_ok((select total=5 and washing=2 from public.orders where id=oid),'half-up round once per subtotal');
 perform public.save_order(jsonb_build_object('request_key',gen_random_uuid(),'organization_id','33333333-3333-4333-8333-333333333333','payment','white','status','delivered','items',jsonb_build_array(jsonb_build_object('product_id',p,'quantity',1000))));
 perform pg_temp.assert_ok((select physical_stock=0 from public.products where id=p),'unlimited delivery succeeds with zero physical stock');
 perform pg_temp.assert_ok((select count(*)=(select movements from test_baseline) from public.inventory_movements),'sales generate no warehouse movements');
end $$;
reset role;
-- Ensure historical records do not consume later weeks (compute with same range predicate as live view).
select pg_temp.assert_ok((select count(*)=0 from public.orders where historical and coalesce(occurred_at,business_date::timestamp at time zone 'America/Argentina/Buenos_Aires')>=public.week_start('2026-11-02 03:00+00')),'history does not consume future weeks');
select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true);
set local role authenticated;
select pg_temp.assert_ok(private.is_member() and not private.is_admin(),'operator role');
do $$declare blocked boolean:=false;begin
 begin perform public.adjust_stock((select id from public.products limit 1),1,'Unauthorized');exception when insufficient_privilege then blocked:=true;end;
 perform pg_temp.assert_ok(blocked,'operator cannot mutate inventory');
 blocked:=false;begin perform public.import_history();exception when insufficient_privilege then blocked:=true;end;
 perform pg_temp.assert_ok(blocked,'operator cannot import');
 perform pg_temp.assert_ok((select count(*)=0 from public.authorized_users),'operator cannot read user authorization list');
end $$;
reset role;
update public.authorized_users set enabled=false where email='test-operator@example.invalid';
set local role authenticated;
select pg_temp.assert_ok(not private.is_member(),'immediate revocation even with stale JWT');
select pg_temp.assert_ok((select count(*)=0 from public.orders),'revoked user cannot read sales');
reset role;
select set_config('request.jwt.claim.sub','',true);
set local role anon;
do $$ declare blocked boolean:=false;begin
 begin perform count(*) from public.orders;exception when insufficient_privilege then blocked:=true;end;
 perform pg_temp.assert_ok(blocked,'anonymous sales access denied');
 blocked:=false;begin perform public.save_order('{}');exception when insufficient_privilege then blocked:=true;end;
 perform pg_temp.assert_ok(blocked,'anonymous RPC denied');
end $$;
reset role;
select 'ALL DATABASE ASSERTIONS PASSED' as result;
rollback;
