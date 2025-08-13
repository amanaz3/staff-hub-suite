-- Insert employee record for the existing user
INSERT INTO public.employees (
  user_id,
  employee_id,
  full_name,
  email,
  department,
  position,
  hire_date,
  status
) VALUES (
  'b76fe573-ce1e-45b5-9cb1-8ae720fd5ea6',
  'EMP001',
  'New User',
  'support@amanafinanz.com',
  'Administration',
  'Staff Member',
  CURRENT_DATE,
  'active'
);