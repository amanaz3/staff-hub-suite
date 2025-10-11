-- Add staff_id column to employees table
ALTER TABLE employees 
ADD COLUMN staff_id TEXT;

-- Add unique constraint for staff_id
ALTER TABLE employees 
ADD CONSTRAINT unique_staff_id UNIQUE (staff_id);

-- Add division column to employees table
ALTER TABLE employees 
ADD COLUMN division TEXT;

-- Create divisions lookup table
CREATE TABLE IF NOT EXISTS divisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on divisions table
ALTER TABLE divisions ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Everyone can read divisions
CREATE POLICY "Everyone can view active divisions"
ON divisions FOR SELECT
TO authenticated
USING (is_active = true);

-- RLS Policy: Only admins can create/modify divisions
CREATE POLICY "Only admins can modify divisions"
ON divisions FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.user_id = auth.uid()
    AND profiles.role = 'admin'
  )
);

-- Seed with existing departments as divisions
INSERT INTO divisions (name)
SELECT DISTINCT department 
FROM employees 
WHERE department IS NOT NULL
ON CONFLICT (name) DO NOTHING;

-- Update handle_new_user trigger to include new fields
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Insert into profiles table
  INSERT INTO public.profiles (user_id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'New User'),
    COALESCE(NEW.raw_user_meta_data->>'role', 'staff')
  );
  
  -- Insert into employees table with new fields
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
    CURRENT_DATE,
    'active'
  );
  
  RETURN NEW;
END;
$function$;