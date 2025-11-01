-- Create weekly exception report log table
CREATE TABLE IF NOT EXISTS public.weekly_exception_report_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID REFERENCES public.employees(id) NOT NULL,
  report_date DATE NOT NULL,
  week_start_date DATE NOT NULL,
  week_end_date DATE NOT NULL,
  total_issues INTEGER NOT NULL DEFAULT 0,
  issues_with_exceptions INTEGER NOT NULL DEFAULT 0,
  issues_without_exceptions INTEGER NOT NULL DEFAULT 0,
  issue_summary JSONB NOT NULL,
  email_status TEXT NOT NULL DEFAULT 'sent',
  email_sent_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.weekly_exception_report_log ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Admins can view all weekly report logs"
ON public.weekly_exception_report_log
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Employees can view their own weekly report logs"
ON public.weekly_exception_report_log
FOR SELECT
TO authenticated
USING (employee_id IN (
  SELECT id FROM public.employees WHERE user_id = auth.uid()
));

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_weekly_exception_report_log_employee_id 
ON public.weekly_exception_report_log(employee_id);

CREATE INDEX IF NOT EXISTS idx_weekly_exception_report_log_dates 
ON public.weekly_exception_report_log(week_start_date, week_end_date);