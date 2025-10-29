-- Add manager to the app_role enum
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'manager';

-- Create function to get employee_id from user_id
CREATE OR REPLACE FUNCTION public.get_employee_id_from_user(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.employees WHERE user_id = _user_id LIMIT 1
$$;

-- Add RLS policies for managers on leave_requests
CREATE POLICY "Managers can view their team's leave requests"
ON public.leave_requests
FOR SELECT
TO authenticated
USING (
  employee_id IN (
    SELECT id FROM public.employees 
    WHERE manager_id = public.get_employee_id_from_user(auth.uid())
  )
);

CREATE POLICY "Managers can update their team's leave requests"
ON public.leave_requests
FOR UPDATE
TO authenticated
USING (
  employee_id IN (
    SELECT id FROM public.employees 
    WHERE manager_id = public.get_employee_id_from_user(auth.uid())
  )
);

-- Add RLS policies for managers on attendance_exceptions
CREATE POLICY "Managers can view their team's exceptions"
ON public.attendance_exceptions
FOR SELECT
TO authenticated
USING (
  employee_id IN (
    SELECT id FROM public.employees 
    WHERE manager_id = public.get_employee_id_from_user(auth.uid())
  )
);

CREATE POLICY "Managers can update their team's exceptions"
ON public.attendance_exceptions
FOR UPDATE
TO authenticated
USING (
  employee_id IN (
    SELECT id FROM public.employees 
    WHERE manager_id = public.get_employee_id_from_user(auth.uid())
  )
);

-- Add RLS policy for managers to view their team's attendance
CREATE POLICY "Managers can view their team's attendance"
ON public.attendance
FOR SELECT
TO authenticated
USING (
  employee_id IN (
    SELECT id FROM public.employees 
    WHERE manager_id = public.get_employee_id_from_user(auth.uid())
  )
);