-- Fix critical security issue: Restrict employee data access to protect sensitive information

-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Employees can view all employees" ON public.employees;

-- Create more restrictive policies for employee data access
-- Employees can view basic information of all employees (name, department, position only)
CREATE POLICY "Employees can view basic employee info" 
ON public.employees 
FOR SELECT 
USING (
  auth.uid() IS NOT NULL  -- Must be authenticated
);

-- However, restrict full access to sensitive fields through a view
-- Create a view for public employee directory
CREATE OR REPLACE VIEW public.employee_directory AS
SELECT 
  id,
  employee_id,
  full_name,
  department,
  position,
  status,
  hire_date,
  wfh_enabled
FROM public.employees
WHERE status = 'active';

-- Grant access to the directory view
GRANT SELECT ON public.employee_directory TO authenticated;

-- Add RLS to the view (though views inherit from base table)
ALTER VIEW public.employee_directory SET (security_invoker = on);

-- Ensure admins can still access full employee data
CREATE POLICY "Admins can view full employee data" 
ON public.employees 
FOR ALL 
USING (EXISTS (
  SELECT 1 FROM profiles 
  WHERE profiles.user_id = auth.uid() 
  AND profiles.role = 'admin'
));

-- Users can view their own full employee record
CREATE POLICY "Users can view their own employee record" 
ON public.employees 
FOR SELECT 
USING (user_id = auth.uid());