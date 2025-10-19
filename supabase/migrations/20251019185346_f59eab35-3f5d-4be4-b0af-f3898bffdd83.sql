-- Add foreign key constraint from staff_documents to employees
ALTER TABLE staff_documents
ADD CONSTRAINT staff_documents_employee_id_fkey 
FOREIGN KEY (employee_id) 
REFERENCES employees(id) 
ON DELETE CASCADE;