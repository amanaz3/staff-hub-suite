-- Create missing attendance record for Shihas on 2025-11-11 (WFH approved)
INSERT INTO attendance (
  employee_id, 
  date, 
  status, 
  is_wfh, 
  notes, 
  created_at
) VALUES (
  '46f8a1de-da71-46a0-9499-de219a1298f7',
  '2025-11-11',
  'present',
  true,
  'WFH approved via exception request - manually corrected',
  now()
)
ON CONFLICT (employee_id, date) DO UPDATE SET 
  is_wfh = true, 
  status = 'present', 
  notes = EXCLUDED.notes;