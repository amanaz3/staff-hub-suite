-- Create attendance_test_records table (isolated from production attendance)
CREATE TABLE IF NOT EXISTS public.attendance_test_records (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id uuid REFERENCES public.employees(id),
  date date NOT NULL,
  clock_in_time timestamp with time zone,
  clock_out_time timestamp with time zone,
  total_hours numeric,
  status text NOT NULL DEFAULT 'present',
  is_wfh boolean NOT NULL DEFAULT false,
  ip_address inet,
  notes text,
  break_duration_minutes integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  tested_by uuid REFERENCES auth.users(id),
  test_metadata jsonb
);

-- Add comments for documentation
COMMENT ON TABLE public.attendance_test_records IS 'Isolated test records for clock-in/out debugging and testing. Does not affect production attendance data, reports, or analytics.';
COMMENT ON COLUMN public.attendance_test_records.tested_by IS 'Admin user who ran the test';
COMMENT ON COLUMN public.attendance_test_records.test_metadata IS 'Additional test context: user agent, test type, etc.';

-- Create indexes for common queries
CREATE INDEX idx_attendance_test_employee_date ON public.attendance_test_records(employee_id, date);
CREATE INDEX idx_attendance_test_date ON public.attendance_test_records(date);
CREATE INDEX idx_attendance_test_tested_by ON public.attendance_test_records(tested_by);

-- Enable Row Level Security
ALTER TABLE public.attendance_test_records ENABLE ROW LEVEL SECURITY;

-- Only admins can manage test records
CREATE POLICY "Admins can manage test attendance records"
  ON public.attendance_test_records
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Trigger for updated_at
CREATE TRIGGER update_attendance_test_records_updated_at
  BEFORE UPDATE ON public.attendance_test_records
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();