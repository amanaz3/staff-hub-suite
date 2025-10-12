import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { ExceptionRequestForm } from "@/components/ExceptionRequestForm";
import { supabase } from "@/integrations/supabase/client";
import { Calendar, Plus, Clock, CheckCircle, XCircle, AlertCircle, FileText } from "lucide-react";

interface LeaveManagementProps {
  userRole: 'admin' | 'staff';
}

export const LeaveManagement = ({ userRole }: LeaveManagementProps) => {
  const [showNewRequest, setShowNewRequest] = useState(false);
  const [newRequest, setNewRequest] = useState({
    type: "",
    startDate: "",
    endDate: "",
    reason: ""
  });
  const [employeeId, setEmployeeId] = useState<string>("");
  const [attendanceExceptions, setAttendanceExceptions] = useState([]);
  const { toast } = useToast();
  const { user } = useAuth();

  // Fetch employee ID and attendance exceptions when user changes
  useEffect(() => {
    const fetchEmployeeData = async () => {
      if (user?.id) {
        const { data, error } = await supabase
          .from('employees')
          .select('id')
          .eq('user_id', user.id)
          .single();
        
        if (data && !error) {
          setEmployeeId(data.id);
          
          // Fetch attendance exceptions for this employee
          const { data: exceptions, error: exceptionsError } = await supabase
            .from('attendance_exceptions')
            .select('*')
            .eq('employee_id', data.id)
            .order('created_at', { ascending: false });
          
          if (exceptions && !exceptionsError) {
            setAttendanceExceptions(exceptions);
          }
        }
      }
    };
    
    fetchEmployeeData();
  }, [user]);

  // Real leave requests data
  const [leaveRequests, setLeaveRequests] = useState<any[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<any[]>([]);
  const [leaveBalances, setLeaveBalances] = useState<any>({
    annual: { used: 0, total: 0, remaining: 0 },
    sick: { used: 0, total: 0, remaining: 0 },
    personal: { used: 0, total: 0, remaining: 0 }
  });
  const [loadingRequests, setLoadingRequests] = useState(true);

  // Fetch leave types and requests
  useEffect(() => {
    const fetchLeaveData = async () => {
      try {
        // Fetch leave types
        const { data: types } = await supabase
          .from('leave_types')
          .select('*')
          .eq('is_active', true);
        setLeaveTypes(types || []);

        if (userRole === 'admin') {
          // Fetch all leave requests for admin
          const { data: requests } = await supabase
            .from('leave_requests')
            .select(`
              *,
              employee:employees(full_name, department),
              leave_type:leave_types(name)
            `)
            .order('created_at', { ascending: false });
          
          setLeaveRequests(requests || []);
        } else if (employeeId) {
          // Fetch staff's own requests and balances
          const [requestsResult, balancesResult] = await Promise.all([
            supabase
              .from('leave_requests')
              .select(`
                *,
                employee:employees(full_name, department),
                leave_type:leave_types(name)
              `)
              .eq('employee_id', employeeId)
              .order('created_at', { ascending: false }),
            
            supabase
              .from('employee_leave_balances')
              .select('*')
              .eq('employee_id', employeeId)
              .eq('year', new Date().getFullYear())
          ]);

          setLeaveRequests(requestsResult.data || []);
          
          // Process balances
          const balances = balancesResult.data || [];
          
          if (balances.length > 0) {
            // Get leave type names
            const leaveTypeIds = [...new Set(balances.map(b => b.leave_type_id))];
            const { data: leaveTypesData } = await supabase
              .from('leave_types')
              .select('id, name')
              .in('id', leaveTypeIds);
            
            const processedBalances = {
              annual: { used: 0, total: 0, remaining: 0 },
              sick: { used: 0, total: 0, remaining: 0 },
              personal: { used: 0, total: 0, remaining: 0 }
            };

            balances.forEach(balance => {
              const leaveType = leaveTypesData?.find(lt => lt.id === balance.leave_type_id);
              const typeName = leaveType?.name?.toLowerCase();
              if (typeName && processedBalances[typeName as keyof typeof processedBalances]) {
                processedBalances[typeName as keyof typeof processedBalances] = {
                  used: balance.used_days,
                  total: balance.allocated_days,
                  remaining: balance.allocated_days - balance.used_days
                };
              }
            });

            setLeaveBalances(processedBalances);
          }
        }
      } catch (error) {
        console.error('Error fetching leave data:', error);
      } finally {
        setLoadingRequests(false);
      }
    };

    fetchLeaveData();
  }, [userRole, employeeId]);


  const handleSubmitRequest = async () => {
    if (!newRequest.type || !newRequest.startDate || !newRequest.endDate || !newRequest.reason) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields",
        variant: "destructive"
      });
      return;
    }

    if (!employeeId) {
      toast({
        title: "Error",
        description: "Employee ID not found. Please refresh the page.",
        variant: "destructive"
      });
      return;
    }

    try {
      // Find leave type ID
      const leaveType = leaveTypes.find(lt => lt.name.toLowerCase().includes(newRequest.type));
      if (!leaveType) {
        toast({
          title: "Error",
          description: "Invalid leave type selected",
          variant: "destructive"
        });
        return;
      }

      // Calculate total days
      const startDate = new Date(newRequest.startDate);
      const endDate = new Date(newRequest.endDate);
      const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;

      const { error } = await supabase
        .from('leave_requests')
        .insert({
          employee_id: employeeId,
          leave_type_id: leaveType.id,
          start_date: newRequest.startDate,
          end_date: newRequest.endDate,
          total_days: totalDays,
          reason: newRequest.reason,
          status: 'pending'
        });

      if (error) throw error;

      // Send email notification to admins
      try {
        // Get admin emails
        const { data: adminProfiles } = await supabase
          .from('profiles')
          .select('email, full_name')
          .eq('role', 'admin');

        // Get employee details
        const { data: employeeData } = await supabase
          .from('employees')
          .select('full_name')
          .eq('id', employeeId)
          .single();

        // Send email to each admin
        if (adminProfiles && adminProfiles.length > 0 && employeeData) {
          for (const admin of adminProfiles) {
            await supabase.functions.invoke('notify-email', {
              body: {
                type: 'leave_request',
                action: 'submitted',
                recipientEmail: admin.email,
                recipientName: admin.full_name,
                submitterName: employeeData.full_name,
                details: {
                  leaveType: leaveType.name,
                  startDate: newRequest.startDate,
                  endDate: newRequest.endDate,
                  reason: newRequest.reason
                }
              }
            });
          }
        }
      } catch (emailError) {
        console.log('Email notification failed:', emailError);
        // Don't fail the whole operation if email fails
      }

      toast({
        title: "Leave Request Submitted",
        description: "Your request has been sent for approval",
      });

      // Refresh leave requests
      if (userRole === 'staff' && employeeId) {
        const { data: requests } = await supabase
          .from('leave_requests')
          .select(`
            *,
            employee:employees(full_name, department),
            leave_type:leave_types(name)
          `)
          .eq('employee_id', employeeId)
          .order('created_at', { ascending: false });
        setLeaveRequests(requests || []);
      }

      setNewRequest({ type: "", startDate: "", endDate: "", reason: "" });
      setShowNewRequest(false);
    } catch (error) {
      console.error('Error submitting leave request:', error);
      toast({
        title: "Error",
        description: "Failed to submit leave request. Please try again.",
        variant: "destructive"
      });
    }
  };

  const handleApproval = async (id: string, action: 'approve' | 'reject') => {
    try {
      const { error } = await supabase
        .from('leave_requests')
        .update({
          status: action === 'approve' ? 'approved' : 'rejected',
          reviewed_at: new Date().toISOString(),
          reviewed_by: user?.id
        })
        .eq('id', id);

      if (error) throw error;

      // Send email notification to employee
      try {
        // Get the leave request details
        const leaveRequest = leaveRequests.find(req => req.id === id);
        if (leaveRequest && leaveRequest.employee) {
          await supabase.functions.invoke('notify-email', {
            body: {
              type: 'leave_request',
              action: action === 'approve' ? 'approved' : 'rejected',
              recipientEmail: leaveRequest.employee.email || '',
              recipientName: leaveRequest.employee.full_name,
              submitterName: leaveRequest.employee.full_name,
              details: {
                leaveType: leaveRequest.leave_type?.name || 'Leave',
                startDate: leaveRequest.start_date,
                endDate: leaveRequest.end_date,
                reason: leaveRequest.reason
              }
            }
          });
        }
      } catch (emailError) {
        console.log('Email notification failed:', emailError);
        // Don't fail the whole operation if email fails
      }

      toast({
        title: `Request ${action === 'approve' ? 'Approved' : 'Rejected'}`,
        description: `Leave request has been ${action === 'approve' ? 'approved' : 'rejected'}`,
      });

      // Refresh requests
      const { data: requests } = await supabase
        .from('leave_requests')
        .select(`
          *,
          employee:employees(full_name, department),
          leave_type:leave_types(name)
        `)
        .order('created_at', { ascending: false });
      setLeaveRequests(requests || []);
    } catch (error) {
      console.error('Error updating leave request:', error);
      toast({
        title: "Error",
        description: "Failed to update leave request. Please try again.",
        variant: "destructive"
      });
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved':
        return <CheckCircle className="h-4 w-4 text-status-approved" />;
      case 'rejected':
        return <XCircle className="h-4 w-4 text-status-rejected" />;
      case 'pending':
        return <AlertCircle className="h-4 w-4 text-status-pending" />;
      default:
        return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      approved: "bg-status-approved text-white",
      pending: "bg-status-pending text-white",
      rejected: "bg-status-rejected text-white"
    };
    
    return variants[status as keyof typeof variants] || "bg-muted";
  };

  const formatExceptionType = (type: string) => {
    const typeLabels = {
      'short_permission_personal': 'Short Permission (Personal)',
      'short_permission_official': 'Short Permission (Official)',
      'wfh': 'Work from Home (WFH)',
      'missed_clock_in': 'Missed Clock In',
      'missed_clock_out': 'Missed Clock Out',
      'wrong_time': 'Wrong Clock In/Out Time',
      'late_arrival': 'Late Arrival (Legacy)',
      'early_departure': 'Early Departure (Legacy)'
    };
    return typeLabels[type as keyof typeof typeLabels] || type.split('_').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  };

  const formatTime = (timeString: string) => {
    if (!timeString) return '-';
    return new Date(timeString).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Leave Management</h2>
          <p className="text-muted-foreground">
            {userRole === 'admin' ? 'Manage team leave requests' : 'View and request time off'}
          </p>
        </div>
        
        {userRole === 'staff' && (
          <Button onClick={() => setShowNewRequest(true)} className="bg-primary hover:bg-primary/90">
            <Plus className="h-4 w-4 mr-2" />
            New Request
          </Button>
        )}
      </div>

      {/* Leave Balances (Staff only) */}
      {userRole === 'staff' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="border border-status-approved/20">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Annual Leave</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="text-2xl font-bold text-foreground">{leaveBalances.annual.remaining}</div>
                <div className="text-xs text-muted-foreground">
                  {leaveBalances.annual.used} used • {leaveBalances.annual.total} total
                </div>
                <div className="w-full bg-muted rounded-full h-2">
                  <div 
                    className="bg-status-approved h-2 rounded-full transition-all duration-300"
                    style={{ width: `${(leaveBalances.annual.used / leaveBalances.annual.total) * 100}%` }}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border border-status-pending/20">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Sick Leave</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="text-2xl font-bold text-foreground">{leaveBalances.sick.remaining}</div>
                <div className="text-xs text-muted-foreground">
                  {leaveBalances.sick.used} used • {leaveBalances.sick.total} total
                </div>
                <div className="w-full bg-muted rounded-full h-2">
                  <div 
                    className="bg-status-pending h-2 rounded-full transition-all duration-300"
                    style={{ width: `${(leaveBalances.sick.used / leaveBalances.sick.total) * 100}%` }}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border border-primary/20">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Personal Leave</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="text-2xl font-bold text-foreground">{leaveBalances.personal.remaining}</div>
                <div className="text-xs text-muted-foreground">
                  {leaveBalances.personal.used} used • {leaveBalances.personal.total} total
                </div>
                <div className="w-full bg-muted rounded-full h-2">
                  <div 
                    className="bg-primary h-2 rounded-full transition-all duration-300"
                    style={{ width: `${(leaveBalances.personal.used / leaveBalances.personal.total) * 100}%` }}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* My Attendance Exceptions (Staff only) */}
      {userRole === 'staff' && attendanceExceptions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <FileText className="h-5 w-5 mr-2 text-primary" />
              My Attendance Exceptions
            </CardTitle>
            <CardDescription>
              Your submitted attendance exception requests
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {attendanceExceptions.map((exception: any) => (
                <div key={exception.id} className="border rounded-lg p-4 hover:shadow-sm transition-shadow">
                  <div className="flex items-start justify-between">
                    <div className="space-y-2">
                      <div className="flex items-center space-x-3">
                        {getStatusIcon(exception.status)}
                        <div>
                          <h4 className="font-medium text-foreground">
                            {formatExceptionType(exception.exception_type)}
                          </h4>
                          <p className="text-sm text-muted-foreground">
                            {exception.target_date ? formatDate(exception.target_date) : 'No date specified'}
                          </p>
                        </div>
                      </div>
                      
                      {(exception.proposed_clock_in_time || exception.proposed_clock_out_time) && (
                        <div className="text-sm text-muted-foreground">
                          {exception.proposed_clock_in_time && (
                            <span>Clock In: {formatTime(exception.proposed_clock_in_time)}</span>
                          )}
                          {exception.proposed_clock_in_time && exception.proposed_clock_out_time && (
                            <span className="mx-2">•</span>
                          )}
                          {exception.proposed_clock_out_time && (
                            <span>Clock Out: {formatTime(exception.proposed_clock_out_time)}</span>
                          )}
                        </div>
                      )}
                      
                      <p className="text-sm text-muted-foreground">{exception.reason}</p>
                      
                      {exception.status === 'rejected' && exception.admin_comments && (
                        <p className="text-sm text-status-rejected font-medium">
                          Admin comments: {exception.admin_comments}
                        </p>
                      )}
                      
                      {exception.document_url && (
                        <button
                          onClick={async () => {
                            try {
                              const { data } = await supabase.storage
                                .from('hr-documents')
                                .createSignedUrl(exception.document_url, 60);
                              
                              if (data?.signedUrl) {
                                window.open(data.signedUrl, '_blank');
                              } else {
                                toast({
                                  title: "Error",
                                  description: "Could not access document",
                                  variant: "destructive"
                                });
                              }
                            } catch (error) {
                              console.error('Error accessing document:', error);
                              toast({
                                title: "Error",
                                description: "Failed to open document",
                                variant: "destructive"
                              });
                            }
                          }}
                          className="text-sm text-primary hover:underline"
                        >
                          View attached document
                        </button>
                      )}
                    </div>

                    <div className="text-right space-y-2">
                      <Badge className={getStatusBadge(exception.status)}>
                        {exception.status}
                      </Badge>
                      <div className="text-xs text-muted-foreground">
                        <div>Submitted {formatDate(exception.created_at)}</div>
                        {exception.reviewed_at && (
                          <div>Reviewed {formatDate(exception.reviewed_at)}</div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* New Request Form */}
      {showNewRequest && userRole === 'staff' && (
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader>
            <CardTitle className="flex items-center">
              <Calendar className="h-5 w-5 mr-2 text-primary" />
              New Request
            </CardTitle>
            <CardDescription>
              Submit a new leave request or attendance exception
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Tabs defaultValue="leave" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="leave">Leave</TabsTrigger>
                <TabsTrigger value="exception">Attendance Exception</TabsTrigger>
              </TabsList>
              
              <TabsContent value="leave" className="space-y-4 mt-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="type">Leave Type</Label>
                    <Select value={newRequest.type} onValueChange={(value) => setNewRequest({...newRequest, type: value})}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select leave type" />
                      </SelectTrigger>
                      <SelectContent>
                        {leaveTypes.map(type => (
                          <SelectItem key={type.id} value={type.name.toLowerCase()}>
                            {type.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="days">Duration</Label>
                    <div className="grid grid-cols-2 gap-2">
                      <Input
                        type="date"
                        placeholder="Start date"
                        value={newRequest.startDate}
                        onChange={(e) => setNewRequest({...newRequest, startDate: e.target.value})}
                      />
                      <Input
                        type="date"
                        placeholder="End date"
                        value={newRequest.endDate}
                        onChange={(e) => setNewRequest({...newRequest, endDate: e.target.value})}
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="reason">Reason</Label>
                  <Textarea
                    id="reason"
                    placeholder="Please provide a reason for your leave request..."
                    value={newRequest.reason}
                    onChange={(e) => setNewRequest({...newRequest, reason: e.target.value})}
                    rows={3}
                  />
                </div>

                <div className="flex justify-end space-x-3">
                  <Button variant="outline" onClick={() => setShowNewRequest(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleSubmitRequest} className="bg-primary hover:bg-primary/90">
                    Submit Request
                  </Button>
                </div>
              </TabsContent>

              <TabsContent value="exception" className="mt-4">
                <ExceptionRequestForm 
                  employeeId={employeeId}
                  onSuccess={() => {
                    toast({
                      title: "Exception Request Submitted",
                      description: "Your attendance exception has been sent for approval",
                    });
                    setShowNewRequest(false);
                    
                    // Refresh attendance exceptions
                    if (employeeId) {
                      supabase
                        .from('attendance_exceptions')
                        .select('*')
                        .eq('employee_id', employeeId)
                        .order('created_at', { ascending: false })
                        .then(({ data }) => {
                          if (data) setAttendanceExceptions(data);
                        });
                    }
                  }}
                />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}

      {/* Leave Requests */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Calendar className="h-5 w-5 mr-2 text-primary" />
            {userRole === 'admin' ? 'All Leave Requests' : 'My Leave Requests'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loadingRequests ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              <span className="ml-2 text-muted-foreground">Loading requests...</span>
            </div>
          ) : leaveRequests.length === 0 ? (
            <div className="text-center py-8">
              <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No leave requests found</p>
            </div>
          ) : (
            <div className="space-y-4">
              {leaveRequests.map((request) => (
                <div key={request.id} className="border rounded-lg p-4 hover:shadow-sm transition-shadow">
                  <div className="flex items-start justify-between">
                    <div className="space-y-2">
                      <div className="flex items-center space-x-3">
                        {getStatusIcon(request.status)}
                        <div>
                          <h4 className="font-medium text-foreground">
                            {userRole === 'admin' ? request.employee?.full_name : request.leave_type?.name}
                          </h4>
                          <p className="text-sm text-muted-foreground">
                            {userRole === 'admin' ? `${request.employee?.department} • ${request.leave_type?.name}` : `${request.total_days} days`}
                          </p>
                        </div>
                      </div>
                      
                      <div className="text-sm text-muted-foreground">
                        {formatDate(request.start_date)} to {formatDate(request.end_date)}
                        {userRole === 'admin' && (
                          <span className="ml-2">• {request.total_days} days</span>
                        )}
                      </div>
                      
                      <p className="text-sm text-muted-foreground">{request.reason}</p>
                      
                      {request.status === 'rejected' && request.review_comments && (
                        <p className="text-sm text-status-rejected font-medium">
                          Rejection reason: {request.review_comments}
                        </p>
                      )}
                    </div>

                    <div className="text-right space-y-2">
                      <Badge className={getStatusBadge(request.status)}>
                        {request.status}
                      </Badge>
                      <div className="text-xs text-muted-foreground">
                        Submitted {formatDate(request.created_at)}
                      </div>
                      
                      {userRole === 'admin' && request.status === 'pending' && (
                        <div className="flex space-x-2 mt-2">
                          <Button 
                            size="sm" 
                            variant="outline"
                            className="text-status-approved border-status-approved hover:bg-status-approved hover:text-white"
                            onClick={() => handleApproval(request.id, 'approve')}
                          >
                            Approve
                          </Button>
                          <Button 
                            size="sm" 
                            variant="outline"
                            className="text-status-rejected border-status-rejected hover:bg-status-rejected hover:text-white"
                            onClick={() => handleApproval(request.id, 'reject')}
                          >
                            Reject
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};