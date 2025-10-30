import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from 'npm:resend@4.0.0';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

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
    
    // If no manager or manager has no email, get all admin emails
    const { data: admins } = await supabase
      .from('profiles')
      .select('email')
      .eq('role', 'admin');
    
    return admins?.map((a: any) => a.email).filter((email: string) => email && email !== employee?.email) || [];
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
    console.log('Starting document expiry notification check...');
    
    // Create Supabase client
    const supabaseServiceRole = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const today = new Date();
    const in7Days = new Date(today.getTime() + (7 * 24 * 60 * 60 * 1000));
    const in30Days = new Date(today.getTime() + (30 * 24 * 60 * 60 * 1000));
    const in90Days = new Date(today.getTime() + (90 * 24 * 60 * 60 * 1000));

    // Get documents expiring in 7 days (not yet notified)
    const { data: docs7Days, error: error7 } = await supabaseServiceRole
      .from('staff_documents')
      .select(`
        *,
        employees!inner(full_name, email, user_id),
        profiles!employees_user_id_fkey(email as admin_email, role)
      `)
      .eq('status', 'active')
      .lte('expiry_date', in7Days.toISOString().split('T')[0])
      .eq('notification_sent_7_days', false)
      .not('expiry_date', 'is', null);

    // Get documents expiring in 30 days (not yet notified)
    const { data: docs30Days, error: error30 } = await supabaseServiceRole
      .from('staff_documents')
      .select(`
        *,
        employees!inner(full_name, email, user_id),
        profiles!employees_user_id_fkey(email as admin_email, role)
      `)
      .eq('status', 'active')
      .lte('expiry_date', in30Days.toISOString().split('T')[0])
      .gt('expiry_date', in7Days.toISOString().split('T')[0])
      .eq('notification_sent_30_days', false)
      .not('expiry_date', 'is', null);

    // Get documents expiring in 90 days (not yet notified)
    const { data: docs90Days, error: error90 } = await supabaseServiceRole
      .from('staff_documents')
      .select(`
        *,
        employees!inner(full_name, email, user_id),
        profiles!employees_user_id_fkey(email as admin_email, role)
      `)
      .eq('status', 'active')
      .lte('expiry_date', in90Days.toISOString().split('T')[0])
      .gt('expiry_date', in30Days.toISOString().split('T')[0])
      .eq('notification_sent_90_days', false)
      .not('expiry_date', 'is', null);

    if (error7 || error30 || error90) {
      throw new Error(`Database query failed: ${error7?.message || error30?.message || error90?.message}`);
    }

    console.log(`Found ${docs7Days?.length || 0} documents expiring in 7 days`);
    console.log(`Found ${docs30Days?.length || 0} documents expiring in 30 days`);
    console.log(`Found ${docs90Days?.length || 0} documents expiring in 90 days`);

    // Get admin emails for notifications
    const { data: adminProfiles, error: adminError } = await supabaseServiceRole
      .from('profiles')
      .select('email')
      .eq('role', 'admin');

    if (adminError) {
      console.error('Error fetching admin profiles:', adminError);
    }

    const adminEmails = adminProfiles?.map(p => p.email) || [];
    console.log(`Found ${adminEmails.length} admin emails for notifications`);

    let notificationsSent = 0;

    // Process 7-day notifications
    if (docs7Days && docs7Days.length > 0) {
      for (const doc of docs7Days) {
        await sendExpiryNotification(doc, 7, adminEmails, supabaseServiceRole);
        
        // Update notification status
        await supabaseServiceRole
          .from('staff_documents')
          .update({ notification_sent_7_days: true })
          .eq('id', doc.id);
          
        notificationsSent++;
      }
    }

    // Process 30-day notifications
    if (docs30Days && docs30Days.length > 0) {
      for (const doc of docs30Days) {
        await sendExpiryNotification(doc, 30, adminEmails, supabaseServiceRole);
        
        // Update notification status
        await supabaseServiceRole
          .from('staff_documents')
          .update({ notification_sent_30_days: true })
          .eq('id', doc.id);
          
        notificationsSent++;
      }
    }

    // Process 90-day notifications
    if (docs90Days && docs90Days.length > 0) {
      for (const doc of docs90Days) {
        await sendExpiryNotification(doc, 90, adminEmails, supabaseServiceRole);
        
        // Update notification status
        await supabaseServiceRole
          .from('staff_documents')
          .update({ notification_sent_90_days: true })
          .eq('id', doc.id);
          
        notificationsSent++;
      }
    }

    console.log(`Sent ${notificationsSent} expiry notifications`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Processed expiry notifications. Sent ${notificationsSent} notifications.`,
        stats: {
          docs7Days: docs7Days?.length || 0,
          docs30Days: docs30Days?.length || 0,
          docs90Days: docs90Days?.length || 0,
          notificationsSent
        }
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      }
    );

  } catch (error: any) {
    console.error("Error processing document expiry notifications:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

async function sendExpiryNotification(
  document: any, 
  daysUntilExpiry: number, 
  adminEmails: string[],
  supabase: any
) {
  const documentTypeMap: Record<string, string> = {
    'emirates_id': 'Emirates ID',
    'passport': 'Passport',
    'visa': 'Visa',
    'driving_license': 'Driving License',
    'work_permit': 'Work Permit',
    'health_card': 'Health Card',
    'insurance_card': 'Insurance Card',
    'other': 'Other Document'
  };

  const documentTypeName = documentTypeMap[document.document_type] || document.document_type;
  const employeeName = document.employees?.full_name || 'Unknown Employee';
  const expiryDate = new Date(document.expiry_date).toLocaleDateString();

  const subject = `🚨 Document Expiry Alert: ${documentTypeName} - ${employeeName}`;
  
  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
        <h2 style="color: #dc3545; margin: 0 0 10px 0;">⚠️ Document Expiry Notification</h2>
        <p style="margin: 0; color: #6c757d;">Automated reminder from HRFlow System</p>
      </div>
      
      <div style="background-color: white; padding: 20px; border: 1px solid #dee2e6; border-radius: 8px;">
        <h3 style="color: #495057; margin-top: 0;">Document Details</h3>
        
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
          <tr>
            <td style="padding: 8px 0; font-weight: bold; color: #495057;">Employee:</td>
            <td style="padding: 8px 0; color: #6c757d;">${employeeName}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; font-weight: bold; color: #495057;">Document Type:</td>
            <td style="padding: 8px 0; color: #6c757d;">${documentTypeName}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; font-weight: bold; color: #495057;">Document Name:</td>
            <td style="padding: 8px 0; color: #6c757d;">${document.document_name}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; font-weight: bold; color: #495057;">Expiry Date:</td>
            <td style="padding: 8px 0; color: #dc3545; font-weight: bold;">${expiryDate}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; font-weight: bold; color: #495057;">Days Until Expiry:</td>
            <td style="padding: 8px 0; color: ${daysUntilExpiry <= 7 ? '#dc3545' : daysUntilExpiry <= 30 ? '#ffc107' : '#28a745'}; font-weight: bold;">${daysUntilExpiry} days</td>
          </tr>
        </table>
        
        <div style="background-color: ${daysUntilExpiry <= 7 ? '#f8d7da' : daysUntilExpiry <= 30 ? '#fff3cd' : '#d1ecf1'}; 
                    color: ${daysUntilExpiry <= 7 ? '#721c24' : daysUntilExpiry <= 30 ? '#856404' : '#0c5460'}; 
                    padding: 15px; border-radius: 5px; margin-bottom: 20px;">
          <strong>Action Required:</strong> Please ensure this document is renewed before the expiry date to maintain compliance.
        </div>
        
        <div style="text-align: center; margin-top: 30px;">
          <a href="${document.file_url}" style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
            View Document
          </a>
        </div>
        
        <hr style="margin: 30px 0; border: none; border-top: 1px solid #dee2e6;">
        
        <p style="text-align: center; color: #6c757d; font-size: 14px; margin: 0;">
          This is an automated notification from the HRFlow Document Management System.<br>
          Generated on ${new Date().toLocaleString()}
        </p>
      </div>
    </div>
  `;

  const resend = new Resend(Deno.env.get('RESEND_API_KEY'));

  // Send notification to employee email (if available) with CC to manager/admin
  if (document.employees?.email) {
    try {
      // Get CC emails (manager or admin)
      const ccEmails = await getManagerOrAdminEmails(document.employee_id, supabase);

      const employeeEmailPayload: any = {
        from: 'HRFlow <noreply@amanacorporate.com>',
        to: [document.employees.email],
        subject: subject,
        html: htmlContent,
      };

      // Only add cc if there are emails to CC
      if (ccEmails.length > 0) {
        employeeEmailPayload.cc = ccEmails;
      }

      const { data, error } = await resend.emails.send(employeeEmailPayload);

      if (error) {
        console.error(`Failed to send notification to employee ${document.employees.email}:`, error);
        
        // Log failed email
        await supabase.from('email_logs').insert({
          to_email: document.employees.email,
          subject: subject,
          content: htmlContent,
          status: 'failed',
          error_message: error.message
        });
      } else {
        console.log(`Notification sent successfully to employee: ${document.employees.email}`);
        
        // Log successful email
        await supabase.from('email_logs').insert({
          to_email: document.employees.email,
          subject: subject,
          content: htmlContent,
          status: 'sent',
          sent_at: new Date().toISOString()
        });
      }
    } catch (error: any) {
      console.error(`Exception sending notification to employee ${document.employees.email}:`, error);
    }
  }

  // Send notification to admin emails
  for (const adminEmail of adminEmails) {
    try {
      const adminHtmlContent = `
        <div style="background-color: #e9ecef; padding: 10px; border-radius: 5px; margin-bottom: 20px;">
          <strong>Admin Notification:</strong> This document expiry notification requires your attention.
        </div>
        ${htmlContent}
      `;

      const { data, error } = await resend.emails.send({
        from: 'HRFlow <noreply@amanacorporate.com>',
        to: [adminEmail],
        subject: `[ADMIN] ${subject}`,
        html: adminHtmlContent,
      });

      if (error) {
        console.error(`Failed to send admin notification to ${adminEmail}:`, error);
        
        // Log failed email
        await supabase.from('email_logs').insert({
          to_email: adminEmail,
          subject: `[ADMIN] ${subject}`,
          content: adminHtmlContent,
          status: 'failed',
          error_message: error.message
        });
      } else {
        console.log(`Admin notification sent successfully to: ${adminEmail}`);
        
        // Log successful email
        await supabase.from('email_logs').insert({
          to_email: adminEmail,
          subject: `[ADMIN] ${subject}`,
          content: adminHtmlContent,
          status: 'sent',
          sent_at: new Date().toISOString()
        });
      }
    } catch (error: any) {
      console.error(`Exception sending admin notification to ${adminEmail}:`, error);
    }
  }
}

serve(handler);