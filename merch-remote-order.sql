-- Run in Supabase SQL editor AFTER merch-handout-features.sql.
-- Extends create_merch_order with the "remote worker" flag and country so the
-- checkout can capture them. Drop first: the live signature differs and
-- create-or-replace cannot change a function's argument list.

drop function if exists public.create_merch_order(jsonb, public.delivery_type, text, text, text);
drop function if exists public.create_merch_order(jsonb, public.delivery_type, text, text, text, boolean, text);

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
    comment,
    is_remote,
    country
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
    p_comment,
    coalesce(p_is_remote, false),
    p_country
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
