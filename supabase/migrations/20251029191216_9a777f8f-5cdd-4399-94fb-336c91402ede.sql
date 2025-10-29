-- Drop the existing role check constraint that doesn't include 'manager'
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;

-- Add new check constraint that includes 'manager' as a valid role
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check 
CHECK (role IN ('admin', 'staff', 'manager'));