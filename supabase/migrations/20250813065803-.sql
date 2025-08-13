-- First, ensure employees table is populated with existing profiles
-- and create constraints for attendance

-- Insert employees from profiles if they don't exist
INSERT INTO public.employees (user_id, employee_id, full_name, email, department, position, hire_date, status)
SELECT 
  p.user_id,
  'EMP' || LPAD(ROW_NUMBER() OVER (ORDER BY p.created_at)::text, 4, '0'),
  p.full_name,
  p.email,
  COALESCE(p.department, 'General'),
  COALESCE(p.position, 'Staff'),
  COALESCE(p.hire_date, CURRENT_DATE),
  'active'
FROM public.profiles p
LEFT JOIN public.employees e ON e.user_id = p.user_id
WHERE e.user_id IS NULL;

-- Create unique constraint to ensure one attendance record per employee per day
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'unique_employee_date_attendance'
  ) THEN
    ALTER TABLE public.attendance 
    ADD CONSTRAINT unique_employee_date_attendance 
    UNIQUE (employee_id, date);
  END IF;
END $$;

-- Add foreign key constraint if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'attendance_employee_id_fkey'
  ) THEN
    ALTER TABLE public.attendance 
    ADD CONSTRAINT attendance_employee_id_fkey 
    FOREIGN KEY (employee_id) REFERENCES public.employees(id);
  END IF;
END $$;

-- Create function to calculate total hours when clocking out
CREATE OR REPLACE FUNCTION public.calculate_attendance_hours()
RETURNS TRIGGER AS $$
BEGIN
  -- Only calculate if both clock_in_time and clock_out_time are set
  IF NEW.clock_in_time IS NOT NULL AND NEW.clock_out_time IS NOT NULL THEN
    NEW.total_hours = EXTRACT(EPOCH FROM (NEW.clock_out_time - NEW.clock_in_time)) / 3600;
  END IF;
  
  -- Set updated_at
  NEW.updated_at = now();
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic hour calculation
DROP TRIGGER IF EXISTS calculate_hours_trigger ON public.attendance;
CREATE TRIGGER calculate_hours_trigger
  BEFORE UPDATE ON public.attendance
  FOR EACH ROW
  EXECUTE FUNCTION public.calculate_attendance_hours();