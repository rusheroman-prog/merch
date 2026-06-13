-- Run in Supabase SQL editor before deploying the matching application code.
-- Adds HR employee directory, tenure checks, merch selection rules, and waybill audit fields.

alter table public.employees
  add column if not exists business_unit text,
  add column if not exists hired_at date,
  add column if not exists is_active boolean not null default true;

create table if not exists public.employee_directory (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  full_name text not null,
  business_unit text,
  position text,
  hired_at date not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists employee_directory_email_lower_key
  on public.employee_directory (lower(email));

alter table public.orders
  add column if not exists shipping_places_count integer,
  add column if not exists shipping_weight_kg numeric(8, 2),
  add column if not exists shipping_package_type text,
  add column if not exists shipping_printed_at timestamptz,
  add column if not exists shipping_printed_by uuid references public.employees(id);

create table if not exists public.employee_audit_log (
  id uuid primary key default gen_random_uuid(),
  employee_directory_id uuid references public.employee_directory(id),
  actor_id uuid references public.employees(id),
  action text not null,
  changed_fields jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.employees e
     where e.id = auth.uid()
       and e.is_admin = true
       and e.is_active = true
  );
$$;

alter table public.employee_directory enable row level security;
alter table public.employee_audit_log enable row level security;

drop policy if exists "Admins manage employee directory" on public.employee_directory;
create policy "Admins manage employee directory"
  on public.employee_directory
  for all
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "Admins read employee audit log" on public.employee_audit_log;
create policy "Admins read employee audit log"
  on public.employee_audit_log
  for select
  using (public.is_admin());

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists employee_directory_touch_updated_at on public.employee_directory;
create trigger employee_directory_touch_updated_at
  before update on public.employee_directory
  for each row execute procedure public.touch_updated_at();

create or replace function public.sync_employee_from_directory()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.employees
     set full_name = new.full_name,
         department = coalesce(new.business_unit, department),
         business_unit = new.business_unit,
         position = new.position,
         hired_at = new.hired_at,
         is_active = new.is_active
   where lower(email) = lower(new.email);

  return new;
end;
$$;

drop trigger if exists employee_directory_sync_employee on public.employee_directory;
create trigger employee_directory_sync_employee
  after insert or update on public.employee_directory
  for each row execute procedure public.sync_employee_from_directory();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  directory_row public.employee_directory%rowtype;
begin
  select *
    into directory_row
    from public.employee_directory
   where lower(email) = lower(new.email)
   limit 1;

  insert into public.employees (
    id,
    email,
    full_name,
    department,
    business_unit,
    position,
    hired_at,
    is_active
  )
  values (
    new.id,
    new.email,
    coalesce(directory_row.full_name, new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    directory_row.business_unit,
    directory_row.business_unit,
    directory_row.position,
    directory_row.hired_at,
    coalesce(directory_row.is_active, false)
  )
  on conflict (id) do update
    set email = excluded.email,
        full_name = excluded.full_name,
        department = coalesce(excluded.department, public.employees.department),
        business_unit = coalesce(excluded.business_unit, public.employees.business_unit),
        position = coalesce(excluded.position, public.employees.position),
        hired_at = coalesce(excluded.hired_at, public.employees.hired_at),
        is_active = excluded.is_active;

  return new;
end;
$$;

create or replace function public.get_employee_merch_access(p_email text)
returns table (
  is_allowed boolean,
  reason text,
  hired_at date,
  months_worked integer
)
language sql
security definer
set search_path = ''
as $$
  with directory_row as (
    select *
      from public.employee_directory
     where lower(email) = lower(p_email)
     limit 1
  )
  select
    case
      when not exists (select 1 from directory_row) then false
      when coalesce((select is_active from directory_row), false) = false then false
      when (select hired_at from directory_row) > current_date - interval '3 months' then false
      else true
    end as is_allowed,
    case
      when not exists (select 1 from directory_row) then 'employee_not_in_directory'
      when coalesce((select is_active from directory_row), false) = false then 'employee_inactive'
      when (select hired_at from directory_row) > current_date - interval '3 months' then 'employee_tenure_too_short'
      else 'ok'
    end as reason,
    (select hired_at from directory_row) as hired_at,
    case
      when (select hired_at from directory_row) is null then null
      else (
        extract(year from age(current_date, (select hired_at from directory_row)))::int * 12
        + extract(month from age(current_date, (select hired_at from directory_row)))::int
      )
    end as months_worked;
$$;

create or replace function public.create_merch_order(
  p_items jsonb,
  p_delivery_type public.delivery_type,
  p_delivery_address text,
  p_phone text,
  p_comment text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_employee public.employees%rowtype;
  v_access record;
  v_order public.orders%rowtype;
  v_unique_products integer;
  v_total_items integer;
  v_item record;
begin
  select * into v_employee
    from public.employees
   where id = auth.uid();

  if v_employee.id is null then
    raise exception 'employee_not_found';
  end if;

  select * into v_access
    from public.get_employee_merch_access(v_employee.email)
   limit 1;

  if coalesce(v_access.is_allowed, false) = false then
    raise exception '%', coalesce(v_access.reason, 'employee_not_allowed');
  end if;

  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'cart_is_empty';
  end if;

  with normalized as (
    select
      (item->>'variant_id')::uuid as variant_id,
      coalesce((item->>'qty')::int, 0) as qty
    from jsonb_array_elements(p_items) item
  ),
  enriched as (
    select n.variant_id, n.qty, pv.product_id
      from normalized n
      join public.product_variants pv on pv.id = n.variant_id
  )
  select count(*), count(distinct product_id)
    into v_total_items, v_unique_products
    from enriched;

  if v_total_items <> jsonb_array_length(p_items) then
    raise exception 'product_is_not_available';
  end if;

  if exists (
    select 1
      from jsonb_array_elements(p_items) item
     where coalesce((item->>'qty')::int, 0) <> 1
  ) then
    raise exception 'one_unit_per_product_only';
  end if;

  if v_unique_products > 3 then
    raise exception 'max_unique_products_exceeded';
  end if;

  if v_unique_products <> v_total_items then
    raise exception 'one_variant_per_product_only';
  end if;

  for v_item in
    select
      pv.id as variant_id,
      pv.product_id,
      pv.size,
      pv.color,
      pv.sku,
      pv.total_qty,
      pv.reserved_qty,
      p.name as product_name
    from jsonb_array_elements(p_items) item
    join public.product_variants pv on pv.id = (item->>'variant_id')::uuid
    join public.products p on p.id = pv.product_id
    where pv.is_active = true and p.is_active = true
  loop
    if v_item.total_qty - v_item.reserved_qty < 1 then
      raise exception 'product_is_not_available';
    end if;
  end loop;

  insert into public.orders (
    employee_id,
    delivery_type,
    delivery_address,
    full_name,
    phone,
    email,
    city,
    department,
    comment
  )
  values (
    v_employee.id,
    p_delivery_type,
    p_delivery_address,
    v_employee.full_name,
    coalesce(p_phone, v_employee.phone),
    v_employee.email,
    v_employee.city,
    coalesce(v_employee.business_unit, v_employee.department),
    p_comment
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
