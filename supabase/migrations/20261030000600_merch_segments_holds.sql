-- Сегменты товаров и ручные резервы (правка про разделение айтемов).
-- 1) У товара есть сегмент: на продажу / финтех / еком / холдинг (null — общий).
--    В админке по нему переключаются склад и аналитика.
-- 2) Админ может «отложить айтем для удалёнщика до даты»: это заказ от имени
--    сотрудника с дедлайном hold_until. Резерв — тем же движением 'reserve', что и
--    в create_merch_order; снять резерв — отменить заказ в админке.
-- Запустить в Supabase SQL Editor. Без миграции эти функции просто не видны.

alter table public.products
  add column if not exists segment text;

alter table public.products
  drop constraint if exists products_segment_check;
alter table public.products
  add constraint products_segment_check
  check (segment is null or segment in ('sale', 'fintech', 'ecom', 'holding'));

alter table public.orders
  add column if not exists hold_until date;

create index if not exists orders_hold_until_idx
  on public.orders (hold_until)
  where hold_until is not null;

create or replace function public.admin_create_hold(
  p_employee_email text,
  p_variant_ids uuid[],
  p_hold_until date,
  p_delivery_type public.delivery_type,
  p_note text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_employee public.employees%rowtype;
  v_order    public.orders%rowtype;
  v_item     record;
  v_count    integer;
begin
  if not public.is_admin() then
    raise exception 'not_admin';
  end if;

  if p_hold_until is null or p_hold_until < current_date then
    raise exception 'hold_date_invalid';
  end if;

  if p_variant_ids is null or array_length(p_variant_ids, 1) is null then
    raise exception 'cart_is_empty';
  end if;

  select * into v_employee
    from public.employees
   where lower(email) = lower(trim(p_employee_email))
   limit 1;

  if v_employee.id is null then
    raise exception 'employee_has_no_account';
  end if;

  select count(*) into v_count
    from public.product_variants pv
   where pv.id = any(p_variant_ids)
     and pv.is_active = true
     and pv.total_qty - pv.reserved_qty >= 1;

  if v_count <> array_length(p_variant_ids, 1) then
    raise exception 'product_is_not_available';
  end if;

  insert into public.orders (
    employee_id, delivery_type, full_name, phone, email, city, department,
    comment, is_remote, hold_until
  )
  values (
    v_employee.id,
    p_delivery_type,
    v_employee.full_name,
    v_employee.phone,
    v_employee.email,
    v_employee.city,
    coalesce(v_employee.business_unit, v_employee.department),
    concat_ws(E'\n', 'Резерв от администратора до ' || to_char(p_hold_until, 'DD.MM.YYYY'), nullif(trim(p_note), '')),
    true,
    p_hold_until
  )
  returning * into v_order;

  for v_item in
    select pv.id as variant_id, pv.product_id, pv.size, pv.color, pv.sku, p.name as product_name
      from public.product_variants pv
      join public.products p on p.id = pv.product_id
     where pv.id = any(p_variant_ids)
  loop
    insert into public.order_items (order_id, product_id, variant_id, product_name, size, color, sku, qty)
    values (v_order.id, v_item.product_id, v_item.variant_id, v_item.product_name, v_item.size, v_item.color, v_item.sku, 1);

    insert into public.stock_movements (variant_id, movement_type, qty, order_id, comment, created_by)
    values (v_item.variant_id, 'reserve', -1, v_order.id, 'Manual hold by admin', auth.uid());
  end loop;

  return jsonb_build_object('id', v_order.id, 'order_number', v_order.order_number);
end;
$$;

grant execute on function public.admin_create_hold(text, uuid[], date, public.delivery_type, text) to authenticated;
