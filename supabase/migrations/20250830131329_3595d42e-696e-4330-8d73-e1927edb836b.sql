-- Fix the function search path security issue
CREATE OR REPLACE FUNCTION public.send_notification_email(
  p_to_email TEXT,
  p_subject TEXT,
  p_html_content TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSON;
BEGIN
  -- Log the email send attempt
  INSERT INTO public.email_logs (
    to_email,
    subject,
    content,
    status,
    created_at
  ) VALUES (
    p_to_email,
    p_subject,
    p_html_content,
    'sent',
    NOW()
  );
  
  -- Return success result
  result := json_build_object(
    'success', true,
    'message', 'Email logged and will be sent via configured SMTP',
    'to_email', p_to_email,
    'subject', p_subject
  );
  
  RETURN result;
END;
$$;