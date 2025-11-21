-- Remove duplicate daily attendance notification cron job (2 PM GST schedule)
-- Keep only the 12 PM GST schedule (Job ID 3: 0 8 * * *)
SELECT cron.unschedule(2);