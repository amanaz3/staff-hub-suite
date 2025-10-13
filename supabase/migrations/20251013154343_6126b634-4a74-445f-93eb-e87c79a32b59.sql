-- URGENT FIX: Sync profiles.role with user_roles table
-- This fixes the data inconsistency causing RLS failures

-- Step 1: Update all profiles to match their role in user_roles
UPDATE public.profiles p
SET role = ur.role::text
FROM public.user_roles ur
WHERE p.user_id = ur.user_id;

-- Step 2: Drop policies that depend on is_admin() function
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;

-- Step 3: Replace is_admin() function to use has_role() for security
DROP FUNCTION IF EXISTS public.is_admin(uuid) CASCADE;

CREATE OR REPLACE FUNCTION public.is_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT has_role(_user_id, 'admin'::app_role)
$$;

-- Step 4: Recreate profiles policy using the new is_admin()
CREATE POLICY "Admins can view all profiles" 
ON public.profiles 
FOR SELECT 
USING (is_admin(auth.uid()));

-- Step 5: Update all other RLS policies to use has_role()
-- Update leave_types policies
DROP POLICY IF EXISTS "Only admins can modify leave types" ON public.leave_types;
CREATE POLICY "Only admins can modify leave types" 
ON public.leave_types 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role));

-- Update leave_requests policies
DROP POLICY IF EXISTS "Admins can view all leave requests" ON public.leave_requests;
CREATE POLICY "Admins can view all leave requests" 
ON public.leave_requests 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can update leave requests" ON public.leave_requests;
CREATE POLICY "Admins can update leave requests" 
ON public.leave_requests 
FOR UPDATE 
USING (has_role(auth.uid(), 'admin'::app_role));

-- Update employee_leave_balances policies
DROP POLICY IF EXISTS "Admins can manage all leave balances" ON public.employee_leave_balances;
CREATE POLICY "Admins can manage all leave balances" 
ON public.employee_leave_balances 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role));

-- Update employees policies
DROP POLICY IF EXISTS "Admins can view full employee data" ON public.employees;
CREATE POLICY "Admins can view full employee data" 
ON public.employees 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Only admins can modify employees" ON public.employees;
CREATE POLICY "Only admins can modify employees" 
ON public.employees 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role));

-- Update attendance policies
DROP POLICY IF EXISTS "Admins can view all attendance" ON public.attendance;
CREATE POLICY "Admins can view all attendance" 
ON public.attendance 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can update all attendance" ON public.attendance;
CREATE POLICY "Admins can update all attendance" 
ON public.attendance 
FOR UPDATE 
USING (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can insert attendance" ON public.attendance;
CREATE POLICY "Admins can insert attendance" 
ON public.attendance 
FOR INSERT 
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Update divisions policies
DROP POLICY IF EXISTS "Only admins can modify divisions" ON public.divisions;
CREATE POLICY "Only admins can modify divisions" 
ON public.divisions 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role));

-- Update password_reset_tokens policies
DROP POLICY IF EXISTS "Admins can view reset tokens" ON public.password_reset_tokens;
CREATE POLICY "Admins can view reset tokens" 
ON public.password_reset_tokens 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'::app_role));

-- Update attendance_exceptions policies
DROP POLICY IF EXISTS "Admins can manage all exceptions" ON public.attendance_exceptions;
CREATE POLICY "Admins can manage all exceptions" 
ON public.attendance_exceptions 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role));

-- Update staff_documents policies
DROP POLICY IF EXISTS "Admins can manage all documents" ON public.staff_documents;
CREATE POLICY "Admins can manage all documents" 
ON public.staff_documents 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role));

-- Update work_schedules policies
DROP POLICY IF EXISTS "Admins can manage all work schedules" ON public.work_schedules;
CREATE POLICY "Admins can manage all work schedules" 
ON public.work_schedules 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role));

-- Update attendance_notification_log policies
DROP POLICY IF EXISTS "Admins can view all notification logs" ON public.attendance_notification_log;
CREATE POLICY "Admins can view all notification logs" 
ON public.attendance_notification_log 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'::app_role));

-- Update email_logs policies
DROP POLICY IF EXISTS "Admins can view email logs" ON public.email_logs;
CREATE POLICY "Admins can view email logs" 
ON public.email_logs 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'::app_role));

-- Update allowed_ips policies
DROP POLICY IF EXISTS "Only admins can manage allowed IPs" ON public.allowed_ips;
CREATE POLICY "Only admins can manage allowed IPs" 
ON public.allowed_ips 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role));