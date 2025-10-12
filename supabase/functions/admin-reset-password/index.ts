import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.55.0";
import { Resend } from "npm:resend@4.0.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ResetPasswordRequest {
  user_email: string;
  user_name: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);
    
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user: requestingUser }, error: authError } = 
      await supabaseAdmin.auth.getUser(token);

    if (authError || !requestingUser) {
      return new Response(
        JSON.stringify({ error: 'Invalid authentication' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if requesting user has admin role using has_role function
    const { data: hasAdminRole, error: roleError } = await supabaseAdmin
      .rpc('has_role', { 
        _user_id: requestingUser.id, 
        _role: 'admin' 
      });

    if (roleError || !hasAdminRole) {
      console.error('Non-admin attempted password reset:', requestingUser.email);
      return new Response(
        JSON.stringify({ error: 'Unauthorized: Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { user_email, user_name }: ResetPasswordRequest = await req.json();

    if (!user_email) {
      return new Response(
        JSON.stringify({ error: 'User email is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Admin ${requestingUser.email} initiating password reset for ${user_email}`);

    const { data: targetUser, error: getUserError } = await supabaseAdmin.auth.admin.listUsers();
    
    if (getUserError) {
      throw getUserError;
    }

    const user = targetUser.users.find(u => u.email === user_email);
    
    if (!user) {
      return new Response(
        JSON.stringify({ error: 'User not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: resetData, error: resetError } = await supabaseAdmin.auth.admin
      .generateLink({
        type: 'recovery',
        email: user_email,
        options: {
          redirectTo: `${new URL(req.url).origin}/auth`,
        }
      });

    if (resetError) {
      console.error('Error generating reset link:', resetError);
      throw resetError;
    }

    const resend = new Resend(Deno.env.get('RESEND_API_KEY'));
    
    const emailHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #2563eb; color: white; padding: 20px; text-align: center; }
            .content { background: #f9fafb; padding: 30px; border-radius: 8px; margin: 20px 0; }
            .button { display: inline-block; background: #2563eb; color: white; padding: 12px 30px; 
                     text-decoration: none; border-radius: 6px; margin: 20px 0; }
            .footer { text-align: center; color: #6b7280; font-size: 12px; margin-top: 20px; }
            .warning { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 12px; margin: 20px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Password Reset Request</h1>
            </div>
            <div class="content">
              <p>Hello ${user_name || 'User'},</p>
              <p>Your system administrator has initiated a password reset for your account.</p>
              <p>Click the button below to set a new password:</p>
              <a href="${resetData.properties.action_link}" class="button">Reset Password</a>
              <p>Or copy and paste this link into your browser:</p>
              <p style="word-break: break-all; background: white; padding: 10px; border-radius: 4px;">
                ${resetData.properties.action_link}
              </p>
              <div class="warning">
                <strong>⚠️ Security Notice:</strong> This link will expire in 1 hour. 
                If you didn't request this reset, please contact your administrator immediately.
              </div>
            </div>
            <div class="footer">
              <p>HRFlow - Human Resources Management System</p>
              <p>This is an automated message, please do not reply to this email.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    const { error: emailError } = await resend.emails.send({
      from: 'HRFlow <noreply@amanacorporate.com>',
      to: [user_email],
      subject: 'Password Reset - Action Required',
      html: emailHtml,
    });

    if (emailError) {
      console.error('Error sending email:', emailError);
      throw emailError;
    }

    await supabaseAdmin.from('email_logs').insert({
      to_email: user_email,
      subject: 'Password Reset - Action Required',
      content: `Admin-initiated password reset for ${user_name}`,
      status: 'sent',
    });

    console.log(`Password reset email sent successfully to ${user_email}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Password reset link sent successfully',
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error: any) {
    console.error('Error in admin-reset-password function:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Failed to send password reset link' 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
};

serve(handler);
