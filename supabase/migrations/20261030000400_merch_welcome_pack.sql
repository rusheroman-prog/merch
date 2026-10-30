-- Welcome pack по спецссылке (правка #4).
-- Онбординг-менеджер создаёт приглашение на email новичка и отправляет ссылку
-- /w/<token>. По ней видны только товары welcome-пака, правило «стаж ≥ 3 мес.»
-- не действует, ссылка одноразовая и привязана к email.
-- Запустить в Supabase SQL Editor. Без миграции обычный каталог работает как раньше.

-- 1. Где показывать товар: обычный каталог, welcome pack или оба --------------
alter table public.products
  add column if not exists audience text not null default 'catalog';

alter table public.products
  drop constraint if exists products_audience_check;
alter table public.products
  add constraint products_audience_check
  check (audience in ('catalog', 'welcome', 'both'));

-- 2. Пометка welcome-заказа --------------------------------------------------
alter table public.orders
  add column if not exists is_welcome boolean not null default false;

-- 3. Приглашения --------------------------------------------------------------
create table if not exists public.welcome_invites (
  id            uuid primary key default gen_random_uuid(),
  token         text not null unique default replace(gen_random_uuid()::text, '-', ''),
  email         text not null,
  full_name     text,
  note          text,
  created_by    uuid references public.employees(id),
  created_at    timestamptz not null default now(),
  expires_at    timestamptz not null default now() + interval '30 days',
  used_at       timestamptz,
  used_order_id uuid references public.orders(id)
);

create index if not exists welcome_invites_email_idx on public.welcome_invites (lower(email));

alter table public.welcome_invites enable row level security;

drop policy if exists "Admins manage welcome invites" on public.welcome_invites;
create policy "Admins manage welcome invites"
  on public.welcome_invites
  for all
  using (public.is_admin())
  with check (public.is_admin());

-- 4. Статус приглашения для текущего пользователя ------------------------------
create or replace function public.get_welcome_invite(p_token text)
returns table (status text, order_number text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_invite public.welcome_invites%rowtype;
  v_email  text;
  v_number text;
begin
  select email into v_email from public.employees where id = auth.uid();
  select * into v_invite from public.welcome_invites where token = p_token;

  if v_invite.id is null then
    return query select 'not_found'::text, null::text; return;
  end if;

  if v_invite.used_at is not null then
    select o.order_number::text into v_number from public.orders o where o.id = v_invite.used_order_id;
    return query select 'used'::text, v_number; return;
  end if;

  if v_invite.expires_at < now() then
    return query select 'expired'::text, null::text; return;
  end if;

  if v_email is null or lower(v_email) <> lower(v_invite.email) then
    return query select 'wrong_email'::text, null::text; return;
  end if;

  return query select 'ok'::text, null::text;
end;
$$;

grant execute on function public.get_welcome_invite(text) to authenticated;

-- 5. Оформление welcome-заказа ----------------------------------------------
create or replace function public.create_welcome_order(
  p_token text,
  p_items jsonb,
  p_delivery_type public.delivery_type,
  p_delivery_address text,
  p_phone text,
  p_comment text,
  p_is_remote boolean,
  p_country text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_employee public.employees%rowtype;
  v_invite   public.welcome_invites%rowtype;
  v_order    public.orders%rowtype;
  v_unique_products integer;
  v_total_items integer;
  v_item record;
begin
  select * into v_employee from public.employees where id = auth.uid();
  if v_employee.id is null then
    raise exception 'employee_not_found';
  end if;

  select * into v_invite
    from public.welcome_invites
   where token = p_token
   for update;

  if v_invite.id is null then
    raise exception 'welcome_invite_not_found';
  end if;
  if v_invite.used_at is not null then
    raise exception 'welcome_invite_used';
  end if;
  if v_invite.expires_at < now() then
    raise exception 'welcome_invite_expired';
  end if;
  if lower(v_invite.email) <> lower(v_employee.email) then
    raise exception 'welcome_invite_wrong_email';
  end if;

  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'cart_is_empty';
  end if;

  if exists (
    select 1 from jsonb_array_elements(p_items) item
     where coalesce((item->>'qty')::int, 0) <> 1
  ) then
    raise exception 'one_unit_per_product_only';
  end if;

  -- Только активные товары welcome-пака.
  select count(*), count(distinct pv.product_id)
    into v_total_items, v_unique_products
    from jsonb_array_elements(p_items) item
    join public.product_variants pv on pv.id = (item->>'variant_id')::uuid
    join public.products p on p.id = pv.product_id
   where pv.is_active = true
     and p.is_active = true
     and p.audience in ('welcome', 'both');

  if v_total_items <> jsonb_array_length(p_items) then
    raise exception 'product_is_not_available';
  end if;

  if v_unique_products <> v_total_items then
    raise exception 'one_variant_per_product_only';
  end if;

  for v_item in
    select pv.total_qty, pv.reserved_qty
      from jsonb_array_elements(p_items) item
      join public.product_variants pv on pv.id = (item->>'variant_id')::uuid
  loop
    if v_item.total_qty - v_item.reserved_qty < 1 then
      raise exception 'product_is_not_available';
    end if;
  end loop;

  insert into public.orders (
    employee_id, delivery_type, delivery_address, full_name, phone, email,
    city, department, comment, is_remote, country, is_welcome
  )
  values (
    v_employee.id,
    p_delivery_type,
    p_delivery_address,
    coalesce(v_invite.full_name, v_employee.full_name),
    coalesce(p_phone, v_employee.phone),
    v_employee.email,
    v_employee.city,
    coalesce(v_employee.business_unit, v_employee.department),
    p_comment,
    coalesce(p_is_remote, false),
    p_country,
    true
  )
  returning * into v_order;

  for v_item in
    select pv.id as variant_id, pv.product_id, pv.size, pv.color, pv.sku, p.name as product_name
      from jsonb_array_elements(p_items) item
      join public.product_variants pv on pv.id = (item->>'variant_id')::uuid
      join public.products p on p.id = pv.product_id
  loop
    insert into public.order_items (order_id, product_id, variant_id, product_name, size, color, sku, qty)
    values (v_order.id, v_item.product_id, v_item.variant_id, v_item.product_name, v_item.size, v_item.color, v_item.sku, 1);

    insert into public.stock_movements (variant_id, movement_type, qty, order_id, comment, created_by)
    values (v_item.variant_id, 'reserve', -1, v_order.id, 'Reserve for welcome pack', v_employee.id);
  end loop;

  update public.welcome_invites
     set used_at = now(),
         used_order_id = v_order.id
   where id = v_invite.id;

  return jsonb_build_object('id', v_order.id, 'order_number', v_order.order_number);
end;
$$;

grant execute on function public.create_welcome_order(text, jsonb, public.delivery_type, text, text, text, boolean, text) to authenticated;
