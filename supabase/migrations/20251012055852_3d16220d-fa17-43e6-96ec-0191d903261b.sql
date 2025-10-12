-- Add duration_hours column for short permission tracking
ALTER TABLE attendance_exceptions 
ADD COLUMN IF NOT EXISTS duration_hours numeric(4,2) 
CHECK (duration_hours IS NULL OR (duration_hours > 0 AND duration_hours <= 2.5));

COMMENT ON COLUMN attendance_exceptions.duration_hours IS 'Duration in hours for short permission (Personal only), max 2.5 hours per day';