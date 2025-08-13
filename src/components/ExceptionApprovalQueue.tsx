import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { CheckCircle, XCircle, Clock, FileText, Download } from 'lucide-react';

interface ExceptionRequest {
  id: string;
  attendance_id: string;
  employee_id: string;
  exception_type: 'late_arrival' | 'early_departure';
  reason: string;
  document_url: string | null;
  status: 'pending' | 'approved' | 'rejected';
  admin_comments: string | null;
  created_at: string;
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
      // Get exceptions with employee and attendance details
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

      // Get attendance details  
      const attendanceIds = [...new Set(exceptionsData.map(ex => ex.attendance_id))];
      const { data: attendanceData } = await supabase
        .from('attendance')
        .select('id, date')
        .in('id', attendanceIds);

      // Combine the data
      const exceptionsWithDetails: ExceptionRequest[] = exceptionsData.map(exception => ({
        ...exception,
        exception_type: exception.exception_type as 'late_arrival' | 'early_departure',
        status: exception.status as 'pending' | 'approved' | 'rejected',
        employee_name: employeesData?.find(emp => emp.id === exception.employee_id)?.full_name || 'Unknown Employee',
        attendance_date: attendanceData?.find(att => att.id === exception.attendance_id)?.date || 'Unknown Date'
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
      const comments = adminComments[id] || '';
      
      const { error } = await supabase
        .from('attendance_exceptions')
        .update({
          status,
          admin_comments: comments.trim() || null,
          reviewed_by: (await supabase.auth.getUser()).data.user?.id,
          reviewed_at: new Date().toISOString()
        })
        .eq('id', id);

      if (error) throw error;

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
        description: `Failed to ${status} exception request`,
        variant: "destructive"
      });
    } finally {
      setProcessingId(null);
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
    return type === 'late_arrival' ? 'Late Arrival' : 'Early Departure';
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