-- Phase 1: Add new columns to leave_requests table
ALTER TABLE leave_requests
ADD COLUMN IF NOT EXISTS payment_type text CHECK (payment_type IN ('full_pay', 'half_pay', 'unpaid')) DEFAULT 'full_pay',
ADD COLUMN IF NOT EXISTS medical_certificate_url text,
ADD COLUMN IF NOT EXISTS relationship text,
ADD COLUMN IF NOT EXISTS is_first_hajj boolean DEFAULT false;

-- Phase 2: Add probation tracking to employees table
ALTER TABLE employees
ADD COLUMN IF NOT EXISTS probation_end_date date;

-- Set probation_end_date for existing employees (6 months after hire_date)
UPDATE employees
SET probation_end_date = hire_date + INTERVAL '6 months'
WHERE probation_end_date IS NULL AND hire_date IS NOT NULL;

-- Phase 3: Enhance employee_leave_balances table
ALTER TABLE employee_leave_balances
ADD COLUMN IF NOT EXISTS auto_calculated boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS service_months_at_allocation integer DEFAULT 0;

-- Phase 4: Insert UAE Labour Law compliant leave types
INSERT INTO leave_types (name, description, max_days, is_active) VALUES
  ('Parental Leave', 'For fathers within 6 months of child birth - 5 working days paid', 5, true),
  ('Compassionate Leave', 'Bereavement leave - 5 days for spouse, 3 days for parent/child/sibling/grandparent/grandchild', 5, true),
  ('Study Leave', 'Educational purposes - 10 working days per year (requires enrollment proof)', 10, true),
  ('Hajj Leave', 'Pilgrimage leave - 30 days unpaid (once per employment after 2 years service)', 30, true)
ON CONFLICT DO NOTHING;

-- Update existing leave types with proper descriptions
UPDATE leave_types SET 
  description = 'Annual vacation leave - 30 calendar days per year (after 1 year service), 2 days per month for 6-12 months service',
  max_days = 30
WHERE name = 'Annual Leave';

UPDATE leave_types SET 
  description = 'Medical leave - Maximum 90 days per year (15 days full pay, 30 days half pay, 45 days unpaid). Requires medical certificate for >3 days',
  max_days = 90
WHERE name = 'Sick Leave';

UPDATE leave_types SET 
  description = 'Maternity leave - 60 calendar days (45 days full pay, 15 days half pay) + optional 45 days unpaid',
  max_days = 60
WHERE name = 'Maternity Leave';

-- Phase 5: Create helper function to check if probation is completed
CREATE OR REPLACE FUNCTION is_probation_completed(p_employee_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN probation_end_date IS NULL THEN true
    WHEN probation_end_date <= CURRENT_DATE THEN true
    ELSE false
  END
  FROM employees
  WHERE id = p_employee_id;
$$;

-- Phase 6: Create function to calculate leave entitlement based on service duration
CREATE OR REPLACE FUNCTION calculate_leave_entitlement(
  p_employee_id uuid,
  p_leave_type_name text,
  p_year integer
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hire_date date;
  v_service_months integer;
  v_probation_completed boolean;
  v_entitlement integer := 0;
BEGIN
  -- Get employee details
  SELECT hire_date, is_probation_completed(id)
  INTO v_hire_date, v_probation_completed
  FROM employees
  WHERE id = p_employee_id;

  IF v_hire_date IS NULL THEN
    RETURN 0;
  END IF;

  -- Calculate service months as of the requested year
  v_service_months := EXTRACT(YEAR FROM AGE(
    DATE (p_year || '-12-31'), 
    v_hire_date
  )) * 12 + EXTRACT(MONTH FROM AGE(
    DATE (p_year || '-12-31'), 
    v_hire_date
  ));

  -- Calculate entitlement based on leave type
  CASE p_leave_type_name
    WHEN 'Annual Leave' THEN
      IF v_service_months < 6 THEN
        v_entitlement := 0;
      ELSIF v_service_months < 12 THEN
        -- 2 days per month for 6-12 months
        v_entitlement := (v_service_months - 5) * 2;
      ELSE
        -- 30 days after 1 year
        v_entitlement := 30;
      END IF;
    
    WHEN 'Sick Leave' THEN
      -- 90 days per year after probation
      IF v_probation_completed THEN
        v_entitlement := 90;
      ELSE
        v_entitlement := 0;
      END IF;
    
    WHEN 'Maternity Leave' THEN
      -- 60 days (available regardless of service duration)
      v_entitlement := 60;
    
    WHEN 'Parental Leave' THEN
      -- 5 days per year
      v_entitlement := 5;
    
    WHEN 'Compassionate Leave' THEN
      -- Not annually allocated, granted as needed
      v_entitlement := 0;
    
    WHEN 'Study Leave' THEN
      -- 10 days per year
      v_entitlement := 10;
    
    WHEN 'Hajj Leave' THEN
      -- 30 days once after 2 years service
      IF v_service_months >= 24 THEN
        v_entitlement := 30;
      ELSE
        v_entitlement := 0;
      END IF;
    
    ELSE
      v_entitlement := 0;
  END CASE;

  RETURN v_entitlement;
END;
$$;

-- Phase 7: Create function to validate leave requests based on UAE law
CREATE OR REPLACE FUNCTION validate_leave_request()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_leave_type_name text;
  v_probation_completed boolean;
  v_hire_date date;
  v_service_months integer;
  v_sick_days_used integer;
BEGIN
  -- Get leave type name
  SELECT name INTO v_leave_type_name
  FROM leave_types
  WHERE id = NEW.leave_type_id;

  -- Get employee details
  SELECT is_probation_completed(id), hire_date
  INTO v_probation_completed, v_hire_date
  FROM employees
  WHERE id = NEW.employee_id;

  -- Calculate service months
  v_service_months := EXTRACT(YEAR FROM AGE(CURRENT_DATE, v_hire_date)) * 12 
                    + EXTRACT(MONTH FROM AGE(CURRENT_DATE, v_hire_date));

  -- Validation rules
  CASE v_leave_type_name
    WHEN 'Sick Leave' THEN
      -- Must complete probation
      IF NOT v_probation_completed THEN
        RAISE EXCEPTION 'Sick leave is only available after completing probation period';
      END IF;

      -- Require medical certificate for >3 days
      IF NEW.total_days > 3 AND NEW.medical_certificate_url IS NULL THEN
        RAISE EXCEPTION 'Medical certificate is required for sick leave exceeding 3 days';
      END IF;

      -- Calculate payment type based on cumulative sick days used this year
      SELECT COALESCE(SUM(total_days), 0)
      INTO v_sick_days_used
      FROM leave_requests
      WHERE employee_id = NEW.employee_id
        AND leave_type_id = NEW.leave_type_id
        AND status = 'approved'
        AND EXTRACT(YEAR FROM start_date) = EXTRACT(YEAR FROM NEW.start_date)
        AND id != NEW.id;

      -- Auto-set payment type
      IF v_sick_days_used + NEW.total_days <= 15 THEN
        NEW.payment_type := 'full_pay';
      ELSIF v_sick_days_used + NEW.total_days <= 45 THEN
        NEW.payment_type := 'half_pay';
      ELSE
        NEW.payment_type := 'unpaid';
      END IF;

    WHEN 'Hajj Leave' THEN
      -- Must have 2 years service
      IF v_service_months < 24 THEN
        RAISE EXCEPTION 'Hajj leave requires minimum 2 years of service';
      END IF;

      -- Can only be taken once
      IF EXISTS (
        SELECT 1 FROM leave_requests
        WHERE employee_id = NEW.employee_id
          AND leave_type_id = NEW.leave_type_id
          AND status = 'approved'
      ) THEN
        RAISE EXCEPTION 'Hajj leave can only be taken once per employment';
      END IF;

      NEW.payment_type := 'unpaid';

    WHEN 'Maternity Leave' THEN
      -- Auto-set payment type based on days
      IF NEW.total_days <= 45 THEN
        NEW.payment_type := 'full_pay';
      ELSIF NEW.total_days <= 60 THEN
        NEW.payment_type := 'half_pay';
      ELSE
        NEW.payment_type := 'unpaid';
      END IF;

    WHEN 'Parental Leave' THEN
      NEW.payment_type := 'full_pay';

    WHEN 'Study Leave' THEN
      -- Typically paid, but can be configured
      IF NEW.payment_type IS NULL THEN
        NEW.payment_type := 'full_pay';
      END IF;

    WHEN 'Compassionate Leave' THEN
      NEW.payment_type := 'full_pay';
      
      -- Validate relationship is provided
      IF NEW.relationship IS NULL OR NEW.relationship = '' THEN
        RAISE EXCEPTION 'Relationship must be specified for compassionate leave';
      END IF;

  END CASE;

  RETURN NEW;
END;
$$;

-- Create trigger for leave request validation
DROP TRIGGER IF EXISTS validate_leave_request_trigger ON leave_requests;
CREATE TRIGGER validate_leave_request_trigger
  BEFORE INSERT OR UPDATE ON leave_requests
  FOR EACH ROW
  EXECUTE FUNCTION validate_leave_request();

-- Phase 8: Create function to auto-allocate annual leave balances
CREATE OR REPLACE FUNCTION auto_allocate_leave_balances(p_year integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_employee RECORD;
  v_leave_type RECORD;
  v_entitlement integer;
  v_service_months integer;
BEGIN
  -- Loop through all active employees
  FOR v_employee IN 
    SELECT id, hire_date
    FROM employees
    WHERE status = 'active'
  LOOP
    -- Calculate service months
    v_service_months := EXTRACT(YEAR FROM AGE(
      DATE (p_year || '-12-31'), 
      v_employee.hire_date
    )) * 12 + EXTRACT(MONTH FROM AGE(
      DATE (p_year || '-12-31'), 
      v_employee.hire_date
    ));

    -- Loop through leave types that should be auto-allocated
    FOR v_leave_type IN
      SELECT id, name
      FROM leave_types
      WHERE is_active = true
        AND name IN ('Annual Leave', 'Sick Leave', 'Maternity Leave', 'Parental Leave', 'Study Leave', 'Hajj Leave')
    LOOP
      -- Calculate entitlement
      v_entitlement := calculate_leave_entitlement(
        v_employee.id,
        v_leave_type.name,
        p_year
      );

      -- Insert or update balance
      INSERT INTO employee_leave_balances (
        employee_id,
        leave_type_id,
        year,
        allocated_days,
        used_days,
        auto_calculated,
        service_months_at_allocation
      ) VALUES (
        v_employee.id,
        v_leave_type.id,
        p_year,
        v_entitlement,
        0,
        true,
        v_service_months
      )
      ON CONFLICT (employee_id, leave_type_id, year)
      DO UPDATE SET
        allocated_days = v_entitlement,
        auto_calculated = true,
        service_months_at_allocation = v_service_months,
        updated_at = NOW();
    END LOOP;
  END LOOP;
END;
$$;