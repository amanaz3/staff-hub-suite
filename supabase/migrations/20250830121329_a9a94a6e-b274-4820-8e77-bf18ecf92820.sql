-- Fix search_path for all functions to resolve security warning
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.calculate_attendance_hours()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Only calculate if both clock_in_time and clock_out_time are set
  IF NEW.clock_in_time IS NOT NULL AND NEW.clock_out_time IS NOT NULL THEN
    NEW.total_hours = EXTRACT(EPOCH FROM (NEW.clock_out_time - NEW.clock_in_time)) / 3600;
  END IF;
  
  -- Set updated_at
  NEW.updated_at = now();
  
  RETURN NEW;
END;
$function$;