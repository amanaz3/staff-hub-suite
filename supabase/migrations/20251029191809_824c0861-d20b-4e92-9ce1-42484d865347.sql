-- Add deleted_at and deleted_by columns to employees table
ALTER TABLE public.employees 
ADD COLUMN deleted_at TIMESTAMPTZ,
ADD COLUMN deleted_by UUID REFERENCES auth.users(id);

-- Create index for efficient filtering of deleted users
CREATE INDEX idx_employees_deleted_at ON public.employees(deleted_at) WHERE deleted_at IS NOT NULL;

-- Drop existing status check constraint
ALTER TABLE public.employees DROP CONSTRAINT IF EXISTS employees_status_check;

-- Add new status check constraint including 'deleted'
ALTER TABLE public.employees ADD CONSTRAINT employees_status_check 
CHECK (status IN ('active', 'inactive', 'terminated', 'deleted'));