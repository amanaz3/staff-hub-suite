-- Add CHECK constraint to enforce 4-digit staff_id format
ALTER TABLE employees 
ADD CONSTRAINT staff_id_format_check 
CHECK (staff_id IS NULL OR staff_id ~ '^\d{4}$');