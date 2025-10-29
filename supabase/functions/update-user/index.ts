import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.55.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface UpdateUserRequest {
  employee_id: string;
  full_name: string;
  email: string;
  staff_id: string;
  role: 'admin' | 'staff' | 'manager';
  division: string;
  department: string;
  position: string;
  status: string;
  hire_date?: string;
  manager_id?: string;
  deleted_at?: string;
  deleted_by?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    // Get the current user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);

    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    // Check if requesting user is admin
    const { data: isAdminData, error: adminCheckError } = await supabaseAdmin
      .rpc('has_role', { _user_id: user.id, _role: 'admin' });

    if (adminCheckError || !isAdminData) {
      throw new Error('Admin access required');
    }

    const {
      employee_id,
      full_name,
      email,
      staff_id,
      role,
      division,
      department,
      position,
      status,
      hire_date,
      manager_id,
      deleted_at,
      deleted_by
    }: UpdateUserRequest = await req.json();

    console.log('Updating user:', { employee_id, email, staff_id });

    // Validate hire_date if provided
    if (hire_date) {
      const hireDate = new Date(hire_date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      if (hireDate > today) {
        throw new Error('Hire date cannot be in the future');
      }
    }

    // Validate staff_id format (4 digits)
    if (!/^\d{4}$/.test(staff_id)) {
      throw new Error('Staff ID must be 4 digits');
    }

    // Check if staff_id is unique (if changed)
    const { data: existingStaffId } = await supabaseAdmin
      .from('employees')
      .select('id, staff_id')
      .eq('staff_id', staff_id)
      .neq('id', employee_id)
      .single();

    if (existingStaffId) {
      throw new Error('Staff ID already in use');
    }

    // Get the employee's user_id
    const { data: employeeData, error: employeeError } = await supabaseAdmin
      .from('employees')
      .select('user_id, email')
      .eq('id', employee_id)
      .single();

    if (employeeError || !employeeData) {
      throw new Error('Employee not found');
    }

    const userId = employeeData.user_id;

    // Prevent admin from removing their own admin role
    if (userId === user.id && role !== 'admin') {
      throw new Error('Cannot remove your own admin role');
    }

    // Prepare employee update with optional hire_date, manager_id, deleted_at, and deleted_by
    const employeeUpdate: any = {
      full_name,
      email,
      staff_id,
      division,
      department,
      position,
      status,
      manager_id: manager_id || null,
      updated_at: new Date().toISOString()
    };

    // Handle soft delete fields
    if (status === 'deleted') {
      employeeUpdate.deleted_at = deleted_at || new Date().toISOString();
      employeeUpdate.deleted_by = deleted_by || user.id;
    } else if (deleted_at === null) {
      // Restoring a deleted user - clear deletion fields
      employeeUpdate.deleted_at = null;
      employeeUpdate.deleted_by = null;
    }

    // Add hire_date and auto-calculate probation_end_date if hire_date is provided
    if (hire_date) {
      employeeUpdate.hire_date = hire_date;
      const hireDate = new Date(hire_date);
      const probationEnd = new Date(hireDate);
      probationEnd.setMonth(probationEnd.getMonth() + 6);
      employeeUpdate.probation_end_date = probationEnd.toISOString().split('T')[0];
    }

    // Update employees table
    const { error: updateEmployeeError } = await supabaseAdmin
      .from('employees')
      .update(employeeUpdate)
      .eq('id', employee_id);

    if (updateEmployeeError) {
      console.error('Error updating employee:', updateEmployeeError);
      throw new Error('Failed to update employee data');
    }

    // Update profiles table
    const { error: updateProfileError } = await supabaseAdmin
      .from('profiles')
      .update({
        full_name,
        email,
        department,
        position,
        role,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId);

    if (updateProfileError) {
      console.error('Error updating profile:', updateProfileError);
      throw new Error('Failed to update profile');
    }

    // Update user_roles table if role changed
    const { data: currentRole } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .single();

    if (currentRole && currentRole.role !== role) {
      // Delete old role
      await supabaseAdmin
        .from('user_roles')
        .delete()
        .eq('user_id', userId);

      // Insert new role
      const { error: roleError } = await supabaseAdmin
        .from('user_roles')
        .insert({ user_id: userId, role });

      if (roleError) {
        console.error('Error updating role:', roleError);
        throw new Error('Failed to update user role');
      }
    }

    // Update auth.users email if changed
    if (email !== employeeData.email) {
      const { error: emailError } = await supabaseAdmin.auth.admin.updateUserById(
        userId,
        { email }
      );

      if (emailError) {
        console.error('Error updating auth email:', emailError);
        // Don't throw - employee data is already updated
      }
    }

    // Disable/enable auth account based on status
    if (status === 'deleted' || status === 'inactive') {
      // Disable auth access for deleted or inactive users
      const { error: banError } = await supabaseAdmin.auth.admin.updateUserById(
        userId,
        { ban_duration: status === 'deleted' ? 'indefinite' : '876000h' } // 876000h = 100 years for inactive
      );

      if (banError) {
        console.error('Error disabling user auth:', banError);
      }
    } else if (status === 'active') {
      // Re-enable auth access for active users
      const { error: unbanError } = await supabaseAdmin.auth.admin.updateUserById(
        userId,
        { ban_duration: 'none' }
      );

      if (unbanError) {
        console.error('Error enabling user auth:', unbanError);
      }
    }

    console.log('User updated successfully:', employee_id);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'User updated successfully'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error: any) {
    console.error('Error in update-user function:', error);
    return new Response(
      JSON.stringify({
        error: error.message || 'An error occurred'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});
