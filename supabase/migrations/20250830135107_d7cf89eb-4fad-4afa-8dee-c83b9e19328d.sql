
-- 1) Allow employees to insert their own attendance
create policy "Employees can insert their own attendance"
on public.attendance
for insert
to authenticated
with check (
  employee_id in (
    select e.id from public.employees e where e.user_id = auth.uid()
  )
);

-- 2) Enforce one attendance row per employee per day
do $$
begin
  if not exists (
    select 1 from pg_indexes where schemaname = 'public' and indexname = 'attendance_employee_date_unique'
  ) then
    create unique index attendance_employee_date_unique
      on public.attendance (employee_id, date);
  end if;
end$$;

-- 3) Let admins read all profiles safely (avoid recursive RLS via a security definer)
create or replace function public.is_admin(_user_id uuid)
returns boolean
language sql
stable
security definer
as $$
  select exists (
    select 1
    from public.profiles p
    where p.user_id = _user_id
      and p.role = 'admin'
  );
$$;

-- Grant execute on function to authenticated users
grant execute on function public.is_admin(uuid) to authenticated;

-- Admins can view all profiles
create policy "Admins can view all profiles"
on public.profiles
for select
to authenticated
using (public.is_admin(auth.uid()));

-- 4) Ensure a single employees row per user (helps bootstrapping)
do $$
begin
  if not exists (
    select 1 from pg_indexes where schemaname = 'public' and indexname = 'employees_user_id_unique'
  ) then
    create unique index employees_user_id_unique
      on public.employees (user_id);
  end if;
end$$;

-- 5) Bootstrap function for creating profile + employee without touching auth schema
create or replace function public.bootstrap_user(
  _email text,
  _full_name text,
  _role text default 'staff',
  _department text default 'General',
  _position text default 'Staff'
)
returns json
language plpgsql
security definer
set search_path = 'public'
as $$
declare
  uid uuid := auth.uid();
  existing_emp uuid;
  generated_emp_id text;
  out_emp_id uuid;
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  -- Ensure profile exists or upsert minimal info
  insert into public.profiles (user_id, email, full_name, role, department, position)
  values (
    uid,
    coalesce(_email, ''),
    coalesce(nullif(_full_name, ''), 'New User'),
    coalesce(nullif(_role, ''), 'staff'),
    nullif(_department, ''),
    nullif(_position, '')
  )
  on conflict (user_id) do update
  set email = excluded.email,
      full_name = excluded.full_name,
      role = excluded.role,
      department = excluded.department,
      position = excluded.position;

  -- Check employee existence
  select id into existing_emp
  from public.employees
  where user_id = uid
  limit 1;

  if existing_emp is null then
    generated_emp_id := 'EMP' || lpad(extract(epoch from now())::text, 10, '0');

    insert into public.employees (
      user_id, employee_id, full_name, email, department, position, hire_date, status
    ) values (
      uid,
      generated_emp_id,
      coalesce(nullif(_full_name, ''), 'New User'),
      coalesce(_email, ''),
      coalesce(nullif(_department, ''), 'General'),
      coalesce(nullif(_position, ''), 'Staff'),
      current_date,
      'active'
    );
  end if;

  select id into out_emp_id
  from public.employees
  where user_id = uid
  limit 1;

  return json_build_object(
    'success', true,
    'employee_id', out_emp_id
  );
end;
$$;

-- Grant execute on function to authenticated users
grant execute on function public.bootstrap_user(text, text, text, text, text) to authenticated;

-- 6) Auto-calculate total hours on attendance (when clock_out_time is set)
-- Reuse existing function public.calculate_attendance_hours()
drop trigger if exists attendance_calculate_hours on public.attendance;

create trigger attendance_calculate_hours
before insert or update on public.attendance
for each row
execute function public.calculate_attendance_hours();
