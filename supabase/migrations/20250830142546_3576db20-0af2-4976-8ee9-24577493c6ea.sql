-- Create documents table for staff documents management
CREATE TABLE public.staff_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID NOT NULL,
  document_type TEXT NOT NULL,
  document_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  issue_date DATE,
  expiry_date DATE,
  notification_sent_90_days BOOLEAN DEFAULT FALSE,
  notification_sent_30_days BOOLEAN DEFAULT FALSE,
  notification_sent_7_days BOOLEAN DEFAULT FALSE,
  status TEXT NOT NULL DEFAULT 'active',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  uploaded_by UUID NOT NULL
);

-- Enable RLS
ALTER TABLE public.staff_documents ENABLE ROW LEVEL SECURITY;

-- Create policies for document access
CREATE POLICY "Admins can manage all documents" 
ON public.staff_documents 
FOR ALL 
USING (EXISTS (
  SELECT 1 FROM profiles 
  WHERE profiles.user_id = auth.uid() 
  AND profiles.role = 'admin'
));

CREATE POLICY "Employees can view their own documents" 
ON public.staff_documents 
FOR SELECT 
USING (employee_id IN (
  SELECT employees.id 
  FROM employees 
  WHERE employees.user_id = auth.uid()
));

-- Add trigger for updated_at
CREATE TRIGGER update_staff_documents_updated_at
BEFORE UPDATE ON public.staff_documents
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create document types enum for consistency
CREATE TYPE document_type_enum AS ENUM (
  'emirates_id',
  'passport',
  'visa',
  'driving_license',
  'work_permit',
  'health_card',
  'insurance_card',
  'other'
);

-- Add check constraint for document types
ALTER TABLE public.staff_documents 
ADD CONSTRAINT valid_document_type 
CHECK (document_type IN ('emirates_id', 'passport', 'visa', 'driving_license', 'work_permit', 'health_card', 'insurance_card', 'other'));

-- Create index for expiry date queries
CREATE INDEX idx_staff_documents_expiry_date ON public.staff_documents(expiry_date) WHERE status = 'active';
CREATE INDEX idx_staff_documents_employee_id ON public.staff_documents(employee_id);

-- Insert some common document types data
INSERT INTO public.staff_documents (id, employee_id, document_type, document_name, file_url, issue_date, expiry_date, uploaded_by, status, notes) 
SELECT 
  gen_random_uuid(),
  (SELECT id FROM employees LIMIT 1),
  'emirates_id',
  'Sample Emirates ID',
  'https://example.com/sample.pdf',
  CURRENT_DATE - INTERVAL '1 year',
  CURRENT_DATE + INTERVAL '2 years',
  (SELECT user_id FROM profiles WHERE role = 'admin' LIMIT 1),
  'active',
  'Sample document for testing'
WHERE EXISTS (SELECT 1 FROM employees LIMIT 1) AND EXISTS (SELECT 1 FROM profiles WHERE role = 'admin' LIMIT 1);