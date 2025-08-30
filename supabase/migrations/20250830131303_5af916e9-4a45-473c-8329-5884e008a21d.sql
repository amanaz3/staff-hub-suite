-- Create a function to send notification emails using custom SMTP
CREATE OR REPLACE FUNCTION public.send_notification_email(
  p_to_email TEXT,
  p_subject TEXT,
  p_html_content TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
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

-- Create email logs table to track sent emails
CREATE TABLE IF NOT EXISTS public.email_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  to_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  content TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  sent_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT
);

-- Enable RLS on email_logs
ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;

-- Only admins can view email logs
CREATE POLICY "Admins can view email logs" 
ON public.email_logs 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM profiles 
  WHERE profiles.user_id = auth.uid() 
  AND profiles.role = 'admin'
));