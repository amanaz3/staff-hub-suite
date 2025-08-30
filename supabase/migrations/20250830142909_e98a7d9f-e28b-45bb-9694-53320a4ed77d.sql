-- Enable pg_cron and pg_net extensions for scheduled tasks
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Schedule document expiry notifications to run daily at 9:00 AM
SELECT cron.schedule(
  'document-expiry-check-daily',
  '0 9 * * *', -- Daily at 9:00 AM
  $$
  SELECT
    net.http_post(
        url:='https://ixblicchtdnqzeyrfqhi.supabase.co/functions/v1/document-expiry-notifications',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml4YmxpY2NodGRucXpleXJmcWhpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUwNjY0NjEsImV4cCI6MjA3MDY0MjQ2MX0.f_jbenbSLsGXBWObVpK9WZX5ASyBKqOwMJBXBDuEhbA"}'::jsonb,
        body:='{"scheduled_run": true}'::jsonb
    ) as request_id;
  $$
);