import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0';
import { Resend } from 'npm:resend@4.0.0';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface EmailNotificationRequest {
  type: 'attendance_exception' | 'leave_request' | 'test_email';
  action: 'submitted' | 'approved' | 'rejected' | 'sent';
  recipientEmail: string;
  recipientName: string;
  submitterName: string;
  details: {
    exceptionType?: string;
    leaveType?: string;
    startDate?: string;
    endDate?: string;
    reason?: string;
    adminComments?: string;
    subject?: string;
    message?: string;
  };
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { type, action, recipientEmail, recipientName, submitterName, details }: EmailNotificationRequest = await req.json();

    // Generate email content based on type and action
    let subject = '';
    let htmlContent = '';

    if (type === 'test_email') {
      subject = details.subject || 'Test Email from HRFlow';
      htmlContent = `
        <h2>Test Email</h2>
        <p>Hello ${recipientName},</p>
        <p>${details.message || 'This is a test email from the HRFlow system.'}</p>
        <p>Best regards,<br>HRFlow System</p>
      `;
    } else if (type === 'attendance_exception') {
      subject = `Attendance Exception ${action.charAt(0).toUpperCase() + action.slice(1)}`;
      
      if (action === 'submitted') {
        htmlContent = `
          <h2>New Attendance Exception Request</h2>
          <p>Dear Admin,</p>
          <p><strong>${submitterName}</strong> has submitted an attendance exception request.</p>
          <p><strong>Exception Type:</strong> ${details.exceptionType}</p>
          <p><strong>Reason:</strong> ${details.reason}</p>
          <p>Please review this request in the admin dashboard.</p>
        `;
      } else {
        htmlContent = `
          <h2>Attendance Exception Request ${action.charAt(0).toUpperCase() + action.slice(1)}</h2>
          <p>Dear ${recipientName},</p>
          <p>Your attendance exception request has been <strong>${action}</strong>.</p>
          <p><strong>Exception Type:</strong> ${details.exceptionType}</p>
          <p><strong>Reason:</strong> ${details.reason}</p>
          ${details.adminComments ? `<p><strong>Admin Comments:</strong> ${details.adminComments}</p>` : ''}
        `;
      }
    } else if (type === 'leave_request') {
      subject = `Leave Request ${action.charAt(0).toUpperCase() + action.slice(1)}`;
      
      if (action === 'submitted') {
        htmlContent = `
          <h2>New Leave Request</h2>
          <p>Dear Admin,</p>
          <p><strong>${submitterName}</strong> has submitted a leave request.</p>
          <p><strong>Leave Type:</strong> ${details.leaveType}</p>
          <p><strong>Start Date:</strong> ${details.startDate}</p>
          <p><strong>End Date:</strong> ${details.endDate}</p>
          <p><strong>Reason:</strong> ${details.reason}</p>
          <p>Please review this request in the admin dashboard.</p>
        `;
      } else {
        htmlContent = `
          <h2>Leave Request ${action.charAt(0).toUpperCase() + action.slice(1)}</h2>
          <p>Dear ${recipientName},</p>
          <p>Your leave request has been <strong>${action}</strong>.</p>
          <p><strong>Leave Type:</strong> ${details.leaveType}</p>
          <p><strong>Start Date:</strong> ${details.startDate}</p>
          <p><strong>End Date:</strong> ${details.endDate}</p>
          ${details.adminComments ? `<p><strong>Admin Comments:</strong> ${details.adminComments}</p>` : ''}
        `;
      }
    }

    // Send email via Resend
    const resend = new Resend(Deno.env.get('RESEND_API_KEY'));
    
    const { data: emailResult, error: emailError } = await resend.emails.send({
      from: 'HRFlow <onboarding@resend.dev>',
      to: [recipientEmail],
      subject: subject,
      html: htmlContent,
    });

    if (emailError) {
      console.error('Failed to send email via Resend:', emailError);
      
      // Log to database for audit trail
      await supabase.from('email_logs').insert({
        to_email: recipientEmail,
        subject: subject,
        content: htmlContent,
        status: 'failed',
        error_message: emailError.message
      });
      
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Failed to send email',
          details: emailError.message
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }
    
    console.log("Email sent successfully via Resend:", emailResult);
    
    // Log successful email to database
    await supabase.from('email_logs').insert({
      to_email: recipientEmail,
      subject: subject,
      content: htmlContent,
      status: 'sent',
      sent_at: new Date().toISOString()
    });

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Email sent successfully',
        data: emailResult 
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );

  } catch (error: any) {
    console.error("Error in notify-email function:", error);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);