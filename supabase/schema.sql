-- Run once in a new Supabase project's SQL editor. Only public/anon-safe keys belong in the browser.
create extension if not exists pgcrypto;
create table public.restaurant_settings(id uuid primary key default gen_random_uuid(), name text not null, data jsonb not null);
create table public.restaurant_members(restaurant_id uuid not null references public.restaurant_settings(id) on delete cascade, user_id uuid not null references auth.users(id) on delete cascade, role text not null default 'admin' check(role='admin'), primary key(restaurant_id,user_id), unique(user_id));
create table public.categories(id uuid primary key default gen_random_uuid(),restaurant_id uuid not null references public.restaurant_settings(id),name text not null check(length(trim(name)) between 1 and 80),unique(restaurant_id,name),unique(id,restaurant_id));
create table public.products(id uuid primary key default gen_random_uuid(),restaurant_id uuid not null references public.restaurant_settings(id),category_id uuid not null,name text not null check(length(trim(name)) between 1 and 120),price_cents bigint not null check(price_cents between 1 and 1000000000),cost_cents bigint check(cost_cents between 0 and 1000000000),description text not null default '' check(length(description)<=1000),image text not null default '',available boolean not null default true,archived boolean not null default false,foreign key(category_id,restaurant_id) references public.categories(id,restaurant_id));
create table public.transactions(id uuid primary key default gen_random_uuid(),restaurant_id uuid not null references public.restaurant_settings(id),request_id uuid not null,number text not null,created_at timestamptz not null default now(),currency text not null,customer jsonb not null, payment_method text not null,status text not null default 'Completed' check(status='Completed'),subtotal_cents bigint not null check(subtotal_cents>=0),discount_cents bigint not null check(discount_cents>=0),service_cents bigint not null check(service_cents>=0),tax_cents bigint not null check(tax_cents>=0),total_cents bigint not null check(total_cents>=0),revenue_cents bigint not null check(revenue_cents>=0),received_cents bigint not null check(received_cents>=total_cents),change_cents bigint not null check(change_cents=received_cents-total_cents),receipt_snapshot jsonb not null,unique(restaurant_id,request_id),unique(restaurant_id,number),unique(id,restaurant_id));
alter table public.transactions add column business_date date not null default current_date;
create table public.transaction_items(id uuid primary key default gen_random_uuid(),restaurant_id uuid not null,transaction_id uuid not null,product_id uuid,name text not null,category text not null,price_cents bigint not null check(price_cents>=0),cost_cents bigint,quantity integer not null check(quantity between 1 and 999),notes text not null default '',foreign key(transaction_id,restaurant_id) references public.transactions(id,restaurant_id));
create table public.income(id uuid primary key default gen_random_uuid(),restaurant_id uuid not null references public.restaurant_settings(id),title text not null check(length(trim(title)) between 1 and 150),amount_cents bigint not null check(amount_cents>=0),date date not null,payment_method text not null,description text not null default '' check(length(description)<=2000),source text not null check(source in ('POS SALE','MANUAL INCOME')),transaction_id uuid unique,currency text not null,foreign key(transaction_id,restaurant_id) references public.transactions(id,restaurant_id),check((source='POS SALE' and transaction_id is not null) or (source='MANUAL INCOME' and transaction_id is null and amount_cents>0)));
create table public.expenses(id uuid primary key default gen_random_uuid(),restaurant_id uuid not null references public.restaurant_settings(id),title text not null check(length(trim(title)) between 1 and 150),category text not null,amount_cents bigint not null check(amount_cents between 1 and 1000000000),date date not null,payment_method text not null,description text not null default '' check(length(description)<=2000),image text not null default '',currency text not null);
create table public.receipts(token uuid primary key default gen_random_uuid(),restaurant_id uuid not null,transaction_id uuid not null unique,snapshot jsonb not null,foreign key(transaction_id,restaurant_id) references public.transactions(id,restaurant_id));
create table public.invoice_sequences(restaurant_id uuid not null references public.restaurant_settings(id),day date not null,value integer not null,primary key(restaurant_id,day));
create index transactions_restaurant_time on public.transactions(restaurant_id,created_at desc);
create index income_restaurant_date on public.income(restaurant_id,date);
create index expenses_restaurant_date on public.expenses(restaurant_id,date);

create function public.is_restaurant_admin(p_id uuid) returns boolean language sql stable security definer set search_path=public as $$select exists(select 1 from public.restaurant_members where restaurant_id=p_id and user_id=auth.uid() and role='admin')$$;
revoke all on function public.is_restaurant_admin(uuid) from public;grant execute on function public.is_restaurant_admin(uuid) to authenticated;
alter table public.restaurant_settings enable row level security;
alter table public.restaurant_members enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.transactions enable row level security;
alter table public.transaction_items enable row level security;
alter table public.income enable row level security;
alter table public.expenses enable row level security;
alter table public.receipts enable row level security;
alter table public.invoice_sequences enable row level security;
create policy member_self on public.restaurant_members for select to authenticated using(user_id=auth.uid());
create policy settings_read on public.restaurant_settings for select to authenticated using(public.is_restaurant_admin(id));
create policy settings_update on public.restaurant_settings for update to authenticated using(public.is_restaurant_admin(id)) with check(public.is_restaurant_admin(id));
create policy categories_admin on public.categories for all to authenticated using(public.is_restaurant_admin(restaurant_id)) with check(public.is_restaurant_admin(restaurant_id));
create policy products_admin on public.products for all to authenticated using(public.is_restaurant_admin(restaurant_id)) with check(public.is_restaurant_admin(restaurant_id));
create policy expenses_admin on public.expenses for all to authenticated using(public.is_restaurant_admin(restaurant_id)) with check(public.is_restaurant_admin(restaurant_id));
create policy transaction_read on public.transactions for select to authenticated using(public.is_restaurant_admin(restaurant_id));
create policy items_read on public.transaction_items for select to authenticated using(public.is_restaurant_admin(restaurant_id));
create policy income_read on public.income for select to authenticated using(public.is_restaurant_admin(restaurant_id));
create policy manual_income_insert on public.income for insert to authenticated with check(public.is_restaurant_admin(restaurant_id) and source='MANUAL INCOME' and transaction_id is null);
create policy manual_income_update on public.income for update to authenticated using(public.is_restaurant_admin(restaurant_id) and source='MANUAL INCOME') with check(public.is_restaurant_admin(restaurant_id) and source='MANUAL INCOME' and transaction_id is null);
create policy manual_income_delete on public.income for delete to authenticated using(public.is_restaurant_admin(restaurant_id) and source='MANUAL INCOME');
-- No anonymous table policies. Receipts are available only by their random token through a restricted RPC.
revoke all on public.restaurant_settings,public.restaurant_members,public.categories,public.products,public.transactions,public.transaction_items,public.income,public.expenses,public.receipts,public.invoice_sequences from anon;
grant select on public.restaurant_settings,public.restaurant_members,public.categories,public.products,public.transactions,public.transaction_items,public.income,public.expenses to authenticated;
grant insert,update,delete on public.categories,public.products,public.income,public.expenses to authenticated;
grant update on public.restaurant_settings to authenticated;

create function public.valid_settings(s jsonb) returns boolean language plpgsql stable set search_path=public as $$
begin
 if jsonb_typeof(s)<>'object' or coalesce(length(trim(s->>'name')),0) not between 1 and 100 or coalesce(s->>'currency','') !~ '^[A-Z]{3}$' then return false;end if;
 if coalesce((s->>'taxRate')::numeric,-1) not between 0 and 100 or coalesce((s->>'serviceRate')::numeric,-1) not between 0 and 100 then return false;end if;
 if s->>'timeZone' is not null and not exists(select 1 from pg_timezone_names where name=s->>'timeZone') then return false;end if;
 if jsonb_typeof(s->'payments')<>'array' or jsonb_array_length(s->'payments') not between 1 and 20 then return false;end if;
 if exists(select 1 from jsonb_array_elements_text(s->'payments') p where length(trim(p)) not between 1 and 40) then return false;end if;
 if (select count(*) from jsonb_array_elements_text(s->'payments'))<>(select count(distinct p) from jsonb_array_elements_text(s->'payments') p) then return false;end if;
 return true;
exception when others then return false;
end $$;
alter table public.restaurant_settings add constraint settings_valid check(public.valid_settings(data));
create function public.create_restaurant(p_settings jsonb,p_categories jsonb,p_products jsonb) returns uuid language plpgsql security definer set search_path=public as $$
declare r uuid; c jsonb; p jsonb;
begin
 if auth.uid() is null then raise exception 'Sign in first.';end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,0));
 select restaurant_id into r from public.restaurant_members where user_id=auth.uid();if r is not null then return r;end if;
 if not public.valid_settings(p_settings) then raise exception 'Invalid restaurant settings.';end if;
 if jsonb_array_length(p_categories)>100 or jsonb_array_length(p_products)>500 then raise exception 'Starter menu is too large.';end if;
 insert into public.restaurant_settings(name,data) values(p_settings->>'name',p_settings) returning id into r;
 insert into public.restaurant_members(restaurant_id,user_id) values(r,auth.uid());
 for c in select * from jsonb_array_elements(p_categories) loop insert into public.categories(id,restaurant_id,name) values((c->>'id')::uuid,r,c->>'name');end loop;
 for p in select * from jsonb_array_elements(p_products) loop insert into public.products(id,restaurant_id,category_id,name,price_cents,cost_cents,description,image,available,archived) values((p->>'id')::uuid,r,(p->>'categoryId')::uuid,p->>'name',(p->>'priceCents')::bigint,(p->>'costCents')::bigint,coalesce(p->>'description',''),coalesce(p->>'image',''),true,false);end loop;
 return r;
end $$;
revoke all on function public.create_restaurant(jsonb,jsonb,jsonb) from public;grant execute on function public.create_restaurant(jsonb,jsonb,jsonb) to authenticated;

create function public.complete_sale(p_restaurant uuid,p_input jsonb) returns jsonb language plpgsql security definer set search_path=public as $$
declare s jsonb;line jsonb; product public.products%rowtype;old public.transactions%rowtype; items jsonb:='[]';safe_items jsonb:='[]'; cust jsonb; q integer;sub bigint:=0;disc bigint;svc bigint;tax bigint;total bigint;revenue bigint;received bigint;change bigint;discount numeric;method text;kind text;request uuid;tid uuid:=gen_random_uuid();token uuid:=gen_random_uuid();stamp timestamptz:=now();business_day date;seq integer;invoice text;receipt jsonb;result jsonb;cat text;
begin
 if not public.is_restaurant_admin(p_restaurant) then raise exception 'Restaurant admin access required.';end if;
 request:=(p_input->>'requestId')::uuid;if request is null then raise exception 'A request ID is required.';end if;
 -- Serialize checkout requests per restaurant. Retries with the same request return the original sale.
 perform pg_advisory_xact_lock(hashtextextended(p_restaurant::text,1));
 select * into old from public.transactions where restaurant_id=p_restaurant and request_id=request;
 if old.id is not null then select coalesce(jsonb_agg(jsonb_build_object('productId',product_id,'name',name,'category',category,'priceCents',price_cents,'costCents',cost_cents,'quantity',quantity,'notes',notes)),'[]') into items from public.transaction_items where transaction_id=old.id;return to_jsonb(old)||jsonb_build_object('items',items);end if;
 select data into s from public.restaurant_settings where id=p_restaurant for update;
 method:=p_input->>'paymentMethod';if not (s->'payments' ? method) then raise exception 'Choose an enabled payment method.';end if;
 if jsonb_typeof(p_input->'lines')<>'array' or jsonb_array_length(p_input->'lines') not between 1 and 100 then raise exception 'Add between 1 and 100 items.';end if;
 for line in select * from jsonb_array_elements(p_input->'lines') loop
  select * into product from public.products where id=(line->>'productId')::uuid and restaurant_id=p_restaurant and available and not archived for share;
  if product.id is null then raise exception 'A product is no longer available.';end if;
  if (line->>'quantity')::numeric<>trunc((line->>'quantity')::numeric) then raise exception 'Quantity must be a whole number.';end if;
  q:=(line->>'quantity')::integer;if q is null or q not between 1 and 999 then raise exception 'Invalid quantity.';end if;
  select name into cat from public.categories where id=product.category_id and restaurant_id=p_restaurant;
  sub:=sub+product.price_cents*q;
  items:=items||jsonb_build_array(jsonb_build_object('productId',product.id,'name',product.name,'category',cat,'priceCents',product.price_cents,'costCents',product.cost_cents,'quantity',q,'notes',left(coalesce(line->>'notes',''),500)));
  safe_items:=safe_items||jsonb_build_array(jsonb_build_object('name',product.name,'priceCents',product.price_cents,'quantity',q,'notes',left(coalesce(line->>'notes',''),500)));
 end loop;
 kind:=p_input->>'discountKind';discount:=(p_input->>'discountValue')::numeric;if discount is null or discount<0 or kind not in ('amount','percent') or (kind='percent' and discount>100) then raise exception 'Invalid discount.';end if;
 disc:=case when kind='percent' then round(sub*discount/100) else round(discount*100) end;if disc>sub then raise exception 'Discount cannot exceed the subtotal.';end if;
 svc:=round((sub-disc)*(s->>'serviceRate')::numeric/100);revenue:=sub-disc+svc;tax:=round(revenue*(s->>'taxRate')::numeric/100);total:=revenue+tax;
 received:=case when method='Cash' then (p_input->>'receivedCents')::bigint else total end;if received is null or received<total then raise exception 'Amount received is less than the order total.';end if;change:=received-total;
 cust:=jsonb_build_object('name',left(coalesce(p_input->'customer'->>'name',''),100),'phone',left(coalesce(p_input->'customer'->>'phone',''),40),'email',left(coalesce(p_input->'customer'->>'email',''),150),'table',left(coalesce(p_input->'customer'->>'table',''),30),'notes',left(coalesce(p_input->>'orderNotes',''),1000));
 if cust->>'email'<>'' and cust->>'email' !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'Enter a valid customer email address.';end if;
 business_day:=(stamp at time zone coalesce(s->>'timeZone','UTC'))::date;
 insert into public.invoice_sequences(restaurant_id,day,value) values(p_restaurant,business_day,1) on conflict(restaurant_id,day) do update set value=invoice_sequences.value+1 returning value into seq;
 invoice:='INV-'||to_char(business_day,'YYYYMMDD')||'-'||lpad(seq::text,4,'0');
 receipt:=jsonb_build_object('token',token,'number',invoice,'createdAt',stamp,'currency',s->>'currency','restaurant',s-'payments'-'currency','items',safe_items,'customerName',cust->>'name','table',cust->>'table','notes',cust->>'notes','paymentMethod',method,'receivedCents',received,'changeCents',change,'subtotalCents',sub,'discountCents',disc,'serviceCents',svc,'taxCents',tax,'totalCents',total,'revenueCents',revenue,'demo',false);
 insert into public.transactions(id,restaurant_id,request_id,number,created_at,business_date,currency,customer,payment_method,subtotal_cents,discount_cents,service_cents,tax_cents,total_cents,revenue_cents,received_cents,change_cents,receipt_snapshot) values(tid,p_restaurant,request,invoice,stamp,business_day,s->>'currency',cust,method,sub,disc,svc,tax,total,revenue,received,change,receipt);
 for line in select * from jsonb_array_elements(items) loop insert into public.transaction_items(restaurant_id,transaction_id,product_id,name,category,price_cents,cost_cents,quantity,notes) values(p_restaurant,tid,(line->>'productId')::uuid,line->>'name',line->>'category',(line->>'priceCents')::bigint,(line->>'costCents')::bigint,(line->>'quantity')::integer,line->>'notes');end loop;
 insert into public.income(restaurant_id,title,amount_cents,date,payment_method,description,source,transaction_id,currency) values(p_restaurant,'Sale '||invoice,revenue,business_day,method,'Automatically recorded from POS. Sales tax is excluded.','POS SALE',tid,s->>'currency');
 insert into public.receipts(token,restaurant_id,transaction_id,snapshot) values(token,p_restaurant,tid,receipt);
 select to_jsonb(t) into result from public.transactions t where id=tid;return result||jsonb_build_object('items',items);
end $$;
revoke all on function public.complete_sale(uuid,jsonb) from public;grant execute on function public.complete_sale(uuid,jsonb) to authenticated;
create function public.get_public_receipt(p_token uuid) returns jsonb language sql stable security definer set search_path=public as $$select snapshot from public.receipts where token=p_token$$;
revoke all on function public.get_public_receipt(uuid) from public;grant execute on function public.get_public_receipt(uuid) to anon,authenticated;

-- Product photos and logos are public; expense evidence stays private.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('bistro-public','bistro-public',true,8388608,array['image/webp','image/jpeg','image/png']),('bistro-private','bistro-private',false,8388608,array['image/webp','image/jpeg','image/png']) on conflict(id) do nothing;
create policy public_menu_images on storage.objects for select to anon,authenticated using(bucket_id='bistro-public');
create policy private_expense_images on storage.objects for select to authenticated using(bucket_id='bistro-private' and public.is_restaurant_admin((storage.foldername(name))[1]::uuid));
create policy image_insert on storage.objects for insert to authenticated with check(bucket_id in ('bistro-public','bistro-private') and public.is_restaurant_admin((storage.foldername(name))[1]::uuid));
create policy image_update on storage.objects for update to authenticated using(bucket_id in ('bistro-public','bistro-private') and public.is_restaurant_admin((storage.foldername(name))[1]::uuid)) with check(bucket_id in ('bistro-public','bistro-private') and public.is_restaurant_admin((storage.foldername(name))[1]::uuid));
create policy image_delete on storage.objects for delete to authenticated using(bucket_id in ('bistro-public','bistro-private') and public.is_restaurant_admin((storage.foldername(name))[1]::uuid));
