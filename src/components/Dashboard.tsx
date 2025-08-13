import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ClockInOut } from "@/components/ClockInOut";
import { 
  Users, 
  UserCheck, 
  Calendar, 
  Clock, 
  LogOut,
  Calendar as CalendarIcon,
  AlertCircle
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

interface DashboardProps {
  userRole: 'admin' | 'staff';
  currentUser: {
    name: string;
    email: string;
    avatar?: string;
  };
  userProfile: {
    user_id: string;
    email: string;
    full_name: string;
  };
  onLogout: () => void;
}

interface TodayAttendance {
  employee_name: string;
  department: string;
  clock_in_time: string | null;
  clock_out_time: string | null;
  status: string;
}

export const Dashboard = ({ userRole, currentUser, userProfile, onLogout }: DashboardProps) => {
  const [todayAttendance, setTodayAttendance] = useState<TodayAttendance[]>([]);
  const [loading, setLoading] = useState(true);
  // Get today's date in YYYY-MM-DD format
  const today = new Date().toISOString().split('T')[0];

  // Fetch today's attendance data
  useEffect(() => {
    const fetchTodayAttendance = async () => {
      try {
        const { data, error } = await supabase
          .from('attendance')
          .select(`
            clock_in_time,
            clock_out_time,
            status,
            employees!inner(
              full_name,
              department
            )
          `)
          .eq('date', today)
          .order('clock_in_time', { ascending: true });

        if (error) {
          console.error('Error fetching today\'s attendance:', error);
          return;
        }

        const formattedData: TodayAttendance[] = data.map(record => ({
          employee_name: record.employees.full_name,
          department: record.employees.department,
          clock_in_time: record.clock_in_time,
          clock_out_time: record.clock_out_time,
          status: record.status
        }));

        setTodayAttendance(formattedData);
      } catch (error) {
        console.error('Error in fetchTodayAttendance:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchTodayAttendance();
  }, [today]);

  // Mock data for other dashboard stats - in real app this would come from your backend
  const dashboardData = {
    totalStaff: 24,
    loggedInToday: todayAttendance.length,
    onLeaveToday: 3,
    pendingRequests: 5,
    lateCheckIns: todayAttendance.filter(record => {
      if (!record.clock_in_time) return false;
      const clockInTime = new Date(record.clock_in_time);
      const clockInHour = clockInTime.getHours();
      const clockInMinute = clockInTime.getMinutes();
      // Consider late if clocked in after 9:00 AM
      return clockInHour > 9 || (clockInHour === 9 && clockInMinute > 0);
    }).length,
    upcomingLeaves: [
      { name: "Sarah Chen", department: "Engineering", dates: "Dec 23-27", type: "Annual" },
      { name: "Mike Johnson", department: "Sales", dates: "Dec 30-31", type: "Personal" },
      { name: "Emily Davis", department: "Marketing", dates: "Jan 2-5", type: "Sick" }
    ]
  };


  const getAttendanceStatus = (record: TodayAttendance) => {
    if (!record.clock_in_time) return 'absent';
    
    const clockInTime = new Date(record.clock_in_time);
    const clockInHour = clockInTime.getHours();
    const clockInMinute = clockInTime.getMinutes();
    
    // Consider late if clocked in after 9:00 AM
    if (clockInHour > 9 || (clockInHour === 9 && clockInMinute > 0)) {
      return 'late';
    }
    
    return 'present';
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      present: "bg-status-present text-white",
      late: "bg-status-late text-white", 
      absent: "bg-status-absent text-white",
      approved: "bg-status-approved text-white",
      pending: "bg-status-pending text-white",
      rejected: "bg-status-rejected text-white"
    };
    
    return variants[status as keyof typeof variants] || "bg-muted";
  };
  
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card shadow-sm">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="text-2xl font-bold text-primary">HRFlow</div>
              <Badge variant="outline" className="text-sm">
                {userRole === 'admin' ? 'Administrator' : 'Staff Member'}
              </Badge>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="text-right">
                <div className="font-medium text-foreground">{currentUser.name}</div>
                <div className="text-sm text-muted-foreground">{currentUser.email}</div>
              </div>
              <Avatar>
                <AvatarImage src={currentUser.avatar} />
                <AvatarFallback className="bg-primary text-primary-foreground">
                  {currentUser.name.split(' ').map(n => n[0]).join('')}
                </AvatarFallback>
              </Avatar>
              <Button variant="outline" onClick={onLogout} size="sm">
                <LogOut className="h-4 w-4 mr-2" />
                Logout
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-6 py-8">
        {/* Clock In/Out for Staff */}
        {userRole === 'staff' && (
          <div className="mb-8">
            <ClockInOut userProfile={userProfile} />
          </div>
        )}

        {/* Dashboard Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card className="hover:shadow-lg transition-all duration-200">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Staff
              </CardTitle>
              <Users className="h-5 w-5 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-foreground">{dashboardData.totalStaff}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Active employees
              </p>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-all duration-200">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Present Today
              </CardTitle>
              <UserCheck className="h-5 w-5 text-status-present" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-foreground">{dashboardData.loggedInToday}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Out of {dashboardData.totalStaff} total
              </p>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-all duration-200">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                On Leave Today
              </CardTitle>
              <Calendar className="h-5 w-5 text-status-pending" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-foreground">{dashboardData.onLeaveToday}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Approved absences
              </p>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-all duration-200">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {userRole === 'admin' ? 'Pending Requests' : 'My Leave Balance'}
              </CardTitle>
              <Clock className="h-5 w-5 text-status-pending" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-foreground">
                {userRole === 'admin' ? dashboardData.pendingRequests : '12'}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {userRole === 'admin' ? 'Awaiting approval' : 'Days remaining'}
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Today's Attendance */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center text-lg">
                <UserCheck className="h-5 w-5 mr-2 text-primary" />
                Today's Attendance
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="flex items-center justify-between p-3 rounded-lg border bg-muted/20 animate-pulse">
                      <div className="flex items-center space-x-3">
                        <div className="h-8 w-8 rounded-full bg-muted"></div>
                        <div>
                          <div className="h-4 w-24 bg-muted rounded mb-1"></div>
                          <div className="h-3 w-16 bg-muted rounded"></div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-3">
                        <div className="h-4 w-12 bg-muted rounded"></div>
                        <div className="h-6 w-16 bg-muted rounded"></div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : todayAttendance.length > 0 ? (
                <div className="space-y-4">
                  {todayAttendance.map((record, index) => {
                    const status = getAttendanceStatus(record);
                    return (
                      <div key={index} className="flex items-center justify-between p-3 rounded-lg border bg-muted/20">
                        <div className="flex items-center space-x-3">
                          <Avatar className="h-8 w-8">
                            <AvatarFallback className="text-xs bg-primary/10 text-primary">
                              {record.employee_name.split(' ').map(n => n[0]).join('')}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="font-medium text-sm">{record.employee_name}</div>
                            <div className="text-xs text-muted-foreground">{record.department}</div>
                          </div>
                        </div>
                        <div className="flex items-center space-x-3">
                          <div className="text-right">
                            <div className="text-sm font-mono">
                              {record.clock_in_time ? format(new Date(record.clock_in_time), 'HH:mm') : '-'}
                            </div>
                            {record.clock_out_time && (
                              <div className="text-xs text-muted-foreground">
                                Out: {format(new Date(record.clock_out_time), 'HH:mm')}
                              </div>
                            )}
                          </div>
                          <Badge className={getStatusBadge(status)}>
                            {status}
                          </Badge>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <UserCheck className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>No attendance records for today</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Upcoming Leaves */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center text-lg">
                <CalendarIcon className="h-5 w-5 mr-2 text-primary" />
                Upcoming Leaves
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {dashboardData.upcomingLeaves.map((leave, index) => (
                  <div key={index} className="flex items-center justify-between p-3 rounded-lg border bg-muted/20">
                    <div className="flex items-center space-x-3">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="text-xs bg-primary/10 text-primary">
                          {leave.name.split(' ').map(n => n[0]).join('')}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="font-medium text-sm">{leave.name}</div>
                        <div className="text-xs text-muted-foreground">{leave.department}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-medium">{leave.dates}</div>
                      <Badge variant="outline" className="text-xs">
                        {leave.type}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Alerts for Admin */}
        {userRole === 'admin' && dashboardData.lateCheckIns > 0 && (
          <Card className="mt-8 border-status-pending/50 bg-status-pending/5">
            <CardHeader>
              <CardTitle className="flex items-center text-lg text-status-pending">
                <AlertCircle className="h-5 w-5 mr-2" />
                Attention Required
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm">
                {dashboardData.lateCheckIns} staff members had late check-ins today. 
                Consider following up for attendance policy compliance.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};