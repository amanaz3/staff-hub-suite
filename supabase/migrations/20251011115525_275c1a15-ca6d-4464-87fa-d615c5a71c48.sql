-- Create attendance notification log table
CREATE TABLE public.attendance_notification_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  notification_date DATE NOT NULL,
  attendance_date DATE NOT NULL,
  issues_detected JSONB NOT NULL,
  issue_details JSONB NOT NULL,
  email_sent_at TIMESTAMP WITH TIME ZONE,
  email_status TEXT DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Index for performance
CREATE INDEX idx_attendance_notification_employee_date 
ON attendance_notification_log(employee_id, attendance_date);

-- RLS Policies
ALTER TABLE public.attendance_notification_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all notification logs"
ON public.attendance_notification_log FOR SELECT
USING (EXISTS (
  SELECT 1 FROM profiles 
  WHERE profiles.user_id = auth.uid() 
  AND profiles.role = 'admin'
));

CREATE POLICY "Employees can view their own notification logs"
ON public.attendance_notification_log FOR SELECT
USING (employee_id IN (
  SELECT id FROM employees WHERE user_id = auth.uid()
));

-- Enable pg_cron extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule daily attendance notifications to run at 10:00 AM
SELECT cron.schedule(
  'daily-attendance-notifications',
  '0 10 * * *',
  $$
  SELECT
    net.http_post(
        url:='https://ixblicchtdnqzeyrfqhi.supabase.co/functions/v1/daily-attendance-notifications',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml4YmxpY2NodGRucXpleXJmcWhpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUwNjY0NjEsImV4cCI6MjA3MDY0MjQ2MX0.f_jbenbSLsGXBWObVpK9WZX5ASyBKqOwMJBXBDuEhbA"}'::jsonb,
        body:='{"scheduled_run": true}'::jsonb
    ) as request_id;
  $$
);