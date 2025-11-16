-- Create system_settings table
CREATE TABLE IF NOT EXISTS public.system_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key TEXT UNIQUE NOT NULL,
  setting_value JSONB NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- Only admins can view settings
CREATE POLICY "Admins can view system settings"
  ON public.system_settings FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Only admins can manage settings
CREATE POLICY "Admins can manage system settings"
  ON public.system_settings FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Insert default daily hours deduction setting
INSERT INTO public.system_settings (setting_key, setting_value, description)
VALUES (
  'daily_hours_deduction',
  '{"hours": 0, "minutes": 0, "enabled": false}'::jsonb,
  'Daily hours deduction for breaks/lunch (subtracted from each working day before weekly calculations)'
);

-- Create updated_at trigger
CREATE TRIGGER update_system_settings_updated_at
  BEFORE UPDATE ON public.system_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();