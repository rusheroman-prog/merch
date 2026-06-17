-- Run in Supabase SQL editor to enable the in-app employee directory editor.
-- Adds automatic audit logging: every insert/update on employee_directory
-- records who changed what into employee_audit_log. SECURITY DEFINER so the
-- write bypasses the audit-log RLS (which only allows admins to read).

create or replace function public.log_employee_directory_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_changes jsonb := '{}'::jsonb;
begin
  if (tg_op = 'INSERT') then
    insert into public.employee_audit_log (employee_directory_id, actor_id, action, changed_fields)
    values (
      new.id,
      auth.uid(),
      'create',
      to_jsonb(new) - 'id' - 'created_at' - 'updated_at'
    );
    return new;
  end if;

  -- UPDATE: record only the fields that actually changed as [old, new] pairs.
  if new.full_name is distinct from old.full_name then
    v_changes := v_changes || jsonb_build_object('full_name', jsonb_build_array(old.full_name, new.full_name));
  end if;
  if new.email is distinct from old.email then
    v_changes := v_changes || jsonb_build_object('email', jsonb_build_array(old.email, new.email));
  end if;
  if new.business_unit is distinct from old.business_unit then
    v_changes := v_changes || jsonb_build_object('business_unit', jsonb_build_array(old.business_unit, new.business_unit));
  end if;
  if new.position is distinct from old.position then
    v_changes := v_changes || jsonb_build_object('position', jsonb_build_array(old.position, new.position));
  end if;
  if new.hired_at is distinct from old.hired_at then
    v_changes := v_changes || jsonb_build_object('hired_at', jsonb_build_array(old.hired_at, new.hired_at));
  end if;
  if new.is_active is distinct from old.is_active then
    v_changes := v_changes || jsonb_build_object('is_active', jsonb_build_array(old.is_active, new.is_active));
  end if;

  if v_changes <> '{}'::jsonb then
    insert into public.employee_audit_log (employee_directory_id, actor_id, action, changed_fields)
    values (new.id, auth.uid(), 'update', v_changes);
  end if;

  return new;
end;
$$;

drop trigger if exists employee_directory_audit on public.employee_directory;
create trigger employee_directory_audit
  after insert or update on public.employee_directory
  for each row execute procedure public.log_employee_directory_change();
