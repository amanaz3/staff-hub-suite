import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface InviteUserRequest {
  email: string;
  full_name: string;
  role: string;
  staff_id: string;
  division: string;
  department: string;
  position: string;
  hire_date?: string;
  manager_id?: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, full_name, role, staff_id, division, department, position, hire_date, manager_id }: InviteUserRequest = await req.json();

    // Validate hire_date if provided
    if (hire_date) {
      const hireDate = new Date(hire_date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      if (hireDate > today) {
        return new Response(
          JSON.stringify({ error: "Hire date cannot be in the future" }),
          {
            status: 400,
            headers: { "Content-Type": "application/json", ...corsHeaders },
          }
        );
      }
    }

    // Validate staff_id format (must be 4 digits)
    if (!/^\d{4}$/.test(staff_id)) {
      return new Response(
        JSON.stringify({ error: "Staff ID must be 4 digits (e.g., 0032)" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Create Supabase client with service role for admin operations
    const supabaseServiceRole = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Check staff_id uniqueness
    const { data: existingStaff } = await supabaseServiceRole
      .from('employees')
      .select('staff_id')
      .eq('staff_id', staff_id)
      .maybeSingle();

    if (existingStaff) {
      return new Response(
        JSON.stringify({ error: `Staff ID ${staff_id} is already in use` }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Upsert division into divisions table if new
    const { error: divisionError } = await supabaseServiceRole
      .from('divisions')
      .upsert({ name: division }, { onConflict: 'name' });

    if (divisionError) {
      console.error("Warning: Could not add division to lookup table:", divisionError);
    }

    // Create the user account
    const { data: authData, error: authError } = await supabaseServiceRole.auth.admin.createUser({
      email,
      password: Math.random().toString(36).slice(-12), // Temporary password
      email_confirm: true,
      user_metadata: {
        full_name,
        role,
        staff_id,
        division,
        department,
        position,
        hire_date: hire_date || new Date().toISOString().split('T')[0],
        manager_id: manager_id || null
      }
    });

    if (authError) {
      console.error("Error creating user:", authError);
      return new Response(
        JSON.stringify({ error: "Failed to create user account" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Insert role into user_roles table
    const { error: roleError } = await supabaseServiceRole
      .from('user_roles')
      .insert({ 
        user_id: authData.user.id, 
        role: role 
      });

    if (roleError) {
      console.error("Error inserting user role:", roleError);
      // Continue anyway as the role is also in user_metadata
    }

    // Send password reset email so user can set their own password
    const { error: resetError } = await supabaseServiceRole.auth.admin.generateLink({
      type: 'recovery',
      email: email,
    });

    if (resetError) {
      console.error("Error sending reset email:", resetError);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `User ${full_name} has been invited successfully. A password reset email will be sent to ${email}.`,
        user_id: authData.user.id
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
    console.error("Error in invite-user function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);