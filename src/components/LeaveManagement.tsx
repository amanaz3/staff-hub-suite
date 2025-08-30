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

  // Mock data - would come from backend
  const leaveRequests = [
    {
      id: 1,
      employee: "John Smith",
      department: "Engineering",
      type: "Annual Leave",
      startDate: "2024-01-15",
      endDate: "2024-01-19",
      days: 5,
      reason: "Family vacation planned",
      status: "pending",
      submittedDate: "2024-01-02"
    },
    {
      id: 2,
      employee: "Sarah Chen",
      department: "Marketing",
      type: "Sick Leave",
      startDate: "2024-01-08",
      endDate: "2024-01-10",
      days: 3,
      reason: "Medical appointment and recovery",
      status: "approved",
      submittedDate: "2024-01-05"
    },
    {
      id: 3,
      employee: "Mike Johnson",
      department: "Sales",
      type: "Personal Leave",
      startDate: "2024-01-22",
      endDate: "2024-01-22",
      days: 1,
      reason: "Moving to new apartment",
      status: "rejected",
      submittedDate: "2024-01-01",
      rejectionReason: "Insufficient notice period"
    }
  ];

  const leaveBalances = {
    annual: { used: 8, total: 25, remaining: 17 },
    sick: { used: 2, total: 10, remaining: 8 },
    personal: { used: 1, total: 5, remaining: 4 }
  };

  const handleSubmitRequest = () => {
    if (!newRequest.type || !newRequest.startDate || !newRequest.endDate || !newRequest.reason) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields",
        variant: "destructive"
      });
      return;
    }

    toast({
      title: "Leave Request Submitted",
      description: "Your request has been sent for approval",
    });

    setNewRequest({ type: "", startDate: "", endDate: "", reason: "" });
    setShowNewRequest(false);
  };

  const handleApproval = (id: number, action: 'approve' | 'reject') => {
    toast({
      title: `Request ${action === 'approve' ? 'Approved' : 'Rejected'}`,
      description: `Leave request has been ${action === 'approve' ? 'approved' : 'rejected'}`,
    });
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
    return type.split('_').map(word => 
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
                        <a 
                          href={exception.document_url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-sm text-primary hover:underline"
                        >
                          View attached document
                        </a>
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
                        <SelectItem value="annual">Annual Leave</SelectItem>
                        <SelectItem value="sick">Sick Leave</SelectItem>
                        <SelectItem value="personal">Personal Leave</SelectItem>
                        <SelectItem value="emergency">Emergency Leave</SelectItem>
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

      {/* Leave Requests List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Calendar className="h-5 w-5 mr-2 text-primary" />
            {userRole === 'admin' ? 'All Leave Requests' : 'My Leave Requests'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {leaveRequests.map((request) => (
              <div key={request.id} className="border rounded-lg p-4 hover:shadow-sm transition-shadow">
                <div className="flex items-start justify-between">
                  <div className="space-y-2">
                    <div className="flex items-center space-x-3">
                      {getStatusIcon(request.status)}
                      <div>
                        <h4 className="font-medium text-foreground">
                          {userRole === 'admin' ? request.employee : request.type}
                        </h4>
                        <p className="text-sm text-muted-foreground">
                          {userRole === 'admin' ? `${request.department} • ${request.type}` : 
                           `${request.startDate} to ${request.endDate}`}
                        </p>
                      </div>
                    </div>
                    
                    <p className="text-sm text-muted-foreground">{request.reason}</p>
                    
                    {request.status === 'rejected' && request.rejectionReason && (
                      <p className="text-sm text-status-rejected font-medium">
                        Rejection reason: {request.rejectionReason}
                      </p>
                    )}
                  </div>

                  <div className="text-right space-y-2">
                    <Badge className={getStatusBadge(request.status)}>
                      {request.status}
                    </Badge>
                    <div className="text-xs text-muted-foreground">
                      <div>{request.days} day{request.days !== 1 ? 's' : ''}</div>
                      <div>Submitted {request.submittedDate}</div>
                    </div>
                    
                    {userRole === 'admin' && request.status === 'pending' && (
                      <div className="flex space-x-2 mt-2">
                        <Button 
                          size="sm" 
                          onClick={() => handleApproval(request.id, 'approve')}
                          className="bg-status-approved hover:bg-status-approved/90 text-white"
                        >
                          Approve
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => handleApproval(request.id, 'reject')}
                          className="border-status-rejected text-status-rejected hover:bg-status-rejected hover:text-white"
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
        </CardContent>
      </Card>
    </div>
  );
};