import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { ExceptionRequestForm } from './ExceptionRequestForm';
import { Clock, CheckCircle, XCircle, Calendar, FileText, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';

interface AttendanceException {
  id: string;
  exception_type: string;
  target_date: string;
  reason: string;
  status: string;
  proposed_clock_in_time: string | null;
  proposed_clock_out_time: string | null;
  duration_hours: number | null;
  admin_comments: string | null;
  document_url: string | null;
  created_at: string;
  reviewed_at: string | null;
}

export const StaffAttendanceExceptions = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [exceptions, setExceptions] = useState<AttendanceException[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [employeeId, setEmployeeId] = useState<string | null>(null);

  useEffect(() => {
    fetchEmployeeId();
  }, [user]);

  useEffect(() => {
    if (employeeId) {
      fetchExceptions();
    }
  }, [employeeId]);

  const fetchEmployeeId = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('employees')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (error) throw error;
      setEmployeeId(data.id);
    } catch (error) {
      console.error('Error fetching employee ID:', error);
    }
  };

  const fetchExceptions = async () => {
    if (!employeeId) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('attendance_exceptions')
        .select('*')
        .eq('employee_id', employeeId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setExceptions(data || []);
    } catch (error) {
      console.error('Error fetching exceptions:', error);
      toast({
        title: "Error",
        description: "Failed to load attendance exceptions",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'rejected':
        return <XCircle className="h-4 w-4 text-red-600" />;
      default:
        return <Clock className="h-4 w-4 text-yellow-600" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      pending: "secondary",
      approved: "default",
      rejected: "destructive"
    };

    return (
      <Badge variant={variants[status] || "outline"}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  const formatExceptionType = (type: string) => {
    const typeMap: Record<string, string> = {
      'short_permission_personal': 'Short Permission (Personal)',
      'short_permission_official': 'Short Permission (Official)',
      'wfh': 'Work From Home',
      'missed_clock_in': 'Forgot to Clock In',
      'missed_clock_out': 'Forgot to Clock Out',
      'wrong_time': 'Clock Time Correction'
    };
    return typeMap[type] || type;
  };

  const handleSuccess = () => {
    setShowForm(false);
    fetchExceptions();
    toast({
      title: "Success",
      description: "Exception request submitted successfully",
    });
  };

  if (!employeeId) {
    return (
      <div className="flex items-center justify-center p-8">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Attendance Exceptions</h2>
          <p className="text-muted-foreground mt-1">
            Submit corrections for WFH, missed clock-ins, short permissions, and other attendance adjustments
          </p>
        </div>
        <Button onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Cancel' : 'New Exception'}
        </Button>
      </div>

      {/* Exception Request Form */}
      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>Submit Attendance Exception</CardTitle>
            <CardDescription>
              Request approval for attendance corrections or special permissions
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ExceptionRequestForm
              employeeId={employeeId}
              onSuccess={handleSuccess}
            />
          </CardContent>
        </Card>
      )}

      {/* Exceptions List */}
      <div className="space-y-4">
        {loading ? (
          <Card>
            <CardContent className="p-8 text-center">
              <p className="text-muted-foreground">Loading exceptions...</p>
            </CardContent>
          </Card>
        ) : exceptions.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No attendance exceptions found</p>
              <p className="text-sm text-muted-foreground mt-2">
                Submit your first exception using the "New Exception" button above
              </p>
            </CardContent>
          </Card>
        ) : (
          exceptions.map((exception) => (
            <Card key={exception.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center gap-2">
                      {getStatusIcon(exception.status)}
                      <CardTitle className="text-lg">
                        {formatExceptionType(exception.exception_type)}
                      </CardTitle>
                      {getStatusBadge(exception.status)}
                    </div>
                    <CardDescription className="flex items-center gap-4 text-sm">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {format(new Date(exception.target_date), 'MMM dd, yyyy')}
                      </span>
                      <span className="text-muted-foreground">
                        Submitted {format(new Date(exception.created_at), 'MMM dd, yyyy')}
                      </span>
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="text-sm font-medium mb-1">Reason:</p>
                  <p className="text-sm text-muted-foreground">{exception.reason}</p>
                </div>

                {exception.proposed_clock_in_time && (
                  <div>
                    <p className="text-sm font-medium mb-1">Proposed Clock In:</p>
                    <p className="text-sm text-muted-foreground">
                      {format(new Date(exception.proposed_clock_in_time), 'hh:mm a')}
                    </p>
                  </div>
                )}

                {exception.proposed_clock_out_time && (
                  <div>
                    <p className="text-sm font-medium mb-1">Proposed Clock Out:</p>
                    <p className="text-sm text-muted-foreground">
                      {format(new Date(exception.proposed_clock_out_time), 'hh:mm a')}
                    </p>
                  </div>
                )}

                {exception.duration_hours && (
                  <div>
                    <p className="text-sm font-medium mb-1">Duration:</p>
                    <p className="text-sm text-muted-foreground">
                      {exception.duration_hours} {exception.duration_hours === 1 ? 'hour' : 'hours'}
                    </p>
                  </div>
                )}

                {exception.document_url && (
                  <div>
                    <p className="text-sm font-medium mb-1 flex items-center gap-1">
                      <FileText className="h-3 w-3" />
                      Supporting Document:
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => window.open(exception.document_url!, '_blank')}
                    >
                      View Document
                    </Button>
                  </div>
                )}

                {exception.admin_comments && (
                  <div className="border-t pt-3 mt-3">
                    <p className="text-sm font-medium mb-1">Admin Response:</p>
                    <p className="text-sm text-muted-foreground">{exception.admin_comments}</p>
                    {exception.reviewed_at && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Reviewed on {format(new Date(exception.reviewed_at), 'MMM dd, yyyy')}
                      </p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
};
