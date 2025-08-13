-- Update user role to admin
UPDATE public.profiles 
SET role = 'admin', updated_at = now()
WHERE email = 'support@amanafinanz.com';