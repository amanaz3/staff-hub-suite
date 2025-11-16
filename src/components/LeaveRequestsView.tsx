import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Calendar, Plus, Clock, CheckCircle, XCircle, AlertCircle, FileText } from "lucide-react";
import { calculateServiceDuration, formatServiceDuration, isProbationCompleted } from "@/lib/utils";

interface LeaveRequestsViewProps {
  userRole: 'admin' | 'staff' | 'manager';
}

export const LeaveRequestsView = ({ userRole }: LeaveRequestsViewProps) => {
  const [showNewRequest, setShowNewRequest] = useState(false);
  const [newRequest, setNewRequest] = useState({
    type: "",
    startDate: "",
    endDate: "",
    reason: "",
    medicalCertificateUrl: "",
    relationship: ""
  });
  const [employeeId, setEmployeeId] = useState<string>("");
  const [employeeData, setEmployeeData] = useState<any>(null);
  const { toast } = useToast();
  const { user } = useAuth();

  const [leaveRequests, setLeaveRequests] = useState<any[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<any[]>([]);
  const [leaveBalances, setLeaveBalances] = useState<any>({
    annual: { used: 0, total: 0, remaining: 0 },
    sick: { used: 0, total: 0, remaining: 0 },
    personal: { used: 0, total: 0, remaining: 0 }
  });
  const [loadingRequests, setLoadingRequests] = useState(true);

  // Fetch employee ID and attendance exceptions
  useEffect(() => {
    const fetchEmployeeData = async () => {
      if (user?.id) {
        const { data, error } = await supabase
          .from('employees')
          .select('id, hire_date, probation_end_date, full_name')
          .eq('user_id', user.id)
          .single();
        
        if (data && !error) {
          setEmployeeId(data.id);
          setEmployeeData(data);
        }
      }
    };
    fetchEmployeeData();
  }, [user]);

  // Fetch leave types and requests
  useEffect(() => {
    const fetchLeaveData = async () => {
      try {
        const { data: types } = await supabase
          .from('leave_types')
          .select('*')
          .eq('is_active', true);
        setLeaveTypes(types || []);

        if (userRole === 'admin') {
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
          const [requestsResult, balancesResult] = await Promise.all([
            supabase.from('leave_requests').select(`
              *,
              employee:employees(full_name, department),
              leave_type:leave_types(name)
            `).eq('employee_id', employeeId).order('created_at', { ascending: false }),
            supabase.from('employee_leave_balances').select(`
              *,
              leave_type:leave_types(name)
            `).eq('employee_id', employeeId).eq('year', new Date().getFullYear())
          ]);

          setLeaveRequests(requestsResult.data || []);

          if (balancesResult.data) {
            const balances: any = { annual: { used: 0, total: 0, remaining: 0 }, sick: { used: 0, total: 0, remaining: 0 }, personal: { used: 0, total: 0, remaining: 0 } };
            balancesResult.data.forEach((balance: any) => {
              const leaveTypeName = balance.leave_type?.name.toLowerCase();
              if (leaveTypeName && balances[leaveTypeName]) {
                balances[leaveTypeName] = {
                  used: balance.used_days,
                  total: balance.allocated_days,
                  remaining: balance.allocated_days - balance.used_days
                };
              }
            });
            setLeaveBalances(balances);
          }
        }
      } catch (error) {
        console.error('Error fetching leave data:', error);
      } finally {
        setLoadingRequests(false);
      }
    };

    if (userRole === 'admin' || employeeId) {
      fetchLeaveData();
    }
  }, [userRole, employeeId]);

  const handleSubmitRequest = async () => {
    try {
      if (!employeeId || !newRequest.type || !newRequest.startDate || !newRequest.endDate || !newRequest.reason) {
        toast({
          title: "Missing Information",
          description: "Please fill in all required fields",
          variant: "destructive"
        });
        return;
      }

      const leaveType = leaveTypes.find(lt => lt.id === newRequest.type);
      if (!leaveType) {
        toast({
          title: "Error",
          description: "Invalid leave type selected",
          variant: "destructive"
        });
        return;
      }

      const startDate = new Date(newRequest.startDate);
      const endDate = new Date(newRequest.endDate);
      const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      
      const insertData: any = {
        employee_id: employeeId,
        leave_type_id: leaveType.id,
        start_date: newRequest.startDate,
        end_date: newRequest.endDate,
        total_days: totalDays,
        reason: newRequest.reason,
        status: 'pending'
      };

      if (newRequest.medicalCertificateUrl) {
        insertData.medical_certificate_url = newRequest.medicalCertificateUrl;
      }
      if (newRequest.relationship) {
        insertData.relationship = newRequest.relationship;
      }

      const { error } = await supabase.from('leave_requests').insert(insertData);
      if (error) throw error;

      // Send email notification to admins
      try {
        const { data: adminProfiles } = await supabase
          .from('profiles')
          .select('email, full_name')
          .eq('role', 'admin');

        const { data: employeeDataResult } = await supabase
          .from('employees')
          .select('full_name')
          .eq('id', employeeId)
          .single();

        if (adminProfiles && adminProfiles.length > 0 && employeeDataResult) {
          for (const admin of adminProfiles) {
            await supabase.functions.invoke('notify-email', {
              body: {
                type: 'leave_request',
                action: 'submitted',
                recipientEmail: admin.email,
                recipientName: admin.full_name,
                submitterName: employeeDataResult.full_name,
                employeeId: employeeId,
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
        console.error('Failed to send admin notification:', emailError);
      }

      toast({
        title: "Leave Request Submitted",
        description: "Your request has been sent for approval"
      });

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

      setNewRequest({
        type: "",
        startDate: "",
        endDate: "",
        reason: "",
        medicalCertificateUrl: "",
        relationship: ""
      });
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

  const handleApproval = async (requestId: string, status: 'approved' | 'rejected', comments?: string) => {
    try {
      const { error } = await supabase
        .from('leave_requests')
        .update({
          status,
          review_comments: comments,
          reviewed_at: new Date().toISOString(),
          reviewed_by: user?.id
        })
        .eq('id', requestId);

      if (error) throw error;

      const request = leaveRequests.find(r => r.id === requestId);
      if (request) {
        try {
          const { data: employeeProfile } = await supabase
            .from('employees')
            .select('email, full_name')
            .eq('id', request.employee_id)
            .single();

          if (employeeProfile) {
            await supabase.functions.invoke('notify-email', {
              body: {
                type: 'leave_request',
                action: status,
                recipientEmail: employeeProfile.email,
                recipientName: employeeProfile.full_name,
                details: {
                  leaveType: request.leave_type?.name,
                  startDate: request.start_date,
                  endDate: request.end_date,
                  comments: comments
                }
              }
            });
          }
        } catch (emailError) {
          console.error('Failed to send notification:', emailError);
        }
      }

      toast({
        title: `Request ${status}`,
        description: `Leave request has been ${status}`
      });

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
        description: "Failed to update leave request",
        variant: "destructive"
      });
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'rejected':
        return <XCircle className="h-5 w-5 text-red-500" />;
      default:
        return <Clock className="h-5 w-5 text-yellow-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: any = {
      pending: "default",
      approved: "default",
      rejected: "destructive"
    };
    const colors: any = {
      pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
      approved: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
      rejected: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
    };
    return <Badge variant={variants[status]} className={colors[status]}>{status.charAt(0).toUpperCase() + status.slice(1)}</Badge>;
  };

  const formatExceptionType = (type: string) => {
    return type.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  };

  const formatTime = (timeString: string) => {
    if (!timeString) return '';
    const date = new Date(timeString);
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Leave Requests</h2>
          <p className="text-muted-foreground">
            {userRole === 'admin' ? 'Manage all leave requests' : 'Submit and track your leave requests'}
          </p>
        </div>
        {userRole === 'staff' && (
          <Button onClick={() => setShowNewRequest(!showNewRequest)}>
            <Plus className="h-4 w-4 mr-2" />
            New Request
          </Button>
        )}
      </div>

      {/* Plan Balances (Staff only) */}
      {userRole === 'staff' && employeeData && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-2xl text-muted-foreground">Plan Balances</CardTitle>
              <div className="flex items-center gap-2">
                <Label className="text-sm font-medium text-muted-foreground">Balance As-of Date</Label>
                <Select defaultValue="current">
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Select date" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="current">Current date</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Annual Leave */}
              <div className="flex items-center justify-between py-3 border-b border-border">
                <p className="text-base font-medium text-muted-foreground">Annual Incremental Plan</p>
                <p className="text-2xl font-normal text-foreground">{leaveBalances.annual.remaining} Days</p>
              </div>

              {/* Sick Leave */}
              <div className="flex items-center justify-between py-3 border-b border-border">
                <p className="text-base font-medium text-muted-foreground">Study Leave Plan</p>
                <p className="text-2xl font-normal text-foreground">{leaveBalances.sick.remaining} Days</p>
              </div>

              {/* Personal Leave */}
              <div className="flex items-center justify-between py-3 border-b border-border">
                <p className="text-base font-medium text-muted-foreground">ADIB Day Off Accrual</p>
                <p className="text-2xl font-normal text-foreground">{leaveBalances.personal.remaining} Calendar Days</p>
              </div>

              {/* Additional Leave Types */}
              <div className="flex items-center justify-between py-3 border-b border-border">
                <p className="text-base font-medium text-muted-foreground">Offsite and in Lieu Leave Balance Plan</p>
                <p className="text-2xl font-normal text-foreground">0 Calendar Days</p>
              </div>

              <div className="flex items-center justify-between py-3">
                <p className="text-base font-medium text-muted-foreground">Work From Home Plan</p>
                <p className="text-2xl font-normal text-foreground">15 Calendar Days</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* New Request Form */}
      {showNewRequest && userRole === 'staff' && (
        <Card>
          <CardHeader>
            <CardTitle>Submit New Request</CardTitle>
            <CardDescription>Submit a new leave request for annual leave, sick leave, and other time-off</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="leave-type">Leave Type *</Label>
                <Select value={newRequest.type} onValueChange={(value) => setNewRequest({ ...newRequest, type: value })}>
                  <SelectTrigger id="leave-type">
                    <SelectValue placeholder="Select leave type" />
                  </SelectTrigger>
                  <SelectContent>
                    {leaveTypes.map((type) => (
                      <SelectItem key={type.id} value={type.id}>
                        {type.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="start-date">Start Date *</Label>
                  <Input
                    id="start-date"
                    type="date"
                    value={newRequest.startDate}
                    onChange={(e) => setNewRequest({ ...newRequest, startDate: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="end-date">End Date *</Label>
                  <Input
                    id="end-date"
                    type="date"
                    value={newRequest.endDate}
                    onChange={(e) => setNewRequest({ ...newRequest, endDate: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="reason">Reason *</Label>
                <Textarea
                  id="reason"
                  value={newRequest.reason}
                  onChange={(e) => setNewRequest({ ...newRequest, reason: e.target.value })}
                  placeholder="Please provide a detailed reason for your leave request"
                  rows={4}
                />
              </div>

              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setShowNewRequest(false)}>Cancel</Button>
                <Button onClick={handleSubmitRequest}>Submit Request</Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Leave Requests List */}
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
              <Calendar className="h-12 w-12 mx-auto text-muted-foreground/50" />
              <h3 className="mt-2 text-sm font-medium text-foreground">No leave requests</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {userRole === 'admin' ? 'No leave requests have been submitted yet.' : 'You haven\'t submitted any leave requests yet.'}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {leaveRequests.map((request) => (
                <div key={request.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between">
                    <div className="space-y-2 flex-1">
                      <div className="flex items-center space-x-3">
                        {getStatusIcon(request.status)}
                        <div>
                          <h4 className="font-medium text-foreground">{request.leave_type?.name || 'N/A'}</h4>
                          {userRole === 'admin' && (
                            <p className="text-sm text-muted-foreground">
                              {request.employee?.full_name} • {request.employee?.department}
                            </p>
                          )}
                        </div>
                      </div>
                      
                      <div className="text-sm text-muted-foreground">
                        {formatDate(request.start_date)} - {formatDate(request.end_date)} ({request.total_days} {request.total_days === 1 ? 'day' : 'days'})
                      </div>
                      
                      <p className="text-sm text-muted-foreground">{request.reason}</p>
                      
                      {request.review_comments && (
                        <p className="text-sm text-muted-foreground italic">
                          Admin comments: {request.review_comments}
                        </p>
                      )}
                    </div>
                    
                    <div className="flex flex-col items-end space-y-2">
                      {getStatusBadge(request.status)}
                      {userRole === 'admin' && request.status === 'pending' && (
                        <div className="flex gap-2 mt-2">
                          <Button size="sm" onClick={() => handleApproval(request.id, 'approved')}>
                            Approve
                          </Button>
                          <Button size="sm" variant="destructive" onClick={() => handleApproval(request.id, 'rejected')}>
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
