-- Update the handle_new_user function to also create employee records
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  -- Insert into profiles table (existing functionality)
  INSERT INTO public.profiles (user_id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'New User'),
    COALESCE(NEW.raw_user_meta_data->>'role', 'staff')
  );
  
  -- Also insert into employees table (new functionality)
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
  VALUES (
    NEW.id,
    'EMP' || LPAD(EXTRACT(EPOCH FROM NOW())::text, 10, '0'), -- Generate unique employee ID
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'New User'),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'department', 'General'),
    COALESCE(NEW.raw_user_meta_data->>'position', 'Staff'),
    CURRENT_DATE,
    'active'
  );
  
  RETURN NEW;
END;
$function$;