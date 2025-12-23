import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.55.0";
import { Resend } from "npm:resend@2.0.0";
import { nowInGST, yesterdayInGST, formatTimeInGST, parseScheduledTimeAsUTC, getDayName, isWorkingDay } from '../_shared/timezone.ts';

// CORS headers
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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

interface AttendanceIssue {
  type: 'late' | 'early' | 'absent' | 'incomplete_hours';
  details: {
    late_hours?: number;
    early_hours?: number;
    total_hours?: number;
    minimum_hours?: number;
    clock_in_time?: string;
    clock_out_time?: string;
    scheduled_start?: string;
    scheduled_end?: string;
  };
}

interface EmployeeNotification {
  employee_id: string;
  user_id: string;
  employee_name: string;
  email: string;
  issues: AttendanceIssue[];
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const resend = new Resend(resendApiKey);

    // Get yesterday's date in GST
    const targetDate = yesterdayInGST();

    console.log(`Processing attendance notifications for ${targetDate} (GST)`);

    // Fetch all active employees with their work schedules
    const { data: employees, error: empError } = await supabase
      .from('employees')
      .select(`
        id,
        user_id,
        full_name,
        email,
        work_schedules!inner(
          start_time,
          end_time,
          minimum_daily_hours,
          working_days,
          is_active
        )
      `)
      .eq('status', 'active')
      .eq('work_schedules.is_active', true);

    if (empError) {
      console.error('Error fetching employees:', empError);
      throw empError;
    }

    console.log(`Found ${employees?.length || 0} active employees`);

    // Fetch attendance records for target date
    const { data: attendanceRecords, error: attError } = await supabase
      .from('attendance')
      .select('*')
      .eq('date', targetDate);

    if (attError) {
      console.error('Error fetching attendance:', attError);
      throw attError;
    }

    console.log(`Found ${attendanceRecords?.length || 0} attendance records`);

    const notifications: EmployeeNotification[] = [];

    // Process each employee
    for (const employee of employees || []) {
      const schedule = Array.isArray(employee.work_schedules) 
        ? employee.work_schedules[0] 
        : employee.work_schedules;
      
      if (!schedule) {
        console.log(`No schedule found for employee ${employee.full_name}`);
        continue;
      }

      // Check if yesterday was a working day for this employee
      const yesterdayDate = new Date(targetDate + "T00:00:00Z");
      if (!isWorkingDay(yesterdayDate, schedule.working_days || [])) {
        console.log(`Skipping ${employee.full_name} - ${getDayName(yesterdayDate)} is not a working day`);
        continue;
      }

      const attendance = attendanceRecords?.find(a => a.employee_id === employee.id);
      const issues: AttendanceIssue[] = [];

      if (!attendance || !attendance.clock_in_time) {
        // Employee was absent
        issues.push({
          type: 'absent',
          details: {}
        });
      } else {
        // Check for late check-in
        const clockInTimeUTC = new Date(attendance.clock_in_time); // Keep as UTC
        const scheduledStartUTC = parseScheduledTimeAsUTC(targetDate, schedule.start_time);
        
        if (clockInTimeUTC > scheduledStartUTC) {
          const lateMs = clockInTimeUTC.getTime() - scheduledStartUTC.getTime();
          const lateHours = lateMs / (1000 * 60 * 60);
          
          issues.push({
            type: 'late',
            details: {
              late_hours: Math.round(lateHours * 100) / 100,
              clock_in_time: formatTimeInGST(clockInTimeUTC),      // Display in GST
              scheduled_start: formatTimeInGST(scheduledStartUTC)  // Display in GST
            }
          });
        }

        // Check for early check-out
        if (attendance.clock_out_time) {
          const clockOutTimeUTC = new Date(attendance.clock_out_time); // Keep as UTC
          const scheduledEndUTC = parseScheduledTimeAsUTC(targetDate, schedule.end_time);
          
          if (clockOutTimeUTC < scheduledEndUTC) {
            const earlyMs = scheduledEndUTC.getTime() - clockOutTimeUTC.getTime();
            const earlyHours = earlyMs / (1000 * 60 * 60);
            
            issues.push({
              type: 'early',
              details: {
                early_hours: Math.round(earlyHours * 100) / 100,
                clock_out_time: formatTimeInGST(clockOutTimeUTC),  // Display in GST
                scheduled_end: formatTimeInGST(scheduledEndUTC)    // Display in GST
              }
            });
          }
        }

        // Check for incomplete hours
        const totalHours = attendance.total_hours || 0;
        const minimumHours = schedule.minimum_daily_hours || 8;
        
        if (totalHours < minimumHours) {
          issues.push({
            type: 'incomplete_hours',
            details: {
              total_hours: Math.round(totalHours * 100) / 100,
              minimum_hours: minimumHours
            }
          });
        }
      }

      // If any issues found, queue notification
      if (issues.length > 0) {
        notifications.push({
          employee_id: employee.id,
          user_id: employee.user_id,
          employee_name: employee.full_name,
          email: employee.email,
          issues
        });
      }
    }

    console.log(`Generated ${notifications.length} notifications`);

    // Send notifications and log them
    const results = {
      total: notifications.length,
      sent: 0,
      failed: 0,
      errors: [] as string[]
    };

    for (const notification of notifications) {
      try {
        const emailHtml = generateAttendanceEmailHTML(
          notification.employee_name,
          targetDate,
          notification.issues
        );

        // Get CC emails (manager or admin)
        const ccEmails = await getManagerOrAdminEmails(notification.employee_id, supabase);

        const emailPayload: any = {
          from: "HRFlow <noreply@amanacorporate.com>",
          to: [notification.email],
          subject: `Attendance Notice - ${new Date(targetDate).toLocaleDateString()}`,
          html: emailHtml,
        };

        // Only add cc if there are emails to CC
        if (ccEmails.length > 0) {
          emailPayload.cc = ccEmails;
        }

        const emailResponse = await resend.emails.send(emailPayload);

        console.log(`Email sent to ${notification.email}:`, emailResponse);

        // Create in-app notification
        try {
          await supabase.rpc('create_in_app_notification', {
            p_user_id: notification.user_id,
            p_employee_id: notification.employee_id,
            p_notification_type: 'attendance',
            p_title: 'Attendance Notice',
            p_message: `You have ${notification.issues.length} attendance issue${notification.issues.length > 1 ? 's' : ''} for ${new Date(targetDate).toLocaleDateString()}`,
            p_metadata: {
              attendance_date: targetDate,
              issues: notification.issues.map(i => i.type)
            },
            p_action_url: '/',
            p_priority: 'high'
          });
          console.log(`In-app notification created for ${notification.email}`);
        } catch (notifError) {
          console.error('Failed to create in-app notification:', notifError);
        }

        // Log to attendance_notification_log
        const { error: logError } = await supabase
          .from('attendance_notification_log')
          .insert({
            employee_id: notification.employee_id,
            notification_date: new Date().toISOString().split('T')[0],
            attendance_date: targetDate,
            issues_detected: notification.issues.map(i => i.type),
            issue_details: notification.issues.reduce((acc, issue) => ({
              ...acc,
              ...issue.details
            }), {}),
            email_sent_at: new Date().toISOString(),
            email_status: 'sent'
          });

        if (logError) {
          console.error('Error logging notification:', logError);
        }

        results.sent++;
      } catch (error: any) {
        console.error(`Failed to send email to ${notification.email}:`, error);
        results.failed++;
        results.errors.push(`${notification.email}: ${error.message}`);

        // Log failed attempt
        await supabase
          .from('attendance_notification_log')
          .insert({
            employee_id: notification.employee_id,
            notification_date: new Date().toISOString().split('T')[0],
            attendance_date: targetDate,
            issues_detected: notification.issues.map(i => i.type),
            issue_details: notification.issues.reduce((acc, issue) => ({
              ...acc,
              ...issue.details
            }), {}),
            email_status: 'failed'
          });
      }
    }

    console.log('Notification results:', results);

    return new Response(JSON.stringify({
      success: true,
      target_date: targetDate,
      results
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('Error in daily-attendance-notifications:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      details: error.toString()
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
};

function generateAttendanceEmailHTML(
  employeeName: string,
  attendanceDate: string,
  issues: AttendanceIssue[]
): string {
  const formattedDate = new Date(attendanceDate).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  let issuesList = '';

  issues.forEach(issue => {
    switch (issue.type) {
      case 'late':
        issuesList += `
          <li style="margin-bottom: 15px;">
            <strong style="color: #dc2626;">Late Check-in:</strong> 
            You clocked in at <strong>${issue.details.clock_in_time}</strong>, 
            which was <strong>${issue.details.late_hours} hours</strong> late.
            <br><small style="color: #666;">Scheduled: ${issue.details.scheduled_start}</small>
          </li>
        `;
        break;
      case 'early':
        issuesList += `
          <li style="margin-bottom: 15px;">
            <strong style="color: #ea580c;">Early Check-out:</strong> 
            You clocked out at <strong>${issue.details.clock_out_time}</strong>, 
            which was <strong>${issue.details.early_hours} hours</strong> early.
            <br><small style="color: #666;">Scheduled: ${issue.details.scheduled_end}</small>
          </li>
        `;
        break;
      case 'absent':
        issuesList += `
          <li style="margin-bottom: 15px;">
            <strong style="color: #b91c1c;">Absent:</strong> 
            No attendance record was found for this date.
            <br><small style="color: #666;">If this was a planned leave, please ensure you submitted a leave request.</small>
          </li>
        `;
        break;
      case 'incomplete_hours':
        issuesList += `
          <li style="margin-bottom: 15px;">
            <strong style="color: #c2410c;">Incomplete Hours:</strong> 
            You worked <strong>${issue.details.total_hours} hours</strong>, 
            which is below the required <strong>${issue.details.minimum_hours} hours</strong>.
          </li>
        `;
        break;
    }
  });

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
        <h1 style="color: white; margin: 0; font-size: 24px;">Attendance Notice</h1>
      </div>
      
      <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px;">
        <p style="font-size: 16px; margin-bottom: 20px;">Dear <strong>${employeeName}</strong>,</p>
        
        <p style="margin-bottom: 20px;">
          This is a notice regarding your attendance for <strong>${formattedDate}</strong>:
        </p>
        
        <ul style="list-style: none; padding: 0; background: #f9fafb; border-left: 4px solid #dc2626; padding: 20px; margin: 20px 0;">
          ${issuesList}
        </ul>
        
        <p style="margin-top: 20px; padding: 15px; background: #eff6ff; border-left: 4px solid #3b82f6; border-radius: 4px;">
          <strong>Action Required:</strong> Please review your attendance and submit an exception request if needed through the HRFlow system.
        </p>
        
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
        
        <p style="font-size: 14px; color: #6b7280; margin: 0;">
          Best regards,<br>
          <strong>HRFlow System</strong>
        </p>
      </div>
      
      <div style="text-align: center; padding: 20px; font-size: 12px; color: #9ca3af;">
        <p>This is an automated notification. Please do not reply to this email.</p>
      </div>
    </body>
    </html>
  `;
}

serve(handler);
