-- Run in Supabase SQL editor BEFORE deploying the matching application code.
-- Adds the "post" delivery type: remote employees receive merch by BTS post.
-- Additive change: existing orders and the create_merch_order signature are untouched
-- (the function takes public.delivery_type, so it accepts the new value as is).
--
-- Note: ALTER TYPE ... ADD VALUE cannot run inside a transaction block together with
-- statements that use the new value — run this file on its own.

alter type public.delivery_type add value if not exists 'post';
