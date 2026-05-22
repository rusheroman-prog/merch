-- Run once on an existing database to enable password-after-email login.

alter table public.employees
  add column if not exists password_set_at timestamptz;

create or replace function public.mark_password_set()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.employees
     set password_set_at = now()
   where id = auth.uid();
end;
$$;
