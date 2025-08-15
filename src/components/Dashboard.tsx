import { useState, useEffect } from "react";
import { EnhancedCard } from "@/components/ui/enhanced-card";
import { StatusBadge } from "@/components/ui/status-badge";
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
  AlertCircle,
  Menu,
  TrendingUp,
  Activity
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

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
  onNavigate?: (tabId: string) => void;
}

interface TodayAttendance {
  employee_name: string;
  department: string;
  clock_in_time: string | null;
  clock_out_time: string | null;
  status: string;
}

export const Dashboard = ({ userRole, currentUser, userProfile, onLogout, onNavigate }: DashboardProps) => {
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
      <header className="sticky top-0 z-30 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
        <div className="container mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {onNavigate && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {/* Mobile menu handled in Index */}}
                  className="lg:hidden"
                  aria-label="Open menu"
                >
                  <Menu className="h-5 w-5" />
                </Button>
              )}
              <div className="flex items-center gap-3">
                <div className="text-2xl font-bold text-primary">HRFlow</div>
                <Badge variant="outline" className="text-sm hidden sm:inline-flex">
                  {userRole === 'admin' ? 'Administrator' : 'Staff Member'}
                </Badge>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="text-right hidden sm:block">
                <div className="font-medium text-foreground">{currentUser.name}</div>
                <div className="text-sm text-muted-foreground">{currentUser.email}</div>
              </div>
              <Avatar className="h-8 w-8 sm:h-10 sm:w-10">
                <AvatarImage src={currentUser.avatar} />
                <AvatarFallback className="bg-primary text-primary-foreground">
                  {currentUser.name.split(' ').map(n => n[0]).join('')}
                </AvatarFallback>
              </Avatar>
              <Button variant="outline" onClick={onLogout} size="sm" className="hidden sm:flex">
                <LogOut className="h-4 w-4 mr-2" />
                Logout
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* Clock In/Out for Staff */}
        {userRole === 'staff' && (
          <div className="mb-8">
            <ClockInOut userProfile={userProfile} />
          </div>
        )}

        {/* Dashboard Stats (Admin only) */}
        {userRole === 'admin' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-8">
            <EnhancedCard
              variant="elevated"
              className="group hover:border-primary/20 transition-all duration-200"
            >
              <div className="flex items-center justify-between">
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">Total Staff</p>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-bold">{dashboardData.totalStaff}</span>
                    <TrendingUp className="h-4 w-4 text-success" />
                  </div>
                  <p className="text-xs text-muted-foreground">Active employees</p>
                </div>
                <div className="p-3 bg-primary/10 rounded-xl group-hover:bg-primary/20 transition-colors">
                  <Users className="h-6 w-6 text-primary" />
                </div>
              </div>
            </EnhancedCard>

            <EnhancedCard
              variant="elevated"
              className="group hover:border-success/20 transition-all duration-200"
            >
              <div className="flex items-center justify-between">
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">Present Today</p>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-bold">{dashboardData.loggedInToday}</span>
                    <span className="text-sm text-muted-foreground">/{dashboardData.totalStaff}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {Math.round((dashboardData.loggedInToday / dashboardData.totalStaff) * 100)}% attendance
                  </p>
                </div>
                <div className="p-3 bg-success/10 rounded-xl group-hover:bg-success/20 transition-colors">
                  <UserCheck className="h-6 w-6 text-success" />
                </div>
              </div>
            </EnhancedCard>

            <EnhancedCard
              variant="elevated"
              className="group hover:border-warning/20 transition-all duration-200"
            >
              <div className="flex items-center justify-between">
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">On Leave</p>
                  <span className="text-3xl font-bold">{dashboardData.onLeaveToday}</span>
                  <p className="text-xs text-muted-foreground">Approved absences</p>
                </div>
                <div className="p-3 bg-warning/10 rounded-xl group-hover:bg-warning/20 transition-colors">
                  <Calendar className="h-6 w-6 text-warning" />
                </div>
              </div>
            </EnhancedCard>

            <EnhancedCard
              variant="elevated"
              className="group hover:border-destructive/20 transition-all duration-200"
            >
              <div className="flex items-center justify-between">
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">
                    {userRole === 'admin' ? 'Pending Requests' : 'Leave Balance'}
                  </p>
                  <span className="text-3xl font-bold">
                    {userRole === 'admin' ? dashboardData.pendingRequests : '12'}
                  </span>
                  <p className="text-xs text-muted-foreground">
                    {userRole === 'admin' ? 'Awaiting approval' : 'Days remaining'}
                  </p>
                </div>
                <div className="p-3 bg-destructive/10 rounded-xl group-hover:bg-destructive/20 transition-colors">
                  <Clock className="h-6 w-6 text-destructive" />
                </div>
              </div>
            </EnhancedCard>
          </div>
        )}

        <div className={`grid grid-cols-1 ${userRole === 'admin' ? 'lg:grid-cols-2' : ''} gap-6 sm:gap-8`}>
          {/* Today's Attendance */}
          <EnhancedCard
            title="Today's Attendance"
            icon={Activity}
            variant="elevated"
            loading={loading}
          >
              {!loading && todayAttendance.length > 0 ? (
                <div className="space-y-3">
                  {todayAttendance.map((record, index) => {
                    const status = getAttendanceStatus(record);
                    return (
                      <div key={index} className="flex items-center justify-between p-4 rounded-lg border bg-surface hover:bg-surface-subtle transition-colors">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-10 w-10">
                            <AvatarFallback className="text-sm bg-primary/10 text-primary font-medium">
                              {record.employee_name.split(' ').map(n => n[0]).join('')}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-sm text-foreground">{record.employee_name}</p>
                            <p className="text-xs text-muted-foreground">{record.department}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <div className="text-sm font-mono tabular-nums">
                              {record.clock_in_time ? format(new Date(record.clock_in_time), 'HH:mm') : '--:--'}
                            </div>
                            {record.clock_out_time && (
                              <div className="text-xs text-muted-foreground">
                                Out: {format(new Date(record.clock_out_time), 'HH:mm')}
                              </div>
                            )}
                          </div>
                          <StatusBadge variant={status as any}>
                            {status}
                          </StatusBadge>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-12">
                  <UserCheck className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                  <p className="text-muted-foreground">No attendance records for today</p>
                  <p className="text-sm text-muted-foreground/70 mt-1">
                    Attendance data will appear here once staff clock in
                  </p>
                </div>
              )}
          </EnhancedCard>

          {/* Upcoming Leaves (Admin only) */}
          {userRole === 'admin' && (
            <EnhancedCard
              title="Upcoming Leaves"
              subtitle="Approved leave requests coming up"
              icon={CalendarIcon}
              variant="elevated"
            >
                <div className="space-y-3">
                  {dashboardData.upcomingLeaves.map((leave, index) => (
                    <div key={index} className="flex items-center justify-between p-4 rounded-lg border bg-surface hover:bg-surface-subtle transition-colors">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10">
                          <AvatarFallback className="text-sm bg-primary/10 text-primary font-medium">
                            {leave.name.split(' ').map(n => n[0]).join('')}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-sm text-foreground">{leave.name}</p>
                          <p className="text-xs text-muted-foreground">{leave.department}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium">{leave.dates}</p>
                        <StatusBadge variant="pending" className="mt-1">
                          {leave.type}
                        </StatusBadge>
                      </div>
                    </div>
                  ))}
                </div>
            </EnhancedCard>
          )}
        </div>

        {/* Alerts for Admin */}
        {userRole === 'admin' && dashboardData.lateCheckIns > 0 && (
          <EnhancedCard
            title="Attention Required"
            icon={AlertCircle}
            variant="elevated"
            className="mt-8 border-warning/50 bg-warning/5"
          >
            <div className="flex items-start gap-3">
              <div className="p-2 bg-warning/10 rounded-lg">
                <AlertCircle className="h-5 w-5 text-warning" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-foreground font-medium mb-1">
                  {dashboardData.lateCheckIns} staff members had late check-ins today
                </p>
                <p className="text-sm text-muted-foreground">
                  Consider following up for attendance policy compliance.
                </p>
                {onNavigate && (
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => onNavigate('leaves')}
                    className="mt-3"
                  >
                    Review Attendance
                  </Button>
                )}
              </div>
            </div>
          </EnhancedCard>
        )}
      </div>
    </div>
  );
};