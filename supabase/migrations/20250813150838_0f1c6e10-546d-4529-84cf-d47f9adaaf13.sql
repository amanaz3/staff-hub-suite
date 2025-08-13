-- Create work schedules table for employee working hours
CREATE TABLE public.work_schedules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID NOT NULL,
  start_time TIME NOT NULL DEFAULT '09:00:00',
  end_time TIME NOT NULL DEFAULT '17:00:00',
  minimum_daily_hours DECIMAL(4,2) NOT NULL DEFAULT 8.00,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(employee_id)
);

-- Enable RLS on work_schedules
ALTER TABLE public.work_schedules ENABLE ROW LEVEL SECURITY;

-- Work schedules policies
CREATE POLICY "Admins can manage all work schedules" 
ON public.work_schedules 
FOR ALL 
USING (EXISTS (
  SELECT 1 FROM profiles 
  WHERE profiles.user_id = auth.uid() 
  AND profiles.role = 'admin'
));

CREATE POLICY "Employees can view their own work schedule" 
ON public.work_schedules 
FOR SELECT 
USING (employee_id IN (
  SELECT employees.id 
  FROM employees 
  WHERE employees.user_id = auth.uid()
));

-- Create attendance exceptions table
CREATE TABLE public.attendance_exceptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  attendance_id UUID NOT NULL,
  employee_id UUID NOT NULL,
  exception_type TEXT NOT NULL CHECK (exception_type IN ('late_arrival', 'early_departure')),
  reason TEXT NOT NULL,
  document_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  admin_comments TEXT,
  reviewed_by UUID,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on attendance_exceptions
ALTER TABLE public.attendance_exceptions ENABLE ROW LEVEL SECURITY;

-- Attendance exceptions policies
CREATE POLICY "Employees can create their own exceptions" 
ON public.attendance_exceptions 
FOR INSERT 
WITH CHECK (employee_id IN (
  SELECT employees.id 
  FROM employees 
  WHERE employees.user_id = auth.uid()
));

CREATE POLICY "Employees can view their own exceptions" 
ON public.attendance_exceptions 
FOR SELECT 
USING (employee_id IN (
  SELECT employees.id 
  FROM employees 
  WHERE employees.user_id = auth.uid()
));

CREATE POLICY "Admins can manage all exceptions" 
ON public.attendance_exceptions 
FOR ALL 
USING (EXISTS (
  SELECT 1 FROM profiles 
  WHERE profiles.user_id = auth.uid() 
  AND profiles.role = 'admin'
));

-- Add WFH capability to employees table
ALTER TABLE public.employees ADD COLUMN wfh_enabled BOOLEAN NOT NULL DEFAULT false;

-- Add WFH flag to attendance table
ALTER TABLE public.attendance ADD COLUMN is_wfh BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.attendance ADD COLUMN ip_address INET;

-- Create allowed IPs table
CREATE TABLE public.allowed_ips (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ip_address INET NOT NULL,
  description TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(ip_address)
);

-- Enable RLS on allowed_ips
ALTER TABLE public.allowed_ips ENABLE ROW LEVEL SECURITY;

-- Allowed IPs policies (admin only)
CREATE POLICY "Only admins can manage allowed IPs" 
ON public.allowed_ips 
FOR ALL 
USING (EXISTS (
  SELECT 1 FROM profiles 
  WHERE profiles.user_id = auth.uid() 
  AND profiles.role = 'admin'
));

-- Create employee leave balances table
CREATE TABLE public.employee_leave_balances (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID NOT NULL,
  leave_type_id UUID NOT NULL,
  allocated_days INTEGER NOT NULL DEFAULT 0,
  used_days INTEGER NOT NULL DEFAULT 0,
  year INTEGER NOT NULL DEFAULT EXTRACT(YEAR FROM CURRENT_DATE),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(employee_id, leave_type_id, year)
);

-- Enable RLS on employee_leave_balances
ALTER TABLE public.employee_leave_balances ENABLE ROW LEVEL SECURITY;

-- Employee leave balances policies
CREATE POLICY "Employees can view their own leave balances" 
ON public.employee_leave_balances 
FOR SELECT 
USING (employee_id IN (
  SELECT employees.id 
  FROM employees 
  WHERE employees.user_id = auth.uid()
));

CREATE POLICY "Admins can manage all leave balances" 
ON public.employee_leave_balances 
FOR ALL 
USING (EXISTS (
  SELECT 1 FROM profiles 
  WHERE profiles.user_id = auth.uid() 
  AND profiles.role = 'admin'
));

-- Create storage bucket for documents
INSERT INTO storage.buckets (id, name, public) 
VALUES ('hr-documents', 'hr-documents', false);

-- Storage policies for HR documents
CREATE POLICY "Employees can upload their own documents" 
ON storage.objects 
FOR INSERT 
WITH CHECK (
  bucket_id = 'hr-documents' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Employees can view their own documents" 
ON storage.objects 
FOR SELECT 
USING (
  bucket_id = 'hr-documents' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Admins can view all HR documents" 
ON storage.objects 
FOR SELECT 
USING (
  bucket_id = 'hr-documents' 
  AND EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.user_id = auth.uid() 
    AND profiles.role = 'admin'
  )
);

-- Create triggers for updated_at columns
CREATE TRIGGER update_work_schedules_updated_at
  BEFORE UPDATE ON public.work_schedules
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_attendance_exceptions_updated_at
  BEFORE UPDATE ON public.attendance_exceptions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_allowed_ips_updated_at
  BEFORE UPDATE ON public.allowed_ips
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_employee_leave_balances_updated_at
  BEFORE UPDATE ON public.employee_leave_balances
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();