-- ============================================================
-- Uzum Merch — Auth Setup
-- Run this AFTER schema.sql
-- ============================================================

-- ─── 1. Auto-create employee record on first login ───────────
--
-- When Supabase Auth creates a new user, this trigger inserts
-- a matching row into public.employees so RLS policies work.
-- full_name is taken from the user metadata if provided.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.employees (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(
      new.raw_user_meta_data->>'full_name',
      split_part(new.email, '@', 1)
    )
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();


-- ─── 2. Seed a first admin ───────────────────────────────────
--
-- After the admin user signs in for the first time (which creates
-- their auth.users row and triggers handle_new_user above),
-- promote them manually:
--
--   update employees
--     set is_admin = true, full_name = 'Иванов Иван', department = 'HR'
--     where email = 'admin@uzum.com';


-- ─── 3. Supabase Dashboard settings ─────────────────────────
--
-- Authentication → Providers → Email:
--   [x] Enable Email provider
--   [x] Enable magic links (OTP)
--   [ ] Disable email confirmations (magic link IS the confirmation)
--
-- Authentication → URL Configuration:
--   Site URL:          https://merch.uzum.com   (or http://localhost:3000)
--   Redirect URLs:     https://merch.uzum.com/auth/callback
--                      http://localhost:3000/auth/callback
--
-- Authentication → Email Templates → Magic Link:
--   Customize subject/body to match corporate brand.
--
-- Authentication → Settings → Restrict signups:
--   If you want ONLY @uzum.com emails, add the domain there.
--   This is managed in the Supabase dashboard, not via SQL.
