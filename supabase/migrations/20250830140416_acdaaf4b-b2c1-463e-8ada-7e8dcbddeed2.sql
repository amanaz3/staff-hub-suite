-- Update support@amanafinanz.com to admin role
UPDATE public.profiles 
SET role = 'admin' 
WHERE email = 'support@amanafinanz.com';