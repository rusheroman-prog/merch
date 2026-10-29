-- Командировка (правка #13): удалёнщик забирает мерч в офисе Ташкента
-- в даты поездки. Заказ резервируется как обычно (create_merch_order),
-- а даты превращаются в задачу админам с дедлайном trip_to.
-- Запустить в Supabase SQL Editor. Код работает и без миграции:
-- даты дублируются в комментарий заказа, но задач на дашборде не будет.

alter table public.orders
  add column if not exists trip_from date,
  add column if not exists trip_to   date;

alter table public.orders
  drop constraint if exists orders_trip_dates_check;
alter table public.orders
  add constraint orders_trip_dates_check
  check (trip_from is null or trip_to is null or trip_to >= trip_from);

create index if not exists orders_trip_to_idx
  on public.orders (trip_to)
  where trip_to is not null;

-- Сотрудник проставляет даты только своему свежему заказу.
create or replace function public.set_order_trip(
  p_order_id uuid,
  p_trip_from date,
  p_trip_to date
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_trip_from is null or p_trip_to is null or p_trip_to < p_trip_from then
    raise exception 'invalid_trip_dates';
  end if;

  update public.orders
     set trip_from = p_trip_from,
         trip_to   = p_trip_to
   where id = p_order_id
     and employee_id = auth.uid()
     and status = 'new';

  if not found then
    raise exception 'order_not_found';
  end if;
end;
$$;

grant execute on function public.set_order_trip(uuid, date, date) to authenticated;
