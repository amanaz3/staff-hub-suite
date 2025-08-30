import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Mail, Send, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export const TestEmailManagement = () => {
  const [subject, setSubject] = useState('Test Email from HRFlow');
  const [message, setMessage] = useState('This is a test email to verify the email system is working correctly. If you received this, the email notifications are functioning properly!');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const sendTestEmails = async () => {
    setLoading(true);
    try {
      // Get all active employees
      const { data: employees, error: fetchError } = await supabase
        .from('employees')
        .select('email, full_name')
        .eq('status', 'active');

      if (fetchError) {
        throw fetchError;
      }

      if (!employees || employees.length === 0) {
        toast({
          title: "No recipients found",
          description: "No active employees found to send test emails to.",
          variant: "destructive",
        });
        return;
      }

      // Send emails to all employees
      const emailPromises = employees.map(async (employee) => {
        const { error } = await supabase.functions.invoke('notify-email', {
          body: {
            type: 'test_email',
            action: 'sent',
            recipientEmail: employee.email,
            recipientName: employee.full_name,
            submitterName: 'HRFlow System',
            details: {
              subject,
              message,
            }
          }
        });
        
        if (error) {
          console.error(`Failed to send email to ${employee.email}:`, error);
          return { success: false, email: employee.email, error };
        }
        return { success: true, email: employee.email };
      });

      const results = await Promise.all(emailPromises);
      const successful = results.filter(r => r.success).length;
      const failed = results.filter(r => !r.success).length;

      if (failed === 0) {
        toast({
          title: "Test emails sent successfully",
          description: `Successfully sent test emails to ${successful} recipients.`,
        });
      } else {
        toast({
          title: "Test emails partially sent",
          description: `Sent to ${successful} recipients, ${failed} failed. Check logs for details.`,
          variant: "destructive",
        });
      }

    } catch (error) {
      console.error('Error sending test emails:', error);
      toast({
        title: "Failed to send test emails",
        description: "An error occurred while sending test emails. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Mail className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Test Email Management</h1>
          <p className="text-muted-foreground">Send test emails to all active employees</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Send Test Email</CardTitle>
          <CardDescription>
            This will send a test email to all active employees in the system to verify email functionality.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4">
            <div className="space-y-2">
              <Label htmlFor="subject">Subject</Label>
              <Input
                id="subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Enter email subject"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="message">Message</Label>
              <Textarea
                id="message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Enter email message"
                rows={6}
              />
            </div>
          </div>

          <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
              <div className="space-y-1">
                <h4 className="text-sm font-medium text-blue-900 dark:text-blue-100">
                  Test Email Information
                </h4>
                <p className="text-sm text-blue-700 dark:text-blue-200">
                  This will send emails to all active employees. Make sure your SMTP settings are configured correctly in Supabase.
                </p>
              </div>
            </div>
          </div>

          <Button 
            onClick={sendTestEmails}
            disabled={loading || !subject.trim() || !message.trim()}
            className="w-full"
            size="lg"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
                Sending Test Emails...
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Send Test Emails to All Users
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};