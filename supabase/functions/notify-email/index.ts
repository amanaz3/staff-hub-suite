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
  employeeId?: string;
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

async function getManagerOrAdminEmails(employeeId: string, supabase: any): Promise<string[]> {
  try {
    // First try to get the employee's manager
    const { data: employee } = await supabase
      .from('employees')
      .select('manager_id, email')
      .eq('id', employeeId)
      .single();
    
    if (employee?.manager_id) {
      // Get manager's email
      const { data: manager } = await supabase
        .from('employees')
        .select('email')
        .eq('id', employee.manager_id)
        .single();
      
      if (manager?.email && manager.email !== employee.email) {
        return [manager.email];
      }
    }
    
    // If no manager or manager has no email, get all admin emails from user_roles table
    const { data: adminRoles } = await supabase
      .from('user_roles')
      .select('user_id')
      .eq('role', 'admin');
    
    if (adminRoles && adminRoles.length > 0) {
      const adminUserIds = adminRoles.map((ar: any) => ar.user_id);
      const { data: adminEmployees } = await supabase
        .from('employees')
        .select('email')
        .in('user_id', adminUserIds);
      
      return adminEmployees?.map((a: any) => a.email).filter((email: string) => email && email !== employee?.email) || [];
    }
    
    return [];
  } catch (error) {
    console.error('Error fetching manager/admin emails:', error);
    return [];
  }
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

    const { type, action, recipientEmail, recipientName, submitterName, employeeId, details }: EmailNotificationRequest = await req.json();

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

    // Get CC emails (manager or admin)
    let ccEmails: string[] = [];
    if (employeeId) {
      ccEmails = await getManagerOrAdminEmails(employeeId, supabase);
    }

    // Send email via Resend
    const resend = new Resend(Deno.env.get('RESEND_API_KEY'));
    
    const emailPayload: any = {
      from: 'HRFlow <noreply@amanacorporate.com>',
      to: [recipientEmail],
      subject: subject,
      html: htmlContent,
    };

    // Only add cc if there are emails to CC
    if (ccEmails.length > 0) {
      emailPayload.cc = ccEmails;
    }

    const { data: emailResult, error: emailError } = await resend.emails.send(emailPayload);

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

    // Create in-app notification
    if (employeeId) {
      try {
        // Get user_id from employee_id
        const { data: employee } = await supabase
          .from('employees')
          .select('user_id')
          .eq('id', employeeId)
          .single();

        if (employee?.user_id) {
          let notificationTitle = '';
          let notificationMessage = '';
          let notificationType = '';
          let actionUrl = '/';
          let priority = 'normal';

          if (type === 'attendance_exception') {
            notificationType = 'exception_request';
            if (action === 'submitted') {
              notificationTitle = 'Exception Request Submitted';
              notificationMessage = 'Your attendance exception request has been submitted and is pending review';
              actionUrl = '/';
            } else if (action === 'approved') {
              notificationTitle = 'Exception Request Approved';
              notificationMessage = `Your ${details.exceptionType} exception request has been approved`;
              actionUrl = '/';
              priority = 'high';
            } else if (action === 'rejected') {
              notificationTitle = 'Exception Request Rejected';
              notificationMessage = `Your ${details.exceptionType} exception request has been rejected`;
              actionUrl = '/';
              priority = 'high';
            }
          } else if (type === 'leave_request') {
            notificationType = 'leave_request';
            if (action === 'submitted') {
              notificationTitle = 'Leave Request Submitted';
              notificationMessage = `Your ${details.leaveType} leave request has been submitted and is pending review`;
              actionUrl = '/';
            } else if (action === 'approved') {
              notificationTitle = 'Leave Request Approved';
              notificationMessage = `Your ${details.leaveType} leave request from ${details.startDate} to ${details.endDate} has been approved`;
              actionUrl = '/';
              priority = 'high';
            } else if (action === 'rejected') {
              notificationTitle = 'Leave Request Rejected';
              notificationMessage = `Your ${details.leaveType} leave request has been rejected`;
              actionUrl = '/';
              priority = 'high';
            }
          }

          if (notificationTitle) {
            await supabase.rpc('create_in_app_notification', {
              p_user_id: employee.user_id,
              p_employee_id: employeeId,
              p_notification_type: notificationType,
              p_title: notificationTitle,
              p_message: notificationMessage,
              p_metadata: details,
              p_action_url: actionUrl,
              p_priority: priority
            });
            console.log(`In-app notification created for user ${employee.user_id}`);
          }
        }
      } catch (notifError) {
        console.error('Failed to create in-app notification:', notifError);
      }
    }

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