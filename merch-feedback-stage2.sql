-- Run in Supabase SQL editor as one script, AFTER merch-feedback-stage1.sql
-- and BEFORE deploying the matching code. Safe to re-run.
--
-- Stage 2 of the colleagues' feedback: one status scale, pickup codes,
-- handout by scanning, business trips with a handout deadline.
--
--   Pickup in the office (incl. remote workers on a trip to Tashkent):
--     new (Заявка) → assembling (Сборка) → ready (Можно забирать) → received (Выдан)
--   Post (remote workers):
--     new (Заявка) → assembling (Сборка) → shipped (Отправлено) → received (Получено)
--   Any open order can be cancelled / rejected. Closed orders stay closed.
--   'review' and 'confirmed' are retired: open orders move to new / assembling.
--   orders.pickup_status is folded into the status and is no longer used.
--
-- Stock effects of status changes move from admin_update_order to
-- admin_set_order_status. They are derived from the movement log, so they
-- never apply twice:
--   cancelled / rejected → unreserve what is still reserved for the order;
--   shipped / received   → write off what is still reserved for the order.
--
-- Before anything is replaced, the live definitions are copied to
-- merch_migration_backup, and the script stops (changing nothing) if stock is
-- maintained differently than expected.

-- Part 1. New status value. A new enum value must be committed before use,
-- hence the explicit commit before the main transaction.
alter type public.order_status add value if not exists 'ready';
commit;

begin;

-- Part 2. Backup and guards -----------------------------------------------------
create table if not exists public.merch_migration_backup (
  id          bigserial primary key,
  migration   text not null,
  object_name text not null,
  definition  text,
  saved_at    timestamptz not null default now()
);

-- No policies: readable only from the SQL editor / service role.
alter table public.merch_migration_backup enable row level security;

insert into public.merch_migration_backup (migration, object_name, definition)
select 'stage2', p.oid::regprocedure::text, pg_get_functiondef(p.oid)
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public'
   and p.proname in (
     'apply_stock_movement',
     'admin_update_order',
     'admin_set_order_handout',
     'create_merch_order'
   );

insert into public.merch_migration_backup (migration, object_name, definition)
select 'stage2', 'trigger ' || t.tgname || ' on stock_movements', pg_get_triggerdef(t.oid)
  from pg_trigger t
 where t.tgrelid = 'public.stock_movements'::regclass
   and not t.tgisinternal;

do $$
declare
  v_triggers integer;
  v_function text;
  v_update_order text;
begin
  -- Stock must be maintained by exactly one trigger on stock_movements that
  -- calls public.apply_stock_movement(); its body is replaced below.
  select count(*), min(p.proname)
    into v_triggers, v_function
    from pg_trigger t
    join pg_proc p on p.oid = t.tgfoid
   where t.tgrelid = 'public.stock_movements'::regclass
     and not t.tgisinternal;

  if v_triggers <> 1 or v_function <> 'apply_stock_movement' then
    raise exception
      'stage2 stopped, nothing changed: expected one trigger on stock_movements calling apply_stock_movement, found % (%). Send this message to the developer.',
      v_triggers, coalesce(v_function, 'none');
  end if;

  -- Status changes must have touched stock only through stock_movements,
  -- otherwise the movement log cannot tell what is still reserved.
  select string_agg(pg_get_functiondef(p.oid), E'\n')
    into v_update_order
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.proname = 'admin_update_order';

  if v_update_order ~* 'update\s+(public\.)?product_variants' then
    raise exception
      'stage2 stopped, nothing changed: admin_update_order updates product_variants directly. Send this message to the developer.';
  end if;
end $$;

-- Part 3. Order fields ----------------------------------------------------------
alter table public.orders
  add column if not exists pickup_code text,
  add column if not exists ready_at    timestamptz,
  add column if not exists handed_by   uuid references public.employees(id),
  add column if not exists trip_from   date,
  add column if not exists trip_until  date;

-- Pickup code: what the QR encodes. Random (40 bits from gen_random_uuid), so
-- unlike the sequential order number it cannot be guessed for someone else.
create or replace function public.merch_new_pickup_code()
returns text
language sql
volatile
set search_path = ''
as $$
  select upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10))
$$;

update public.orders
   set pickup_code = public.merch_new_pickup_code()
 where pickup_code is null;

alter table public.orders
  alter column pickup_code set default public.merch_new_pickup_code(),
  alter column pickup_code set not null;

create unique index if not exists orders_pickup_code_key
  on public.orders (pickup_code);

create index if not exists orders_trip_until_idx
  on public.orders (trip_until)
  where trip_until is not null;

-- Part 4. Stock trigger: same semantics per movement type as before, but the
-- quantity sign no longer matters for reserve / unreserve / write_off / return
-- (the log already has reservations written as -1).
create or replace function public.apply_stock_movement()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_qty integer := abs(new.qty);
begin
  case new.movement_type
    when 'income' then
      update public.product_variants
         set total_qty = total_qty + v_qty, updated_at = now()
       where id = new.variant_id;

    when 'adjustment' then
      -- Signed on purpose: +n adds stock, -n removes it.
      update public.product_variants
         set total_qty = greatest(0, total_qty + new.qty), updated_at = now()
       where id = new.variant_id;

    when 'reserve' then
      update public.product_variants
         set reserved_qty = reserved_qty + v_qty, updated_at = now()
       where id = new.variant_id
         and total_qty - reserved_qty >= v_qty;
      if not found then
        raise exception 'product_is_not_available';
      end if;

    when 'unreserve' then
      update public.product_variants
         set reserved_qty = greatest(0, reserved_qty - v_qty), updated_at = now()
       where id = new.variant_id;

    when 'write_off' then
      update public.product_variants
         set total_qty    = greatest(0, total_qty - v_qty),
             reserved_qty = greatest(0, reserved_qty - v_qty),
             updated_at   = now()
       where id = new.variant_id;

    when 'return' then
      update public.product_variants
         set total_qty    = total_qty + v_qty,
             reserved_qty = greatest(0, reserved_qty - v_qty),
             updated_at   = now()
       where id = new.variant_id;
  end case;

  return new;
end;
$$;

-- Part 5. Status changes ----------------------------------------------------------

-- Units still reserved for an order, per variant, from the movement log.
create or replace function public.merch_order_reserved_units(p_order_id uuid)
returns table (variant_id uuid, units integer)
language sql
stable
security definer
set search_path = ''
as $$
  select sm.variant_id,
         sum(case sm.movement_type
               when 'reserve'   then  abs(sm.qty)
               when 'unreserve' then -abs(sm.qty)
               when 'write_off' then -abs(sm.qty)
               when 'return'    then -abs(sm.qty)
               else 0
             end)::integer
    from public.stock_movements sm
   where sm.order_id = p_order_id
   group by sm.variant_id
$$;

create or replace function public.merch_release_order_stock(p_order_id uuid, p_actor uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
begin
  for r in
    select * from public.merch_order_reserved_units(p_order_id) where units > 0
  loop
    insert into public.stock_movements (variant_id, movement_type, qty, order_id, comment, created_by)
    values (r.variant_id, 'unreserve', r.units, p_order_id, 'Order closed: reservation released', p_actor);
  end loop;
end;
$$;

create or replace function public.merch_write_off_order_stock(p_order_id uuid, p_actor uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
begin
  for r in
    select * from public.merch_order_reserved_units(p_order_id) where units > 0
  loop
    insert into public.stock_movements (variant_id, movement_type, qty, order_id, comment, created_by)
    values (r.variant_id, 'write_off', r.units, p_order_id, 'Order handed out or shipped', p_actor);
  end loop;
end;
$$;

-- Internal: applies a status with its stock effect. Not callable by users.
create or replace function public.merch_apply_order_status(
  p_order_id         uuid,
  p_status           public.order_status,
  p_actor            uuid,
  p_admin_comment    text default null,
  p_tracking_number  text default null,
  p_handed_to        text default null,
  p_storage_location text default null
)
returns public.orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order   public.orders%rowtype;
  v_from    text;
  v_to      text := p_status::text;
  v_is_post boolean;
begin
  select * into v_order
    from public.orders
   where id = p_order_id
   for update;

  if v_order.id is null then
    raise exception 'order_not_found';
  end if;

  v_from    := v_order.status::text;
  v_is_post := v_order.delivery_type::text = 'post';

  if v_to <> v_from then
    if v_from in ('received', 'cancelled', 'rejected') then
      raise exception 'order_is_closed';
    end if;
    if v_to in ('review', 'confirmed') then
      raise exception 'status_retired';
    end if;
    if v_to = 'ready' and v_is_post then
      raise exception 'status_not_for_post';
    end if;
    if v_to = 'shipped' and not v_is_post then
      raise exception 'status_only_for_post';
    end if;

    if v_to in ('cancelled', 'rejected') then
      perform public.merch_release_order_stock(v_order.id, p_actor);
    elsif v_to in ('shipped', 'received') then
      perform public.merch_write_off_order_stock(v_order.id, p_actor);
    end if;
  end if;

  update public.orders
     set status           = p_status,
         admin_comment    = case when p_admin_comment is null then admin_comment
                                 else nullif(btrim(p_admin_comment), '') end,
         tracking_number  = case when p_tracking_number is null then tracking_number
                                 else nullif(btrim(p_tracking_number), '') end,
         storage_location = case when p_storage_location is null then storage_location
                                 else nullif(btrim(p_storage_location), '') end,
         handed_to        = case when p_handed_to is null then handed_to
                                 else nullif(btrim(p_handed_to), '') end,
         confirmed_at     = case when v_to = 'assembling' then coalesce(confirmed_at, now()) else confirmed_at end,
         ready_at         = case when v_to = 'ready' then coalesce(ready_at, now()) else ready_at end,
         shipped_at       = case when v_to = 'shipped' then coalesce(shipped_at, now()) else shipped_at end,
         received_at      = case when v_to = 'received' then coalesce(received_at, now()) else received_at end,
         handed_by        = case when v_to = 'received' and v_from <> 'received' then p_actor else handed_by end,
         cancelled_at     = case when v_to in ('cancelled', 'rejected') then coalesce(cancelled_at, now()) else cancelled_at end
   where id = v_order.id
  returning * into v_order;

  return v_order;
end;
$$;

-- Admin entry point used by the API.
create or replace function public.admin_set_order_status(
  p_order_id         uuid,
  p_status           public.order_status,
  p_admin_comment    text default null,
  p_tracking_number  text default null,
  p_handed_to        text default null,
  p_storage_location text default null
)
returns public.orders
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'not_admin';
  end if;

  return public.merch_apply_order_status(
    p_order_id, p_status, auth.uid(),
    p_admin_comment, p_tracking_number, p_handed_to, p_storage_location
  );
end;
$$;

revoke execute on function public.merch_order_reserved_units(uuid)          from public, anon, authenticated;
revoke execute on function public.merch_release_order_stock(uuid, uuid)     from public, anon, authenticated;
revoke execute on function public.merch_write_off_order_stock(uuid, uuid)   from public, anon, authenticated;
revoke execute on function public.merch_apply_order_status(uuid, public.order_status, uuid, text, text, text, text)
  from public, anon, authenticated;

-- Part 6. Move open orders to the new scale ---------------------------------------
update public.orders
   set status = 'new'
 where status = 'review';

update public.orders
   set status = 'assembling', confirmed_at = coalesce(confirmed_at, now())
 where status = 'confirmed';

-- In the office flow "Отправлен" meant "можно забирать".
update public.orders
   set status = 'ready', ready_at = coalesce(ready_at, shipped_at, now())
 where status = 'shipped'
   and delivery_type::text <> 'post';

update public.orders
   set status = 'ready', ready_at = coalesce(ready_at, now())
 where pickup_status = 'packed'
   and status in ('new', 'assembling')
   and delivery_type::text <> 'post';

-- Orders already handed out by pickup status become received (with write-off).
do $$
declare
  r record;
  v_count integer := 0;
begin
  for r in
    select id
      from public.orders
     where pickup_status in ('handed_owner', 'handed_other')
       and status not in ('received', 'cancelled', 'rejected')
  loop
    perform public.merch_apply_order_status(r.id, 'received', null);
    v_count := v_count + 1;
  end loop;

  if v_count > 0 then
    raise notice 'stage2: % handed-out orders marked as received', v_count;
  end if;
end $$;

-- Part 7. Order creation with business-trip dates ------------------------------------
-- Two optional parameters with defaults: callers that pass the old seven
-- named arguments keep working.
drop function if exists public.create_merch_order(jsonb, public.delivery_type, text, text, text, boolean, text);

create or replace function public.create_merch_order(
  p_items            jsonb,
  p_delivery_type    public.delivery_type,
  p_delivery_address text,
  p_phone            text,
  p_comment          text,
  p_is_remote        boolean,
  p_country          text,
  p_trip_from        date default null,
  p_trip_until       date default null
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

  -- Remote worker picking merch up in Tashkent during a business trip.
  if (p_trip_from is null) <> (p_trip_until is null) then
    raise exception 'trip_dates_required';
  end if;

  if p_trip_from is not null then
    if v_delivery <> 'office' then
      raise exception 'trip_only_for_office';
    end if;
    if p_trip_until < p_trip_from then
      raise exception 'trip_dates_invalid';
    end if;
    if p_trip_until < current_date then
      raise exception 'trip_dates_in_past';
    end if;
    if p_trip_until - p_trip_from > 60 then
      raise exception 'trip_too_long';
    end if;
  end if;

  v_is_remote := v_delivery = 'post' or p_trip_from is not null or coalesce(p_is_remote, false);

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
    country,
    trip_from,
    trip_until
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
    case when v_delivery = 'post' then v_country else null end,
    p_trip_from,
    p_trip_until
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
      order_id, product_id, variant_id, product_name, size, color, sku, qty
    )
    values (
      v_order.id, v_item.product_id, v_item.variant_id, v_item.product_name,
      v_item.size, v_item.color, v_item.sku, 1
    );

    insert into public.stock_movements (
      variant_id, movement_type, qty, order_id, comment, created_by
    )
    values (
      v_item.variant_id, 'reserve', 1, v_order.id, 'Reserve for merch order', v_employee.id
    );
  end loop;

  return jsonb_build_object(
    'id', v_order.id,
    'order_number', v_order.order_number,
    'pickup_code', v_order.pickup_code
  );
end;
$$;

commit;
