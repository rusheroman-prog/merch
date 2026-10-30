-- Архив товаров (правка #10): товар можно убрать в архив и вернуть,
-- когда снова появится такой же айтем. Архивный товар скрыт из каталога
-- (is_active = false) и из основного списка админки.
-- Запустить в Supabase SQL Editor до деплоя кода с вкладкой «Архив».

alter table public.products
  add column if not exists archived_at timestamptz;

create index if not exists products_archived_at_idx
  on public.products (archived_at)
  where archived_at is not null;
