-- Silent Frame Logistics pilot schema (Supabase / PostgreSQL)
-- Apply in the Supabase SQL editor. Public reads are limited to approved listings.
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  role text not null default 'buyer' check (role in ('buyer','supplier','transporter','admin')),
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;

create or replace function public.create_profile_for_new_user()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', ''));
  return new;
end;
$$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute procedure public.create_profile_for_new_user();

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.profiles(id) on delete cascade,
  name text not null check (char_length(name) between 2 and 100),
  category text not null check (category in ('Building materials','Sand & stone','Roofing','Paving','Other')),
  description text not null check (char_length(description) between 5 and 1000),
  area text not null check (area in ('Krugersdorp','Randfontein','Roodepoort','Carletonville','Other West Rand')),
  price_zar numeric(12,2) check (price_zar is null or price_zar >= 0),
  unit text not null check (char_length(unit) between 1 and 30),
  quantity numeric(12,2) check (quantity is null or quantity >= 0),
  delivery_available boolean not null default false,
  status text not null default 'pending' check (status in ('pending','active','paused','rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.products enable row level security;
create policy "Visitors read approved products" on public.products for select using (status = 'active');
create policy "Owners read their products" on public.products for select to authenticated using (seller_id = (select auth.uid()));
create policy "Signed-in users submit pending products" on public.products for insert to authenticated
  with check (seller_id = (select auth.uid()) and status = 'pending');
create policy "Owners edit their pending products" on public.products for update to authenticated
  using (seller_id = (select auth.uid()) and status = 'pending')
  with check (seller_id = (select auth.uid()) and status = 'pending');

create table if not exists public.transporters (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  business_name text not null check (char_length(business_name) between 2 and 100),
  vehicle_type text not null check (char_length(vehicle_type) between 2 and 80),
  capacity_kg integer check (capacity_kg is null or capacity_kg > 0),
  service_areas text[] not null default '{}',
  contact_phone text not null check (char_length(contact_phone) between 7 and 30),
  status text not null default 'pending' check (status in ('pending','active','paused','rejected')),
  created_at timestamptz not null default now()
);
alter table public.transporters enable row level security;
create policy "Visitors read approved transporters" on public.transporters for select using (status = 'active');
create policy "Owners read their transporter profile" on public.transporters for select to authenticated using (owner_id = (select auth.uid()));
create policy "Signed-in users submit pending transporter profiles" on public.transporters for insert to authenticated
  with check (owner_id = (select auth.uid()) and status = 'pending');
create policy "Owners edit their pending transporter profile" on public.transporters for update to authenticated
  using (owner_id = (select auth.uid()) and status = 'pending')
  with check (owner_id = (select auth.uid()) and status = 'pending');

create table if not exists public.enquiries (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references public.products(id) on delete set null,
  transporter_id uuid references public.transporters(id) on delete set null,
  kind text not null check (kind in ('product','delivery')),
  customer_name text not null check (char_length(customer_name) between 2 and 100),
  customer_email text not null check (char_length(customer_email) between 5 and 254),
  customer_phone text not null check (char_length(customer_phone) between 7 and 30),
  quantity text not null default '' check (char_length(quantity) <= 100),
  collection_area text not null default '' check (char_length(collection_area) <= 100),
  destination text not null default '' check (char_length(destination) <= 250),
  preferred_date date,
  message text not null default '' check (char_length(message) <= 2000),
  status text not null default 'new' check (status in ('new','contacted','closed','spam')),
  created_at timestamptz not null default now(),
  check ((kind = 'product' and product_id is not null) or kind = 'delivery')
);
create index if not exists products_status_area_category_idx on public.products(status, area, category);
create index if not exists transporters_status_idx on public.transporters(status);
create index if not exists enquiries_email_created_idx on public.enquiries(customer_email, created_at desc);
alter table public.enquiries enable row level security;
-- No browser role can read enquiries. The Edge Function writes with service role.
revoke all on public.enquiries from anon, authenticated;
grant select, insert, update, delete on public.products to anon, authenticated;
revoke all on public.transporters from anon, authenticated;
grant select (id,business_name,vehicle_type,capacity_kg,service_areas,status,created_at)
  on public.transporters to anon, authenticated;
grant insert (owner_id,business_name,vehicle_type,capacity_kg,service_areas,contact_phone,status)
  on public.transporters to authenticated;
grant update (business_name,vehicle_type,capacity_kg,service_areas,contact_phone)
  on public.transporters to authenticated;
grant select, insert, update, delete on public.profiles to authenticated;
revoke update on public.profiles from authenticated;
grant update (display_name) on public.profiles to authenticated;
create policy "Users read their profile" on public.profiles for select to authenticated using (id = (select auth.uid()));
create policy "Users update their display name" on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));
