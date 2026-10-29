-- «Маячки» остатков (правка про аналитику): у каждого варианта товара свой
-- порог предупреждения «осталось N шт». null — порог по умолчанию (4 шт.).
-- Запустить в Supabase SQL Editor. Без миграции везде действует порог 4 шт.

alter table public.product_variants
  add column if not exists alert_qty integer;

alter table public.product_variants
  drop constraint if exists product_variants_alert_qty_check;
alter table public.product_variants
  add constraint product_variants_alert_qty_check
  check (alert_qty is null or alert_qty >= 0);
