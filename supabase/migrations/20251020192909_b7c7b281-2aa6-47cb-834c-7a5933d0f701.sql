-- Drop the old constraint that only allowed late_arrival and early_departure
ALTER TABLE attendance_exceptions 
DROP CONSTRAINT IF EXISTS attendance_exceptions_exception_type_check;

-- Add the new constraint with all valid exception types
ALTER TABLE attendance_exceptions
ADD CONSTRAINT attendance_exceptions_exception_type_check
CHECK (exception_type = ANY (ARRAY[
  'short_permission_personal'::text,
  'short_permission_official'::text,
  'wfh'::text,
  'missed_clock_in'::text,
  'missed_clock_out'::text,
  'wrong_time'::text,
  'late_arrival'::text,
  'early_departure'::text
]));