import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import { Resend } from "npm:resend@2.0.0";
import { nowInGST, getDayName, isWorkingDay, formatTimeInGST } from '../_shared/timezone.ts';

// Helper function to format time from database time string
function formatTimeString(timeStr: string): string {
  const [hours, minutes] = timeStr.split(':');
  const hour = parseInt(hours);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${minutes} ${ampm}`;
}

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper function to get manager or admin emails for CC
async function getManagerOrAdminEmails(employeeId: string, supabase: any): Promise<string[]> {
  const ccEmails: string[] = [];

  // First try to get manager's email
  const { data: employee } = await supabase
    .from('employees')
    .select('manager_id')
    .eq('id', employeeId)
    .single();

  if (employee?.manager_id) {
    const { data: manager } = await supabase
      .from('employees')
      .select('email')
      .eq('id', employee.manager_id)
      .single();

    if (manager?.email) {
      ccEmails.push(manager.email);
    }
  }

  // If no manager email, get admin emails
  if (ccEmails.length === 0) {
    const { data: admins } = await supabase
      .from('profiles')
      .select('email')
      .eq('role', 'admin');

    if (admins) {
      ccEmails.push(...admins.map((admin: any) => admin.email));
    }
  }

  return ccEmails;
}

// Data structures
interface Issue {
  type: 'absent' | 'late' | 'early' | 'missed_clock_in' | 'missed_clock_out' | 'incomplete_hours';
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
  exceptionSubmitted: boolean;
  exceptionType?: string;
  exceptionStatus?: string;
}

interface DailyIssue {
  date: string;
  dayName: string;
  issues: Issue[];
}

interface EmployeeReport {
  employeeId: string;
  employeeName: string;
  employeeEmail: string;
  dailyIssues: DailyIssue[];
  totalIssues: number;
  issuesWithExceptions: number;
  issuesWithoutExceptions: number;
}

// Main handler
const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Starting weekly exception report generation...');

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Initialize Resend client
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    if (!resendApiKey) {
      throw new Error('RESEND_API_KEY is not configured');
    }
    const resend = new Resend(resendApiKey);

    // Calculate date range: previous Monday to Sunday in GST
    const today = nowInGST();
    const dayOfWeek = today.getDay(); // 0 = Sunday, 1 = Monday, etc.
    
    // Calculate the most recent Sunday (end of week)
    const daysToLastSunday = dayOfWeek === 0 ? 7 : dayOfWeek;
    const weekEnd = new Date(today);
    weekEnd.setDate(today.getDate() - daysToLastSunday);
    weekEnd.setHours(0, 0, 0, 0);

    // Calculate Monday (start of week)
    const weekStart = new Date(weekEnd);
    weekStart.setDate(weekEnd.getDate() - 6);

    console.log(`Processing week: ${weekStart.toISOString().split('T')[0]} to ${weekEnd.toISOString().split('T')[0]}`);

    // Fetch active employees with their work schedules
    const { data: employees, error: employeesError } = await supabase
      .from('employees')
      .select(`
        id,
        full_name,
        email,
        manager_id,
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

    if (employeesError) {
      console.error('Error fetching employees:', employeesError);
      throw employeesError;
    }

    console.log(`Found ${employees?.length || 0} active employees with schedules`);

    // Fetch all attendance records for the week
    const { data: attendanceRecords, error: attendanceError } = await supabase
      .from('attendance')
      .select('*')
      .gte('date', weekStart.toISOString().split('T')[0])
      .lte('date', weekEnd.toISOString().split('T')[0]);

    if (attendanceError) {
      console.error('Error fetching attendance:', attendanceError);
      throw attendanceError;
    }

    // Create a map for quick lookup
    const attendanceMap = new Map();
    attendanceRecords?.forEach((record: any) => {
      const key = `${record.employee_id}-${record.date}`;
      attendanceMap.set(key, record);
    });

    // Fetch all submitted exceptions for the week
    const { data: exceptions, error: exceptionsError } = await supabase
      .from('attendance_exceptions')
      .select('*')
      .gte('target_date', weekStart.toISOString().split('T')[0])
      .lte('target_date', weekEnd.toISOString().split('T')[0]);

    if (exceptionsError) {
      console.error('Error fetching exceptions:', exceptionsError);
      throw exceptionsError;
    }

    // Create a map for quick exception lookup
    const exceptionMap = new Map();
    exceptions?.forEach((exception: any) => {
      const key = `${exception.employee_id}-${exception.target_date}`;
      if (!exceptionMap.has(key)) {
        exceptionMap.set(key, []);
      }
      exceptionMap.get(key).push(exception);
    });

    // Process each employee
    const employeeReports: EmployeeReport[] = [];
    const notificationResults = { sent: 0, failed: 0, skipped: 0 };

    for (const employee of employees || []) {
      const schedule = employee.work_schedules[0];
      const dailyIssues: DailyIssue[] = [];

      // Loop through each day of the week
      for (let d = new Date(weekStart); d <= weekEnd; d.setDate(d.getDate() + 1)) {
        const currentDate = new Date(d);
        const dateStr = currentDate.toISOString().split('T')[0];
        const dayName = getDayName(currentDate);

        // Skip if not a working day for this employee
        if (!isWorkingDay(currentDate, schedule.working_days)) {
          continue;
        }

        const issues: Issue[] = [];
        const attendanceKey = `${employee.id}-${dateStr}`;
        const exceptionKey = `${employee.id}-${dateStr}`;
        const attendance = attendanceMap.get(attendanceKey);
        const submittedExceptions = exceptionMap.get(exceptionKey) || [];

        // Helper to check if exception exists for a type
        const hasException = (types: string[]) => {
          return submittedExceptions.some((ex: any) => 
            types.includes(ex.exception_type) && ex.status !== 'rejected'
          );
        };

        // Check for absent
        if (!attendance || !attendance.clock_in_time) {
          const exceptionSubmitted = hasException(['absent', 'wfh', 'official_business']);
          issues.push({
            type: 'absent',
            details: {},
            exceptionSubmitted,
            exceptionType: submittedExceptions.find((ex: any) => 
              ['absent', 'wfh', 'official_business'].includes(ex.exception_type)
            )?.exception_type,
            exceptionStatus: submittedExceptions.find((ex: any) => 
              ['absent', 'wfh', 'official_business'].includes(ex.exception_type)
            )?.status
          });
        } else {
          // Check for late arrival
          const scheduledStart = new Date(`${dateStr}T${schedule.start_time}`);
          const clockIn = new Date(attendance.clock_in_time);
          
          if (clockIn > scheduledStart) {
            const lateHours = (clockIn.getTime() - scheduledStart.getTime()) / (1000 * 60 * 60);
            const exceptionSubmitted = hasException(['late_arrival']);
            issues.push({
              type: 'late',
              details: {
                late_hours: lateHours,
                clock_in_time: formatTimeInGST(clockIn),
                scheduled_start: formatTimeString(schedule.start_time)
              },
              exceptionSubmitted,
              exceptionType: submittedExceptions.find((ex: any) => ex.exception_type === 'late_arrival')?.exception_type,
              exceptionStatus: submittedExceptions.find((ex: any) => ex.exception_type === 'late_arrival')?.status
            });
          }

          // Check for missed clock-out
          if (!attendance.clock_out_time) {
            const exceptionSubmitted = hasException(['missed_clock_out']);
            issues.push({
              type: 'missed_clock_out',
              details: {
                clock_in_time: formatTimeInGST(clockIn)
              },
              exceptionSubmitted,
              exceptionType: submittedExceptions.find((ex: any) => ex.exception_type === 'missed_clock_out')?.exception_type,
              exceptionStatus: submittedExceptions.find((ex: any) => ex.exception_type === 'missed_clock_out')?.status
            });
          } else {
            // Check for early departure
            const scheduledEnd = new Date(`${dateStr}T${schedule.end_time}`);
            const clockOut = new Date(attendance.clock_out_time);
            
            if (clockOut < scheduledEnd) {
              const earlyHours = (scheduledEnd.getTime() - clockOut.getTime()) / (1000 * 60 * 60);
              const exceptionSubmitted = hasException(['early_departure']);
              issues.push({
                type: 'early',
                details: {
                  early_hours: earlyHours,
                  clock_out_time: formatTimeInGST(clockOut),
                  scheduled_end: formatTimeString(schedule.end_time)
                },
                exceptionSubmitted,
                exceptionType: submittedExceptions.find((ex: any) => ex.exception_type === 'early_departure')?.exception_type,
                exceptionStatus: submittedExceptions.find((ex: any) => ex.exception_type === 'early_departure')?.status
              });
            }

            // Check for incomplete hours
            const totalHours = attendance.total_hours || 0;
            if (totalHours < schedule.minimum_daily_hours) {
              const exceptionSubmitted = hasException(['short_permission_personal', 'short_permission_official']);
              issues.push({
                type: 'incomplete_hours',
                details: {
                  total_hours: totalHours,
                  minimum_hours: schedule.minimum_daily_hours
                },
                exceptionSubmitted,
                exceptionType: submittedExceptions.find((ex: any) => 
                  ['short_permission_personal', 'short_permission_official'].includes(ex.exception_type)
                )?.exception_type,
                exceptionStatus: submittedExceptions.find((ex: any) => 
                  ['short_permission_personal', 'short_permission_official'].includes(ex.exception_type)
                )?.status
              });
            }
          }
        }

        // Add to daily issues if there are any issues
        if (issues.length > 0) {
          dailyIssues.push({
            date: dateStr,
            dayName,
            issues
          });
        }
      }

      // If employee has issues, create report
      if (dailyIssues.length > 0) {
        const totalIssues = dailyIssues.reduce((sum, day) => sum + day.issues.length, 0);
        const issuesWithExceptions = dailyIssues.reduce(
          (sum, day) => sum + day.issues.filter(issue => issue.exceptionSubmitted).length, 
          0
        );
        const issuesWithoutExceptions = totalIssues - issuesWithExceptions;

        employeeReports.push({
          employeeId: employee.id,
          employeeName: employee.full_name,
          employeeEmail: employee.email,
          dailyIssues,
          totalIssues,
          issuesWithExceptions,
          issuesWithoutExceptions
        });
      }
    }

    console.log(`Generated ${employeeReports.length} reports with issues`);

    // Send emails for each report
    for (const report of employeeReports) {
      try {
        // Generate email HTML
        const emailHTML = generateWeeklyReportEmailHTML(
          report.employeeName,
          weekStart.toISOString().split('T')[0],
          weekEnd.toISOString().split('T')[0],
          report.dailyIssues,
          report.totalIssues,
          report.issuesWithoutExceptions
        );

        // Get CC recipients (manager or admins)
        const ccEmails = await getManagerOrAdminEmails(report.employeeId, supabase);

        // Send email via Resend
        const emailResponse = await resend.emails.send({
          from: 'HRFlow <onboarding@resend.dev>',
          to: [report.employeeEmail],
          cc: ccEmails,
          subject: `Weekly Attendance Summary - Week of ${weekStart.toLocaleDateString()} to ${weekEnd.toLocaleDateString()}`,
          html: emailHTML,
        });

        console.log(`Email sent to ${report.employeeEmail}:`, emailResponse);
        notificationResults.sent++;

        // Create in-app notification
        try {
          // Get user_id from employee
          const { data: employee } = await supabase
            .from('employees')
            .select('user_id')
            .eq('id', report.employeeId)
            .single();

          if (employee?.user_id) {
            await supabase.rpc('create_in_app_notification', {
              p_user_id: employee.user_id,
              p_employee_id: report.employeeId,
              p_notification_type: 'attendance',
              p_title: 'Weekly Attendance Summary',
              p_message: `You have ${report.issuesWithoutExceptions} unresolved attendance issue${report.issuesWithoutExceptions !== 1 ? 's' : ''} this week that require${report.issuesWithoutExceptions === 1 ? 's' : ''} your attention`,
              p_metadata: {
                week_start: weekStart.toISOString().split('T')[0],
                week_end: weekEnd.toISOString().split('T')[0],
                total_issues: report.totalIssues,
                issues_without_exceptions: report.issuesWithoutExceptions
              },
              p_action_url: '/',
              p_priority: report.issuesWithoutExceptions > 0 ? 'high' : 'normal'
            });
            console.log(`In-app notification created for ${report.employeeEmail}`);
          }
        } catch (notifError) {
          console.error('Failed to create in-app notification:', notifError);
        }

        // Log to database
        await supabase
          .from('weekly_exception_report_log')
          .insert({
            employee_id: report.employeeId,
            report_date: new Date().toISOString().split('T')[0],
            week_start_date: weekStart.toISOString().split('T')[0],
            week_end_date: weekEnd.toISOString().split('T')[0],
            total_issues: report.totalIssues,
            issues_with_exceptions: report.issuesWithExceptions,
            issues_without_exceptions: report.issuesWithoutExceptions,
            issue_summary: report.dailyIssues,
            email_status: 'sent',
            email_sent_at: new Date().toISOString()
          });

      } catch (emailError) {
        console.error(`Failed to send email to ${report.employeeEmail}:`, emailError);
        notificationResults.failed++;

        // Log failed attempt
        await supabase
          .from('weekly_exception_report_log')
          .insert({
            employee_id: report.employeeId,
            report_date: new Date().toISOString().split('T')[0],
            week_start_date: weekStart.toISOString().split('T')[0],
            week_end_date: weekEnd.toISOString().split('T')[0],
            total_issues: report.totalIssues,
            issues_with_exceptions: report.issuesWithExceptions,
            issues_without_exceptions: report.issuesWithoutExceptions,
            issue_summary: report.dailyIssues,
            email_status: 'failed',
            email_sent_at: null
          });
      }
    }

    const summary = {
      success: true,
      message: 'Weekly exception reports processed',
      weekStart: weekStart.toISOString().split('T')[0],
      weekEnd: weekEnd.toISOString().split('T')[0],
      totalEmployees: employees?.length || 0,
      reportsGenerated: employeeReports.length,
      emailsSent: notificationResults.sent,
      emailsFailed: notificationResults.failed,
    };

    console.log('Summary:', summary);

    return new Response(JSON.stringify(summary), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Error in weekly-exception-report:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
};

// Email HTML generator
function generateWeeklyReportEmailHTML(
  employeeName: string,
  weekStart: string,
  weekEnd: string,
  dailyIssues: DailyIssue[],
  totalIssues: number,
  issuesWithoutExceptions: number
): string {
  const getIssueColor = (type: string): string => {
    switch (type) {
      case 'absent': return '#ef4444'; // red
      case 'late': return '#f97316'; // orange
      case 'early': return '#f97316'; // orange
      case 'missed_clock_in': return '#eab308'; // yellow
      case 'missed_clock_out': return '#eab308'; // yellow
      case 'incomplete_hours': return '#eab308'; // yellow
      default: return '#6b7280'; // gray
    }
  };

  const getIssueLabel = (type: string): string => {
    switch (type) {
      case 'absent': return 'Absent';
      case 'late': return 'Late Arrival';
      case 'early': return 'Early Departure';
      case 'missed_clock_in': return 'Missed Clock-In';
      case 'missed_clock_out': return 'Missed Clock-Out';
      case 'incomplete_hours': return 'Incomplete Hours';
      default: return type;
    }
  };

  const formatIssueDetails = (issue: Issue): string => {
    const parts = [];
    
    if (issue.details.late_hours !== undefined) {
      parts.push(`${issue.details.late_hours.toFixed(2)} hours late`);
      parts.push(`Clocked in: ${issue.details.clock_in_time}, Expected: ${issue.details.scheduled_start}`);
    }
    
    if (issue.details.early_hours !== undefined) {
      parts.push(`${issue.details.early_hours.toFixed(2)} hours early`);
      parts.push(`Clocked out: ${issue.details.clock_out_time}, Expected: ${issue.details.scheduled_end}`);
    }
    
    if (issue.details.total_hours !== undefined && issue.details.minimum_hours !== undefined) {
      parts.push(`Worked ${issue.details.total_hours.toFixed(2)} hours / Required ${issue.details.minimum_hours} hours`);
    }
    
    if (issue.details.clock_in_time && !issue.details.late_hours) {
      parts.push(`Clocked in: ${issue.details.clock_in_time}`);
    }

    return parts.join(' • ');
  };

  const issueRows = dailyIssues.map(day => {
    const issuesList = day.issues.map(issue => `
      <div style="margin: 8px 0; padding: 10px; background-color: #f9fafb; border-radius: 6px; border-left: 4px solid ${getIssueColor(issue.type)};">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
          <span style="font-weight: 600; color: ${getIssueColor(issue.type)};">
            ${getIssueLabel(issue.type)}
          </span>
          ${issue.exceptionSubmitted 
            ? `<span style="background-color: #10b981; color: white; padding: 3px 10px; border-radius: 12px; font-size: 12px; font-weight: 500;">✓ Applied</span>`
            : `<span style="background-color: #ef4444; color: white; padding: 3px 10px; border-radius: 12px; font-size: 12px; font-weight: 500;">✗ Not Applied</span>`
          }
        </div>
        ${formatIssueDetails(issue) ? `<div style="font-size: 13px; color: #6b7280;">${formatIssueDetails(issue)}</div>` : ''}
      </div>
    `).join('');

    return `
      <tr>
        <td style="padding: 16px; border-bottom: 1px solid #e5e7eb; vertical-align: top;">
          <div style="font-weight: 600; color: #111827;">${new Date(day.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</div>
          <div style="font-size: 13px; color: #6b7280;">${day.dayName}</div>
        </td>
        <td style="padding: 16px; border-bottom: 1px solid #e5e7eb;">
          ${issuesList}
        </td>
      </tr>
    `;
  }).join('');

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Weekly Attendance Summary</title>
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #374151; margin: 0; padding: 0; background-color: #f3f4f6;">
      <div style="max-width: 680px; margin: 0 auto; padding: 20px;">
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 32px; border-radius: 12px 12px 0 0; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 28px; font-weight: 700;">Weekly Attendance Summary</h1>
          <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0 0; font-size: 16px;">
            ${new Date(weekStart).toLocaleDateString('en-US', { month: 'long', day: 'numeric' })} - ${new Date(weekEnd).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
          </p>
        </div>

        <!-- Main Content -->
        <div style="background-color: white; padding: 32px; border-radius: 0 0 12px 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
          <p style="font-size: 16px; margin: 0 0 24px 0;">Dear <strong>${employeeName}</strong>,</p>
          
          <p style="font-size: 15px; color: #4b5563; margin: 0 0 24px 0;">
            This is your weekly attendance summary. We've identified <strong>${totalIssues}</strong> attendance issue${totalIssues !== 1 ? 's' : ''} that may require your attention.
          </p>

          <!-- Summary Stats -->
          <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 16px; margin: 0 0 32px 0; border-radius: 6px;">
            <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 16px;">
              <div>
                <div style="font-size: 13px; color: #92400e; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600;">Total Issues</div>
                <div style="font-size: 28px; font-weight: 700; color: #92400e;">${totalIssues}</div>
              </div>
              <div>
                <div style="font-size: 13px; color: #92400e; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600;">Days Affected</div>
                <div style="font-size: 28px; font-weight: 700; color: #92400e;">${dailyIssues.length}</div>
              </div>
              ${issuesWithoutExceptions > 0 ? `
              <div>
                <div style="font-size: 13px; color: #92400e; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600;">Action Needed</div>
                <div style="font-size: 28px; font-weight: 700; color: #dc2626;">${issuesWithoutExceptions}</div>
              </div>
              ` : ''}
            </div>
          </div>

          <!-- Daily Issues Table -->
          <h2 style="font-size: 20px; color: #111827; margin: 0 0 16px 0; font-weight: 700;">Daily Breakdown</h2>
          
          <table style="width: 100%; border-collapse: collapse; margin: 0 0 32px 0; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
            <thead>
              <tr style="background-color: #f9fafb;">
                <th style="padding: 14px 16px; text-align: left; font-size: 13px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 2px solid #e5e7eb;">Date</th>
                <th style="padding: 14px 16px; text-align: left; font-size: 13px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 2px solid #e5e7eb;">Issues & Status</th>
              </tr>
            </thead>
            <tbody>
              ${issueRows}
            </tbody>
          </table>

          ${issuesWithoutExceptions > 0 ? `
          <!-- Action Required -->
          <div style="background-color: #fee2e2; border: 2px solid #ef4444; padding: 20px; border-radius: 8px; margin: 0 0 24px 0;">
            <h3 style="color: #991b1b; margin: 0 0 12px 0; font-size: 18px; font-weight: 700;">⚠️ Action Required</h3>
            <p style="color: #7f1d1d; margin: 0 0 16px 0; font-size: 15px;">
              You have <strong>${issuesWithoutExceptions}</strong> attendance issue${issuesWithoutExceptions !== 1 ? 's' : ''} without an exception request. 
              Please submit your exception requests through the HRFlow system as soon as possible.
            </p>
            <p style="color: #7f1d1d; margin: 0; font-size: 14px;">
              <strong>How to apply:</strong> Log in to HRFlow → Absences → Submit New Exception
            </p>
          </div>
          ` : `
          <!-- All Clear -->
          <div style="background-color: #d1fae5; border: 2px solid #10b981; padding: 20px; border-radius: 8px; margin: 0 0 24px 0;">
            <h3 style="color: #065f46; margin: 0 0 12px 0; font-size: 18px; font-weight: 700;">✓ All Exceptions Applied</h3>
            <p style="color: #065f46; margin: 0; font-size: 15px;">
              Great! You've submitted exception requests for all attendance issues. No further action is needed at this time.
            </p>
          </div>
          `}

          <!-- Footer -->
          <div style="border-top: 1px solid #e5e7eb; padding-top: 24px; margin-top: 24px;">
            <p style="font-size: 14px; color: #6b7280; margin: 0 0 8px 0;">
              If you have any questions or concerns about this report, please contact the HR department.
            </p>
            <p style="font-size: 14px; color: #6b7280; margin: 0;">
              <strong>HR Department</strong><br>
              This is an automated weekly report from HRFlow.
            </p>
          </div>
        </div>

        <!-- Email Footer -->
        <div style="text-align: center; padding: 20px; font-size: 12px; color: #9ca3af;">
          <p style="margin: 0;">© ${new Date().getFullYear()} HRFlow. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

serve(handler);