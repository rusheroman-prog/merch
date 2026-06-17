-- Run in Supabase SQL editor. Adds merch handout/fulfilment features:
-- order storage location, handout status, pickup recipient, and a singleton
-- settings row for the handout deadline / place shown on the dashboard.

-- 1. New order fields ---------------------------------------------------------
alter table public.orders
  add column if not exists storage_location text,
  add column if not exists pickup_status text not null default 'pending',
  add column if not exists handed_to text,
  add column if not exists is_remote boolean not null default false,
  add column if not exists country text;

-- 2. Merch settings (singleton: deadline + place for the next handout) --------
create table if not exists public.merch_settings (
  id integer primary key default 1,
  handout_deadline timestamptz,
  handout_place text,
  handout_note text,
  updated_at timestamptz not null default now(),
  constraint merch_settings_singleton check (id = 1)
);

insert into public.merch_settings (id) values (1) on conflict (id) do nothing;

alter table public.merch_settings enable row level security;

drop policy if exists "merch_settings read" on public.merch_settings;
create policy "merch_settings read"
  on public.merch_settings
  for select
  using (true);

drop policy if exists "merch_settings admin write" on public.merch_settings;
create policy "merch_settings admin write"
  on public.merch_settings
  for all
  using (public.is_admin())
  with check (public.is_admin());

-- 3. Admin RPC to set handout fields on an order ------------------------------
--    Separate from admin_update_order so the existing status flow is untouched.
create or replace function public.admin_set_order_handout(
  p_order_id uuid,
  p_storage_location text,
  p_pickup_status text,
  p_handed_to text
)
returns public.orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders%rowtype;
begin
  if not public.is_admin() then
    raise exception 'not_admin';
  end if;

  if p_pickup_status is not null
     and p_pickup_status not in ('pending', 'packed', 'handed_owner', 'handed_other', 'refused') then
    raise exception 'invalid_pickup_status';
  end if;

  update public.orders
     set storage_location = p_storage_location,
         pickup_status    = coalesce(p_pickup_status, pickup_status),
         handed_to        = p_handed_to
   where id = p_order_id
  returning * into v_order;

  if v_order.id is null then
    raise exception 'order_not_found';
  end if;

  return v_order;
end;
$$;
