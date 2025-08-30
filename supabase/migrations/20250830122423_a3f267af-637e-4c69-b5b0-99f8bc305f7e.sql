
-- 1) Extend attendance_exceptions for correction workflow
alter table public.attendance_exceptions
  alter column attendance_id drop not null;

alter table public.attendance_exceptions
  add column if not exists target_date date,
  add column if not exists proposed_clock_in_time timestamptz,
  add column if not exists proposed_clock_out_time timestamptz;

-- 2) Allow admins to insert/update attendance (employees already have their own policy)
-- Note: RLS is permissive; these policies add admin capabilities without weakening employee rules.

-- Admins can update any attendance record
create policy "Admins can update all attendance"
on public.attendance
for update
using (
  exists (
    select 1 from public.profiles
    where profiles.user_id = auth.uid() and profiles.role = 'admin'
  )
);

-- Admins can insert attendance records
create policy "Admins can insert attendance"
on public.attendance
for insert
with check (
  exists (
    select 1 from public.profiles
    where profiles.user_id = auth.uid() and profiles.role = 'admin'
  )
);

-- 3) Recalculate total_hours when clock times change
-- (Function public.calculate_attendance_hours() already exists with proper search_path)
drop trigger if exists attendance_calculate_hours_trg on public.attendance;

create trigger attendance_calculate_hours_trg
before insert or update of clock_in_time, clock_out_time
on public.attendance
for each row
execute function public.calculate_attendance_hours();
