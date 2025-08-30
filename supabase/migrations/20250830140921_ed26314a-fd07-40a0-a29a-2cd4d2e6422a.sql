-- Force update to admin role with explicit check
UPDATE public.profiles 
SET role = 'admin', 
    updated_at = now()
WHERE email = 'support@amanafinanz.com' 
AND user_id = 'b76fe573-ce1e-45b5-9cb1-8ae720fd5ea6';