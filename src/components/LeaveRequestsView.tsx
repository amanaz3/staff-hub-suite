import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Calendar, Plus, Clock, CheckCircle, XCircle, AlertCircle, FileText } from "lucide-react";
import { calculateServiceDuration, formatServiceDuration, isProbationCompleted } from "@/lib/utils";

interface LeaveRequestsViewProps {
  userRole: 'admin' | 'staff' | 'manager';
}

export const LeaveRequestsView = ({ userRole }: LeaveRequestsViewProps) => {
  // Dialog states
  const [showAddLeaveDialog, setShowAddLeaveDialog] = useState(false);
  const [showBalanceDialog, setShowBalanceDialog] = useState(false);
  const [showExistingDialog, setShowExistingDialog] = useState(false);
  
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
    study: { used: 0, total: 0, remaining: 0 }
  });
  const [wfhBalance, setWfhBalance] = useState({ used: 0, allocated: 15, remaining: 15 });
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
  const [loadingRequests, setLoadingRequests] = useState(true);

  // Filter leave types to only show these in forms/lists
  const ALLOWED_LEAVE_TYPES = ['Annual Leave', 'Sick Leave', 'Study Leave'];

  // Fetch employee ID and data
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

  // Fetch WFH balance from attendance table
  const fetchWFHBalance = async (empId: string, year: string) => {
    const { count } = await supabase
      .from('attendance')
      .select('*', { count: 'exact', head: true })
      .eq('employee_id', empId)
      .eq('is_wfh', true)
      .gte('date', `${year}-01-01`)
      .lte('date', `${year}-12-31`);
    
    const used = count || 0;
    setWfhBalance({
      used,
      allocated: 15,
      remaining: 15 - used
    });
  };

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
              leave_type:leave_types!inner(name)
            `)
            .in('leave_type.name', ALLOWED_LEAVE_TYPES)
            .order('created_at', { ascending: false });
          setLeaveRequests(requests || []);
        } else if (employeeId) {
          const [requestsResult, balancesResult] = await Promise.all([
            supabase.from('leave_requests').select(`
              *,
              employee:employees(full_name, department),
              leave_type:leave_types!inner(name)
            `).eq('employee_id', employeeId)
              .in('leave_type.name', ALLOWED_LEAVE_TYPES)
              .order('created_at', { ascending: false }),
            supabase.from('employee_leave_balances').select(`
              *,
              leave_type:leave_types!inner(name)
            `).eq('employee_id', employeeId)
              .eq('year', parseInt(selectedYear))
              .in('leave_type.name', ALLOWED_LEAVE_TYPES)
          ]);

          setLeaveRequests(requestsResult.data || []);

          if (balancesResult.data) {
            const balances: any = { 
              annual: { used: 0, total: 0, remaining: 0 }, 
              sick: { used: 0, total: 0, remaining: 0 }, 
              study: { used: 0, total: 0, remaining: 0 } 
            };
            balancesResult.data.forEach((balance: any) => {
              const leaveTypeName = balance.leave_type?.name.toLowerCase().replace(' leave', '');
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

          // Fetch WFH balance
          await fetchWFHBalance(employeeId, selectedYear);
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
  }, [userRole, employeeId, selectedYear]);

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

      setShowAddLeaveDialog(false);
      setNewRequest({
        type: "",
        startDate: "",
        endDate: "",
        reason: "",
        medicalCertificateUrl: "",
        relationship: ""
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
      </div>

      {/* Three Widget Cards (Staff only) */}
      {userRole === 'staff' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Widget 1: Add Leave Request */}
          <Card 
            className="cursor-pointer hover:shadow-lg transition-all bg-gradient-to-br from-blue-500 to-blue-600 text-white border-0"
            onClick={() => setShowAddLeaveDialog(true)}
          >
            <CardHeader>
              <Plus className="h-8 w-8 mb-2" />
              <CardTitle className="text-white">Add Leave Request</CardTitle>
              <CardDescription className="text-white/80">
                Submit a new leave request
              </CardDescription>
            </CardHeader>
          </Card>

          {/* Widget 2: Leave Balance */}
          <Card 
            className="cursor-pointer hover:shadow-lg transition-all bg-gradient-to-br from-green-500 to-green-600 text-white border-0"
            onClick={() => setShowBalanceDialog(true)}
          >
            <CardHeader>
              <Calendar className="h-8 w-8 mb-2" />
              <CardTitle className="text-white">Leave Balance</CardTitle>
              <CardDescription className="text-white/80">
                View your leave balances
              </CardDescription>
            </CardHeader>
          </Card>

          {/* Widget 3: Existing Leaves */}
          <Card 
            className="cursor-pointer hover:shadow-lg transition-all bg-gradient-to-br from-purple-500 to-purple-600 text-white border-0"
            onClick={() => setShowExistingDialog(true)}
          >
            <CardHeader>
              <FileText className="h-8 w-8 mb-2" />
              <CardTitle className="text-white">Existing Leaves</CardTitle>
              <CardDescription className="text-white/80">
                View submitted requests
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      )}

      {/* Add Leave Request Dialog */}
      <Dialog open={showAddLeaveDialog} onOpenChange={setShowAddLeaveDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Submit New Leave Request</DialogTitle>
            <DialogDescription>
              Submit a request for annual leave, sick leave, or study leave
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="leave-type">Leave Type *</Label>
              <Select value={newRequest.type} onValueChange={(value) => setNewRequest({ ...newRequest, type: value })}>
                <SelectTrigger id="leave-type">
                  <SelectValue placeholder="Select leave type" />
                </SelectTrigger>
                <SelectContent>
                  {leaveTypes.filter(type => ALLOWED_LEAVE_TYPES.includes(type.name)).map((type) => (
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
                placeholder="Enter the reason for your leave request"
                value={newRequest.reason}
                onChange={(e) => setNewRequest({ ...newRequest, reason: e.target.value })}
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="medical-cert">Medical Certificate URL (if applicable)</Label>
              <Input
                id="medical-cert"
                type="url"
                placeholder="https://..."
                value={newRequest.medicalCertificateUrl}
                onChange={(e) => setNewRequest({ ...newRequest, medicalCertificateUrl: e.target.value })}
              />
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setShowAddLeaveDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleSubmitRequest}>
                Submit Request
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Leave Balance Dialog */}
      <Dialog open={showBalanceDialog} onOpenChange={setShowBalanceDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Plan Balances</DialogTitle>
          </DialogHeader>
          
          {/* Year Selector */}
          <div className="flex items-center justify-between mb-4">
            <Label>Balance As-of Date</Label>
            <Select value={selectedYear} onValueChange={setSelectedYear}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="2025">2025</SelectItem>
                <SelectItem value="2024">2024</SelectItem>
                <SelectItem value="2023">2023</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Balance List */}
          <div className="space-y-3">
            <div className="flex justify-between items-center py-3 border-b">
              <span className="font-medium">Annual Leave</span>
              <span className="font-semibold">{leaveBalances.annual.remaining} Days</span>
            </div>
            <div className="flex justify-between items-center py-3 border-b">
              <span className="font-medium">Sick Leave</span>
              <span className="font-semibold">{leaveBalances.sick.remaining} Days</span>
            </div>
            <div className="flex justify-between items-center py-3 border-b">
              <span className="font-medium">Study Leave</span>
              <span className="font-semibold">{leaveBalances.study.remaining} Days</span>
            </div>
            <div className="flex justify-between items-center py-3">
              <span className="font-medium">Work from Home</span>
              <span className="font-semibold">{wfhBalance.used}/{wfhBalance.allocated} Days</span>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Existing Leaves Dialog */}
      <Dialog open={showExistingDialog} onOpenChange={setShowExistingDialog}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Your Leave Requests</DialogTitle>
            <DialogDescription>
              View all your submitted leave requests
            </DialogDescription>
          </DialogHeader>
          
          {loadingRequests ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : leaveRequests.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No leave requests found</div>
          ) : (
            <div className="space-y-3">
              {leaveRequests.map((request) => (
                <Card key={request.id} className="border">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {getStatusIcon(request.status)}
                        <CardTitle className="text-base">{request.leave_type?.name}</CardTitle>
                      </div>
                      {getStatusBadge(request.status)}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <span className="text-muted-foreground">Start Date:</span> {formatDate(request.start_date)}
                      </div>
                      <div>
                        <span className="text-muted-foreground">End Date:</span> {formatDate(request.end_date)}
                      </div>
                      <div>
                        <span className="text-muted-foreground">Days:</span> {request.total_days}
                      </div>
                      <div>
                        <span className="text-muted-foreground">Submitted:</span> {formatDate(request.created_at)}
                      </div>
                    </div>
                    {request.reason && (
                      <div>
                        <span className="text-muted-foreground">Reason:</span> {request.reason}
                      </div>
                    )}
                    {request.review_comments && (
                      <div>
                        <span className="text-muted-foreground">Review Comments:</span> {request.review_comments}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Leave Requests List (For Admin) */}
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
