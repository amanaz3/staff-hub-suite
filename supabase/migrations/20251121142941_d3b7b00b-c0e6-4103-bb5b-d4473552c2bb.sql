-- Create payroll_records table
CREATE TABLE public.payroll_records (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  
  -- Pay period information
  pay_period_start DATE NOT NULL,
  pay_period_end DATE NOT NULL,
  payment_date DATE NOT NULL,
  
  -- Salary components
  fixed_salary NUMERIC(10, 2) NOT NULL DEFAULT 0,
  variable_salary NUMERIC(10, 2) NOT NULL DEFAULT 0,
  allowances NUMERIC(10, 2) NOT NULL DEFAULT 0,
  
  -- Calculated gross
  gross_pay NUMERIC(10, 2) NOT NULL DEFAULT 0,
  
  -- Deductions
  deductions_tax NUMERIC(10, 2) NOT NULL DEFAULT 0,
  deductions_insurance NUMERIC(10, 2) NOT NULL DEFAULT 0,
  deductions_pension NUMERIC(10, 2) NOT NULL DEFAULT 0,
  deductions_other NUMERIC(10, 2) NOT NULL DEFAULT 0,
  
  -- Calculated totals
  total_deductions NUMERIC(10, 2) NOT NULL DEFAULT 0,
  net_pay NUMERIC(10, 2) NOT NULL DEFAULT 0,
  
  -- Payslip document
  payslip_pdf_url TEXT,
  
  -- Status and metadata
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'processed', 'paid')),
  notes TEXT,
  
  -- Audit fields
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  
  -- Ensure unique pay period per employee
  CONSTRAINT unique_employee_pay_period UNIQUE (employee_id, pay_period_start, pay_period_end)
);

-- Create index for faster queries
CREATE INDEX idx_payroll_records_employee_id ON public.payroll_records(employee_id);
CREATE INDEX idx_payroll_records_payment_date ON public.payroll_records(payment_date DESC);
CREATE INDEX idx_payroll_records_status ON public.payroll_records(status);

-- Create trigger for updated_at
CREATE TRIGGER update_payroll_records_updated_at
  BEFORE UPDATE ON public.payroll_records
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable Row Level Security
ALTER TABLE public.payroll_records ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Employees can view their own payroll records
CREATE POLICY "Employees can view their own payroll records"
  ON public.payroll_records
  FOR SELECT
  USING (
    employee_id IN (
      SELECT id FROM public.employees WHERE user_id = auth.uid()
    )
  );

-- Admins can view all payroll records
CREATE POLICY "Admins can view all payroll records"
  ON public.payroll_records
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Admins can insert payroll records
CREATE POLICY "Admins can insert payroll records"
  ON public.payroll_records
  FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Admins can update payroll records
CREATE POLICY "Admins can update payroll records"
  ON public.payroll_records
  FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Admins can delete payroll records
CREATE POLICY "Admins can delete payroll records"
  ON public.payroll_records
  FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Create a trigger to auto-calculate totals
CREATE OR REPLACE FUNCTION public.calculate_payroll_totals()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Calculate gross pay
  NEW.gross_pay := NEW.fixed_salary + NEW.variable_salary + NEW.allowances;
  
  -- Calculate total deductions
  NEW.total_deductions := NEW.deductions_tax + NEW.deductions_insurance + 
                          NEW.deductions_pension + NEW.deductions_other;
  
  -- Calculate net pay
  NEW.net_pay := NEW.gross_pay - NEW.total_deductions;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER calculate_payroll_totals_trigger
  BEFORE INSERT OR UPDATE ON public.payroll_records
  FOR EACH ROW
  EXECUTE FUNCTION public.calculate_payroll_totals();

-- Create storage bucket for payslip PDFs
INSERT INTO storage.buckets (id, name, public)
VALUES ('payslip-documents', 'payslip-documents', false)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for payslip documents storage
CREATE POLICY "Employees can view their own payslips"
  ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'payslip-documents' AND
    (storage.foldername(name))[1] IN (
      SELECT id::text FROM public.employees WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can view all payslips"
  ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'payslip-documents' AND
    has_role(auth.uid(), 'admin'::app_role)
  );

CREATE POLICY "Admins can upload payslips"
  ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'payslip-documents' AND
    has_role(auth.uid(), 'admin'::app_role)
  );

CREATE POLICY "Admins can update payslips"
  ON storage.objects
  FOR UPDATE
  USING (
    bucket_id = 'payslip-documents' AND
    has_role(auth.uid(), 'admin'::app_role)
  );

CREATE POLICY "Admins can delete payslips"
  ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'payslip-documents' AND
    has_role(auth.uid(), 'admin'::app_role)
  );