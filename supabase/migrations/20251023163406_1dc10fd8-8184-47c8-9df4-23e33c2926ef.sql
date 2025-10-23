-- Add missing foreign key constraint from work_schedules to employees
ALTER TABLE public.work_schedules 
ADD CONSTRAINT work_schedules_employee_id_fkey 
FOREIGN KEY (employee_id) 
REFERENCES public.employees(id) 
ON DELETE CASCADE;

-- Create index for performance optimization
CREATE INDEX IF NOT EXISTS idx_work_schedules_employee_id 
ON public.work_schedules(employee_id);

-- Enable required extensions for cron scheduling
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Schedule daily attendance notifications at 8:00 AM
SELECT cron.schedule(
  'daily-attendance-notifications-job',
  '0 8 * * *', -- Run at 8:00 AM every day
  $$
  SELECT net.http_post(
    url := 'https://ixblicchtdnqzeyrfqhi.supabase.co/functions/v1/daily-attendance-notifications',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml4YmxpY2NodGRucXpleXJmcWhpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUwNjY0NjEsImV4cCI6MjA3MDY0MjQ2MX0.f_jbenbSLsGXBWObVpK9WZX5ASyBKqOwMJBXBDuEhbA"}'::jsonb,
    body := '{"scheduled_run": true}'::jsonb
  ) as request_id;
  $$
);