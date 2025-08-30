-- Create employee records for existing users who don't have them
INSERT INTO public.employees (
  user_id, 
  employee_id, 
  full_name, 
  email, 
  department, 
  position, 
  hire_date,
  status
)
SELECT 
  p.user_id,
  'EMP' || LPAD((EXTRACT(EPOCH FROM p.created_at))::text, 10, '0'),
  p.full_name,
  p.email,
  COALESCE(p.department, 'General'),
  COALESCE(p.position, 'Staff'),
  COALESCE(p.hire_date, CURRENT_DATE),
  'active'
FROM public.profiles p
LEFT JOIN public.employees e ON p.user_id = e.user_id
WHERE e.user_id IS NULL;