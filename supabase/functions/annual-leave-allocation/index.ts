import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get current year or year from request
    const { year } = await req.json().catch(() => ({ year: new Date().getFullYear() }));
    const targetYear = year || new Date().getFullYear();

    console.log(`Starting annual leave allocation for year ${targetYear}`);

    // Call the auto_allocate_leave_balances function
    const { data, error } = await supabase.rpc('auto_allocate_leave_balances', {
      p_year: targetYear
    });

    if (error) {
      console.error('Error allocating leave balances:', error);
      throw error;
    }

    // Get summary of allocations
    const { data: balances, error: balancesError } = await supabase
      .from('employee_leave_balances')
      .select(`
        *,
        employee:employees(full_name, employee_id),
        leave_type:leave_types(name)
      `)
      .eq('year', targetYear)
      .eq('auto_calculated', true);

    if (balancesError) {
      console.error('Error fetching allocation summary:', balancesError);
    }

    const summary = {
      year: targetYear,
      total_allocations: balances?.length || 0,
      employees_affected: new Set(balances?.map(b => b.employee_id)).size,
      allocations_by_type: balances?.reduce((acc: any, balance: any) => {
        const typeName = balance.leave_type?.name || 'Unknown';
        acc[typeName] = (acc[typeName] || 0) + 1;
        return acc;
      }, {})
    };

    console.log('Allocation complete:', summary);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Successfully allocated leave balances for ${targetYear}`,
        summary
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error: any) {
    console.error('Error in annual-leave-allocation function:', error);
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
});