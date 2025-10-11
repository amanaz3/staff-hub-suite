-- Add working_days column to work_schedules table
ALTER TABLE public.work_schedules 
ADD COLUMN working_days text[] 
DEFAULT ARRAY['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

-- Update existing schedules to have the default working days
UPDATE public.work_schedules 
SET working_days = ARRAY['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
WHERE working_days IS NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.work_schedules.working_days IS 'Array of working day names (e.g., [Monday, Tuesday, Wednesday, Thursday, Friday, Saturday])';