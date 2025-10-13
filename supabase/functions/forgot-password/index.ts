import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.55.0";
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface ForgotPasswordRequest {
  email: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email }: ForgotPasswordRequest = await req.json();

    if (!email) {
      return new Response(
        JSON.stringify({ error: "Email is required" }),
        { 
          status: 400, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Check if user exists
    const { data: users, error: listError } = await supabaseAdmin.auth.admin.listUsers();
    
    if (listError) {
      console.error("Error listing users:", listError);
      throw new Error("Failed to verify user");
    }

    const user = users.users.find((u) => u.email === email);

    if (!user) {
      // For security, return success even if user doesn't exist (prevents email enumeration)
      return new Response(
        JSON.stringify({ 
          success: true,
          message: "If an account exists with this email, you will receive a password reset link shortly."
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Get user's full name from profiles
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('full_name')
      .eq('user_id', user.id)
      .single();

    const userName = profile?.full_name || 'User';

    // Generate password reset link
    const { data: resetData, error: resetError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'recovery',
      email: email,
      options: {
        redirectTo: `${req.headers.get('origin') || 'https://hr.amanacorporate.com'}/reset-password`,
      },
    });

    if (resetError) {
      console.error("Error generating reset link:", resetError);
      throw new Error("Failed to generate reset link");
    }

    // Send email via Resend
    const emailResponse = await resend.emails.send({
      from: "HRFlow <noreply@hr.amanacorporate.com>",
      to: [email],
      subject: "Password Reset Request - HRFlow",
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
              .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
              .button { display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
              .footer { margin-top: 20px; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 14px; }
              .warning { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 12px; margin: 20px 0; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>🔒 Password Reset Request</h1>
              </div>
              <div class="content">
                <p>Hi ${userName},</p>
                <p>We received a request to reset your password for your HRFlow account.</p>
                <p>Click the button below to reset your password:</p>
                <div style="text-align: center;">
                  <a href="${resetData.properties.action_link}" class="button">Reset Password</a>
                </div>
                <p>Or copy and paste this link into your browser:</p>
                <p style="word-break: break-all; color: #667eea;">${resetData.properties.action_link}</p>
                <div class="warning">
                  <strong>⚠️ Security Notice:</strong><br>
                  This link will expire in 1 hour. If you didn't request this password reset, please ignore this email or contact your HR administrator.
                </div>
                <div class="footer">
                  <p>This is an automated message from HRFlow HR Management System.</p>
                  <p>© ${new Date().getFullYear()} HRFlow. All rights reserved.</p>
                </div>
              </div>
            </div>
          </body>
        </html>
      `,
    });

    console.log("Password reset email sent:", emailResponse);

    // Log email in database
    await supabaseAdmin.from('email_logs').insert({
      to_email: email,
      subject: "Password Reset Request - HRFlow",
      content: `Password reset link sent to ${email}`,
      status: 'sent',
      sent_at: new Date().toISOString(),
    });

    return new Response(
      JSON.stringify({ 
        success: true,
        message: "If an account exists with this email, you will receive a password reset link shortly."
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Error in forgot-password function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
};

serve(handler);
