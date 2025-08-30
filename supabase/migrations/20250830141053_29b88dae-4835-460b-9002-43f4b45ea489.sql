-- Set admin role one more time - this should now persist
UPDATE public.profiles 
SET role = 'admin', 
    updated_at = now()
WHERE email = 'support@amanafinanz.com';