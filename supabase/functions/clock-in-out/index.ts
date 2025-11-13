import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0';
import { corsHeaders } from '../_shared/cors.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

interface LogEntry {
  timestamp: string;
  step: string;
  duration?: number;
  data?: any;
  error?: string;
}

interface ClockInOutRequest {
  action: 'clock-in' | 'clock-out';
  employee_id: string;
  date: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const logs: LogEntry[] = [];
  const startTime = Date.now();

  const addLog = (step: string, data?: any, error?: string) => {
    logs.push({
      timestamp: new Date().toISOString(),
      step,
      duration: Date.now() - startTime,
      data,
      error,
    });
    console.log(`[${step}] ${error ? 'ERROR: ' + error : JSON.stringify(data)}`);
  };

  try {
    addLog('REQUEST_RECEIVED', { method: req.method, url: req.url });

    // Parse request body
    const requestBody = await req.json() as ClockInOutRequest;
    addLog('REQUEST_PARSED', { action: requestBody.action, employee_id: requestBody.employee_id });

    // Validate request
    if (!requestBody.action || !requestBody.employee_id || !requestBody.date) {
      addLog('VALIDATION_FAILED', null, 'Missing required fields');
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Missing required fields: action, employee_id, date',
          logs,
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    addLog('VALIDATION_PASSED');

    // Get client IP address
    const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0] || 
                     req.headers.get('x-real-ip') || 
                     'unknown';
    addLog('IP_DETECTED', { ip: clientIp });

    // Initialize Supabase client
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    addLog('SUPABASE_CLIENT_INITIALIZED');

    // Verify employee exists
    const employeeCheckStart = Date.now();
    const { data: employee, error: employeeError } = await supabase
      .from('employees')
      .select('id, full_name, email')
      .eq('id', requestBody.employee_id)
      .maybeSingle();

    addLog('EMPLOYEE_LOOKUP_COMPLETE', { 
      found: !!employee, 
      duration: Date.now() - employeeCheckStart 
    }, employeeError?.message);

    if (employeeError || !employee) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Employee not found',
          logs,
        }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const now = new Date().toISOString();

    if (requestBody.action === 'clock-in') {
      addLog('CLOCK_IN_OPERATION_STARTED');

      // Check if already clocked in today
      const checkStart = Date.now();
      const { data: existing, error: checkError } = await supabase
        .from('attendance')
        .select('id, clock_in_time')
        .eq('employee_id', requestBody.employee_id)
        .eq('date', requestBody.date)
        .maybeSingle();

      addLog('EXISTING_ATTENDANCE_CHECK', { 
        exists: !!existing,
        duration: Date.now() - checkStart 
      }, checkError?.message);

      if (existing) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Already clocked in today',
            logs,
          }),
          { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Insert clock-in record
      const insertStart = Date.now();
      const { data: attendance, error: insertError } = await supabase
        .from('attendance')
        .insert({
          employee_id: requestBody.employee_id,
          date: requestBody.date,
          clock_in_time: now,
          status: 'present',
          ip_address: clientIp,
        })
        .select()
        .single();

      addLog('CLOCK_IN_DB_INSERT', {
        success: !!attendance,
        duration: Date.now() - insertStart,
        attendance_id: attendance?.id,
      }, insertError?.message);

      if (insertError) {
        return new Response(
          JSON.stringify({
            success: false,
            error: insertError.message,
            logs,
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      addLog('CLOCK_IN_COMPLETED', { 
        total_duration: Date.now() - startTime,
        clock_in_time: now 
      });

      return new Response(
        JSON.stringify({
          success: true,
          data: {
            attendance_id: attendance.id,
            clock_in_time: now,
            employee_name: employee.full_name,
          },
          logs,
          total_duration_ms: Date.now() - startTime,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } else if (requestBody.action === 'clock-out') {
      addLog('CLOCK_OUT_OPERATION_STARTED');

      // Get existing attendance record
      const fetchStart = Date.now();
      const { data: existing, error: fetchError } = await supabase
        .from('attendance')
        .select('id, clock_in_time, clock_out_time')
        .eq('employee_id', requestBody.employee_id)
        .eq('date', requestBody.date)
        .maybeSingle();

      addLog('EXISTING_ATTENDANCE_FETCH', {
        found: !!existing,
        has_clock_in: !!existing?.clock_in_time,
        has_clock_out: !!existing?.clock_out_time,
        duration: Date.now() - fetchStart,
      }, fetchError?.message);

      if (!existing || !existing.clock_in_time) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'No clock-in record found for today',
            logs,
          }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Calculate total hours
      const clockInTime = new Date(existing.clock_in_time);
      const clockOutTime = new Date(now);
      const totalHours = (clockOutTime.getTime() - clockInTime.getTime()) / (1000 * 60 * 60);

      addLog('HOURS_CALCULATED', { 
        clock_in: existing.clock_in_time,
        clock_out: now,
        total_hours: totalHours.toFixed(2) 
      });

      // Update with clock-out time
      const updateStart = Date.now();
      const { data: updated, error: updateError } = await supabase
        .from('attendance')
        .update({
          clock_out_time: now,
          total_hours: totalHours,
        })
        .eq('id', existing.id)
        .select()
        .single();

      addLog('CLOCK_OUT_DB_UPDATE', {
        success: !!updated,
        duration: Date.now() - updateStart,
      }, updateError?.message);

      if (updateError) {
        return new Response(
          JSON.stringify({
            success: false,
            error: updateError.message,
            logs,
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      addLog('CLOCK_OUT_COMPLETED', { 
        total_duration: Date.now() - startTime,
        total_hours: totalHours.toFixed(2) 
      });

      return new Response(
        JSON.stringify({
          success: true,
          data: {
            attendance_id: updated.id,
            clock_in_time: existing.clock_in_time,
            clock_out_time: now,
            total_hours: totalHours,
            employee_name: employee.full_name,
          },
          logs,
          total_duration_ms: Date.now() - startTime,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        success: false,
        error: 'Invalid action',
        logs,
      }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    addLog('UNEXPECTED_ERROR', null, error.message);
    console.error('Unexpected error:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        logs,
        total_duration_ms: Date.now() - startTime,
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
