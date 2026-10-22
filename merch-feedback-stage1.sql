-- Run in Supabase SQL editor as one script, BEFORE deploying the matching code.
-- Safe to re-run.
--
-- Stage 1 of the colleagues' feedback (October 2026):
--   1. delivery_type 'post': remote workers get merch by mail.
--      'pvz', 'courier' and 'pickup' stay in the enum (old orders keep them),
--      but new orders accept only 'office' and 'post'.
--   2. products.archived_at: archive a product instead of deleting it;
--      products.low_stock_threshold: "beacon" — alert when available <= N.
--   3. merch_settings: support contact (shown on login, catalog, orders),
--      start of the current order window and the per-employee item limit.
--   4. create_merch_order: limits are enforced across orders, not only
--      inside one order:
--        * the same product cannot be ordered twice in the current window;
--        * unique products per employee in the current window <= limit;
--        * inactive or archived products are rejected;
--        * 'post' requires an address and a phone.
--      The stock reservation insert is unchanged ('reserve', qty = -1), so the
--      existing stock trigger keeps working exactly as before.

-- 1. Delivery type for remote workers -----------------------------------------
-- ADD VALUE inside a transaction is allowed on PostgreSQL 12+; the new value is
-- only used at runtime by the API, never later in this script.
alter type public.delivery_type add value if not exists 'post';

-- 2. Products: archive + low-stock beacon -------------------------------------
alter table public.products
  add column if not exists archived_at timestamptz,
  add column if not exists low_stock_threshold integer not null default 5;

alter table public.products
  drop constraint if exists products_low_stock_threshold_check;
alter table public.products
  add constraint products_low_stock_threshold_check
  check (low_stock_threshold between 0 and 1000);

create index if not exists products_archived_at_idx
  on public.products (archived_at);

-- 3. Settings: support contact and order window -------------------------------
alter table public.merch_settings
  add column if not exists support_label text,
  add column if not exists support_url text,
  add column if not exists order_window_start timestamptz,
  add column if not exists max_items_per_employee integer not null default 3;

alter table public.merch_settings
  drop constraint if exists merch_settings_max_items_check;
alter table public.merch_settings
  add constraint merch_settings_max_items_check
  check (max_items_per_employee between 1 and 20);

-- 4. Order creation with limits across orders ---------------------------------
-- Same signature as merch-remote-order.sql, so the API call does not change.
create or replace function public.create_merch_order(
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
  v_employee        public.employees%rowtype;
  v_access          record;
  v_order           public.orders%rowtype;
  v_item            record;
  v_unique_products integer;
  v_total_items     integer;
  v_max_items       integer;
  v_window_start    timestamptz;
  v_already_ordered integer;
  v_delivery        text := p_delivery_type::text;
  v_address         text := nullif(btrim(coalesce(p_delivery_address, '')), '');
  v_country         text := nullif(btrim(coalesce(p_country, '')), '');
  v_comment         text := nullif(btrim(coalesce(p_comment, '')), '');
  v_phone           text;
  v_is_remote       boolean;
begin
  select * into v_employee
    from public.employees
   where id = auth.uid();

  if v_employee.id is null then
    raise exception 'employee_not_found';
  end if;

  -- One checkout at a time per employee: the limit checks below read the
  -- employee's existing orders, so parallel requests must not interleave.
  perform pg_advisory_xact_lock(
    hashtextextended('create_merch_order:' || v_employee.id::text, 0)
  );

  select * into v_access
    from public.get_employee_merch_access(v_employee.email)
   limit 1;

  if coalesce(v_access.is_allowed, false) = false then
    raise exception '%', coalesce(v_access.reason, 'employee_not_allowed');
  end if;

  -- Delivery ------------------------------------------------------------------
  if v_delivery not in ('office', 'post') then
    raise exception 'delivery_type_not_available';
  end if;

  v_phone := coalesce(
    nullif(btrim(coalesce(p_phone, '')), ''),
    nullif(btrim(coalesce(v_employee.phone, '')), '')
  );

  if v_delivery = 'post' then
    if v_address is null then
      raise exception 'delivery_address_required';
    end if;
    if v_phone is null then
      raise exception 'phone_required';
    end if;
  end if;

  v_is_remote := v_delivery = 'post' or coalesce(p_is_remote, false);

  -- Cart shape ----------------------------------------------------------------
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'cart_is_empty';
  end if;

  if exists (
    select 1
      from jsonb_array_elements(p_items) item
     where coalesce((item->>'qty')::int, 0) <> 1
  ) then
    raise exception 'one_unit_per_product_only';
  end if;

  select count(*), count(distinct pv.product_id)
    into v_total_items, v_unique_products
    from jsonb_array_elements(p_items) item
    join public.product_variants pv on pv.id = (item->>'variant_id')::uuid;

  if v_total_items <> jsonb_array_length(p_items) then
    raise exception 'product_is_not_available';
  end if;

  if v_unique_products <> v_total_items then
    raise exception 'one_variant_per_product_only';
  end if;

  -- Limits across orders in the current window ---------------------------------
  select s.max_items_per_employee, s.order_window_start
    into v_max_items, v_window_start
    from public.merch_settings s
   where s.id = 1;

  v_max_items := coalesce(v_max_items, 3);

  if exists (
    select 1
      from public.orders o
      join public.order_items oi on oi.order_id = o.id
     where o.employee_id = v_employee.id
       and o.status not in ('cancelled', 'rejected')
       and (v_window_start is null or o.created_at >= v_window_start)
       and oi.product_id in (
         select pv.product_id
           from jsonb_array_elements(p_items) item
           join public.product_variants pv on pv.id = (item->>'variant_id')::uuid
       )
  ) then
    raise exception 'product_already_ordered';
  end if;

  select count(distinct oi.product_id)
    into v_already_ordered
    from public.orders o
    join public.order_items oi on oi.order_id = o.id
   where o.employee_id = v_employee.id
     and o.status not in ('cancelled', 'rejected')
     and (v_window_start is null or o.created_at >= v_window_start);

  if coalesce(v_already_ordered, 0) + v_unique_products > v_max_items then
    raise exception 'max_unique_products_exceeded';
  end if;

  -- Availability, checked under a row lock so two orders cannot take the last
  -- unit of the same variant.
  for v_item in
    select
      pv.id,
      pv.total_qty,
      pv.reserved_qty,
      pv.is_active as variant_active,
      p.is_active  as product_active,
      p.archived_at
    from public.product_variants pv
    join public.products p on p.id = pv.product_id
    where pv.id in (
      select (item->>'variant_id')::uuid
        from jsonb_array_elements(p_items) item
    )
    order by pv.id
    for update of pv
  loop
    if not v_item.variant_active
       or not v_item.product_active
       or v_item.archived_at is not null
       or v_item.total_qty - v_item.reserved_qty < 1 then
      raise exception 'product_is_not_available';
    end if;
  end loop;

  -- Create the order --------------------------------------------------------------
  insert into public.orders (
    employee_id,
    delivery_type,
    delivery_address,
    full_name,
    phone,
    email,
    city,
    department,
    comment,
    is_remote,
    country
  )
  values (
    v_employee.id,
    p_delivery_type,
    v_address,
    v_employee.full_name,
    v_phone,
    v_employee.email,
    v_employee.city,
    coalesce(v_employee.business_unit, v_employee.department),
    v_comment,
    v_is_remote,
    case when v_is_remote then v_country else null end
  )
  returning * into v_order;

  for v_item in
    select
      pv.id as variant_id,
      pv.product_id,
      pv.size,
      pv.color,
      pv.sku,
      p.name as product_name
    from jsonb_array_elements(p_items) item
    join public.product_variants pv on pv.id = (item->>'variant_id')::uuid
    join public.products p on p.id = pv.product_id
  loop
    insert into public.order_items (
      order_id,
      product_id,
      variant_id,
      product_name,
      size,
      color,
      sku,
      qty
    )
    values (
      v_order.id,
      v_item.product_id,
      v_item.variant_id,
      v_item.product_name,
      v_item.size,
      v_item.color,
      v_item.sku,
      1
    );

    -- Unchanged from merch-remote-order.sql: the live stock trigger expects
    -- a reservation to be written as qty = -1.
    insert into public.stock_movements (
      variant_id,
      movement_type,
      qty,
      order_id,
      comment,
      created_by
    )
    values (
      v_item.variant_id,
      'reserve',
      -1,
      v_order.id,
      'Reserve for merch order',
      v_employee.id
    );
  end loop;

  return jsonb_build_object(
    'id', v_order.id,
    'order_number', v_order.order_number
  );
end;
$$;
