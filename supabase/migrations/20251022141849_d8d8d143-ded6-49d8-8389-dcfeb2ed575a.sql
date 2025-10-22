-- Update handle_new_user trigger to handle hire_date and auto-calculate probation_end_date
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_hire_date date;
BEGIN
  -- Get hire_date from metadata or default to current date
  v_hire_date := COALESCE(
    (NEW.raw_user_meta_data->>'hire_date')::date,
    CURRENT_DATE
  );

  -- Insert into profiles table
  INSERT INTO public.profiles (user_id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'New User'),
    COALESCE(NEW.raw_user_meta_data->>'role', 'staff')
  );
  
  -- Insert into employees table with hire_date and auto-calculated probation_end_date
  INSERT INTO public.employees (
    user_id, 
    employee_id, 
    staff_id,
    full_name, 
    email, 
    department, 
    division,
    position, 
    hire_date,
    probation_end_date,
    status
  )
  VALUES (
    NEW.id,
    'EMP' || LPAD(EXTRACT(EPOCH FROM NOW())::text, 10, '0'),
    COALESCE(NEW.raw_user_meta_data->>'staff_id', NULL),
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'New User'),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'department', 'General'),
    COALESCE(NEW.raw_user_meta_data->>'division', NULL),
    COALESCE(NEW.raw_user_meta_data->>'position', 'Staff'),
    v_hire_date,
    v_hire_date + INTERVAL '6 months',
    'active'
  );
  
  RETURN NEW;
END;
$function$;