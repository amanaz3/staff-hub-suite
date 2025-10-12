-- Fix support@amanafinanz.com to be admin only
-- 1. Update profiles table
UPDATE public.profiles
SET role = 'admin', updated_at = NOW()
WHERE user_id = 'b76fe573-ce1e-45b5-9cb1-8ae720fd5ea6';

-- 2. Remove staff role from user_roles (keep only admin)
DELETE FROM public.user_roles
WHERE user_id = 'b76fe573-ce1e-45b5-9cb1-8ae720fd5ea6' 
  AND role = 'staff'::app_role;

-- Verify the fixes
DO $$
DECLARE
  profile_role text;
  roles_count int;
  admin_exists boolean;
BEGIN
  -- Check profiles table
  SELECT role INTO profile_role
  FROM public.profiles
  WHERE user_id = 'b76fe573-ce1e-45b5-9cb1-8ae720fd5ea6';
  
  -- Check user_roles table
  SELECT COUNT(*), bool_or(role = 'admin'::app_role) 
  INTO roles_count, admin_exists
  FROM public.user_roles
  WHERE user_id = 'b76fe573-ce1e-45b5-9cb1-8ae720fd5ea6';
  
  IF profile_role = 'admin' AND roles_count = 1 AND admin_exists THEN
    RAISE NOTICE 'SUCCESS: support@amanafinanz.com is now properly set as admin only';
  ELSE
    RAISE EXCEPTION 'FAILED: Profile role: %, Roles count: %, Has admin: %', 
      profile_role, roles_count, admin_exists;
  END IF;
END $$;