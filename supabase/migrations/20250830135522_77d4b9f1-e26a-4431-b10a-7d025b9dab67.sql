-- Update support@amanafinanz.com to be an admin
UPDATE public.profiles 
SET role = 'admin' 
WHERE email = 'support@amanafinanz.com';