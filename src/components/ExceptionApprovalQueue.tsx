
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { CheckCircle, XCircle, Clock, FileText, Download } from 'lucide-react';
import { format } from 'date-fns';

interface ExceptionRequest {
  id: string;
  attendance_id: string | null;
  employee_id: string;
  exception_type: 'late_arrival' | 'early_departure' | 'missed_clock_in' | 'missed_clock_out' | 'wrong_time';
  reason: string;
  document_url: string | null;
  status: 'pending' | 'approved' | 'rejected';
  admin_comments: string | null;
  created_at: string;
  target_date: string | null;
  proposed_clock_in_time: string | null;
  proposed_clock_out_time: string | null;
  employee_name?: string;
  attendance_date?: string;
}

export const ExceptionApprovalQueue = () => {
  const [exceptions, setExceptions] = useState<ExceptionRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [adminComments, setAdminComments] = useState<{ [key: string]: string }>({});
  const { toast } = useToast();

  useEffect(() => {
    fetchExceptions();
  }, []);

  const fetchExceptions = async () => {
    try {
      // Get exceptions with employee details
      const { data: exceptionsData, error } = await supabase
        .from('attendance_exceptions')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (!exceptionsData || exceptionsData.length === 0) {
        setExceptions([]);
        return;
      }

      // Get employee details
      const employeeIds = [...new Set(exceptionsData.map(ex => ex.employee_id))];
      const { data: employeesData } = await supabase
        .from('employees')
        .select('id, full_name')
        .in('id', employeeIds);

      // Get attendance details for exceptions that have attendance_id
      const attendanceIds = exceptionsData
        .filter(ex => ex.attendance_id)
        .map(ex => ex.attendance_id!);
      
      let attendanceData = [];
      if (attendanceIds.length > 0) {
        const { data } = await supabase
          .from('attendance')
          .select('id, date')
          .in('id', attendanceIds);
        attendanceData = data || [];
      }

      // Combine the data
      const exceptionsWithDetails: ExceptionRequest[] = exceptionsData.map(exception => ({
        ...exception,
        exception_type: exception.exception_type as ExceptionRequest['exception_type'],
        status: exception.status as 'pending' | 'approved' | 'rejected',
        employee_name: employeesData?.find(emp => emp.id === exception.employee_id)?.full_name || 'Unknown Employee',
        attendance_date: exception.target_date || 
          attendanceData.find(att => att.id === exception.attendance_id)?.date || 
          'Unknown Date'
      }));

      setExceptions(exceptionsWithDetails);
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to fetch exception requests",
        variant: "destructive"
      });
    }
  };

  const handleApproval = async (id: string, status: 'approved' | 'rejected') => {
    setProcessingId(id);
    try {
      const exception = exceptions.find(ex => ex.id === id);
      if (!exception) throw new Error('Exception not found');

      const comments = adminComments[id] || '';
      
      // Update the exception status
      const { error: updateError } = await supabase
        .from('attendance_exceptions')
        .update({
          status,
          admin_comments: comments.trim() || null,
          reviewed_by: (await supabase.auth.getUser()).data.user?.id,
          reviewed_at: new Date().toISOString()
        })
        .eq('id', id);

      if (updateError) throw updateError;

      // Send email notification to employee
      try {
        // Get employee details
        const { data: employeeData } = await supabase
          .from('employees')
          .select('email, full_name')
          .eq('id', exception.employee_id)
          .single();

        if (employeeData) {
          await supabase.functions.invoke('notify-email', {
            body: {
              type: 'attendance_exception',
              action: status,
              recipientEmail: employeeData.email,
              recipientName: employeeData.full_name,
              submitterName: employeeData.full_name,
              details: {
                exceptionType: exception.exception_type,
                reason: exception.reason,
                adminComments: comments.trim() || undefined
              }
            }
          });
        }
      } catch (emailError) {
        console.log('Email notification failed:', emailError);
        // Don't fail the whole operation if email fails
      }

      // If approved and it's a time correction exception, update/create attendance record
      if (status === 'approved' && ['missed_clock_in', 'missed_clock_out', 'wrong_time'].includes(exception.exception_type)) {
        await handleAttendanceCorrection(exception);
      }

      toast({
        title: "Success",
        description: `Exception request ${status} successfully`
      });

      setAdminComments(prev => {
        const updated = { ...prev };
        delete updated[id];
        return updated;
      });

      fetchExceptions();
    } catch (error: any) {
      toast({
        title: "Error",
        description: `Failed to ${status} exception request: ${error.message}`,
        variant: "destructive"
      });
    } finally {
      setProcessingId(null);
    }
  };

  const handleAttendanceCorrection = async (exception: ExceptionRequest) => {
    try {
      const targetDate = exception.target_date;
      if (!targetDate) return;

      // Check if attendance record exists for the date
      const { data: existingAttendance } = await supabase
        .from('attendance')
        .select('*')
        .eq('employee_id', exception.employee_id)
        .eq('date', targetDate)
        .single();

      if (existingAttendance) {
        // Update existing attendance record
        const updates: any = {};
        
        if (exception.proposed_clock_in_time) {
          updates.clock_in_time = exception.proposed_clock_in_time;
        }
        
        if (exception.proposed_clock_out_time) {
          updates.clock_out_time = exception.proposed_clock_out_time;
        }

        if (Object.keys(updates).length > 0) {
          const { error } = await supabase
            .from('attendance')
            .update(updates)
            .eq('id', existingAttendance.id);

          if (error) throw error;
        }
      } else {
        // Create new attendance record
        const { error } = await supabase
          .from('attendance')
          .insert({
            employee_id: exception.employee_id,
            date: targetDate,
            clock_in_time: exception.proposed_clock_in_time,
            clock_out_time: exception.proposed_clock_out_time,
            status: 'present',
            notes: `Created via exception approval: ${exception.reason}`
          });

        if (error) throw error;
      }
    } catch (error) {
      console.error('Error handling attendance correction:', error);
      throw error;
    }
  };

  const downloadDocument = async (documentUrl: string, fileName: string) => {
    try {
      const { data, error } = await supabase.storage
        .from('hr-documents')
        .download(documentUrl);

      if (error) throw error;

      const url = window.URL.createObjectURL(data);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to download document",
        variant: "destructive"
      });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
      case 'approved':
        return <Badge variant="default"><CheckCircle className="h-3 w-3 mr-1" />Approved</Badge>;
      case 'rejected':
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Rejected</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getExceptionTypeLabel = (type: string) => {
    const labels = {
      'late_arrival': 'Late Arrival',
      'early_departure': 'Early Departure',
      'missed_clock_in': 'Missed Clock In',
      'missed_clock_out': 'Missed Clock Out',
      'wrong_time': 'Wrong Clock Time'
    };
    return labels[type as keyof typeof labels] || type;
  };

  const formatProposedTimes = (exception: ExceptionRequest) => {
    const parts = [];
    if (exception.proposed_clock_in_time) {
      parts.push(`Clock In: ${format(new Date(exception.proposed_clock_in_time), 'HH:mm')}`);
    }
    if (exception.proposed_clock_out_time) {
      parts.push(`Clock Out: ${format(new Date(exception.proposed_clock_out_time), 'HH:mm')}`);
    }
    return parts.join(' | ');
  };

  const pendingExceptions = exceptions.filter(ex => ex.status === 'pending');
  const processedExceptions = exceptions.filter(ex => ex.status !== 'pending');

  return (
    <div className="space-y-6">
      {pendingExceptions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Pending Approval ({pendingExceptions.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {pendingExceptions.map(exception => (
                <div key={exception.id} className="border rounded-lg p-4 space-y-4">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium">{exception.employee_name}</h4>
                        {getStatusBadge(exception.status)}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {getExceptionTypeLabel(exception.exception_type)} - {exception.attendance_date}
                      </p>
                      {['missed_clock_in', 'missed_clock_out', 'wrong_time'].includes(exception.exception_type) && (
                        <p className="text-sm font-medium text-primary">
                          Proposed: {formatProposedTimes(exception)}
                        </p>
                      )}
                      <p className="text-sm">{exception.reason}</p>
                      {exception.document_url && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => downloadDocument(exception.document_url!, `exception-${exception.id}-document`)}
                        >
                          <Download className="h-4 w-4 mr-2" />
                          Download Document
                        </Button>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Textarea
                      placeholder="Add admin comments (optional)"
                      value={adminComments[exception.id] || ''}
                      onChange={(e) => setAdminComments(prev => ({
                        ...prev,
                        [exception.id]: e.target.value
                      }))}
                      rows={2}
                    />
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => handleApproval(exception.id, 'approved')}
                        disabled={processingId === exception.id}
                      >
                        <CheckCircle className="h-4 w-4 mr-2" />
                        Approve
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleApproval(exception.id, 'rejected')}
                        disabled={processingId === exception.id}
                      >
                        <XCircle className="h-4 w-4 mr-2" />
                        Reject
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Recent Decisions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {processedExceptions.length === 0 ? (
              <p className="text-muted-foreground">No processed requests</p>
            ) : (
              processedExceptions.slice(0, 10).map(exception => (
                <div key={exception.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium">{exception.employee_name}</h4>
                      {getStatusBadge(exception.status)}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {getExceptionTypeLabel(exception.exception_type)} - {exception.attendance_date}
                    </p>
                    {['missed_clock_in', 'missed_clock_out', 'wrong_time'].includes(exception.exception_type) && (
                      <p className="text-xs text-muted-foreground">
                        {formatProposedTimes(exception)}
                      </p>
                    )}
                    {exception.admin_comments && (
                      <p className="text-sm mt-1">
                        <strong>Admin notes:</strong> {exception.admin_comments}
                      </p>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(exception.created_at).toLocaleDateString()}
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
