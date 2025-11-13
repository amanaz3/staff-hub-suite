
import { useState, useEffect } from "react";
import { EnhancedCard } from "@/components/ui/enhanced-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ClockInOut } from "@/components/ClockInOut";
import { ClockInOutTest } from "@/components/ClockInOutTest";
import { NotificationBell } from "@/components/NotificationBell";

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
  Activity,
  Briefcase,
  CheckCircle2
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { calculateServiceDuration, formatServiceDuration, isProbationCompleted } from "@/lib/utils";
import { todayInGST } from '@/lib/timezone';
import { TimezoneIndicator } from '@/components/TimezoneIndicator';

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
  employee_id: string;
  employee_name: string;
  department: string;
  clock_in_time: string | null;
  clock_out_time: string | null;
  status: string;
  start_time?: string;
  working_days?: string[];
}

interface DashboardStats {
  totalStaff: number;
  loggedInToday: number;
  onLeaveToday: number;
  pendingRequests: number;
  lateCheckIns: number;
}

export const Dashboard = ({ userRole, currentUser, userProfile, onLogout, onNavigate }: DashboardProps) => {
  const [todayAttendance, setTodayAttendance] = useState<TodayAttendance[]>([]);
  const [dashboardStats, setDashboardStats] = useState<DashboardStats>({
    totalStaff: 0,
    loggedInToday: 0,
    onLeaveToday: 0,
    pendingRequests: 0,
    lateCheckIns: 0
  });
  const [loading, setLoading] = useState(true);
  const [employeeId, setEmployeeId] = useState<string | null>(null);
  const [employmentInfo, setEmploymentInfo] = useState<{
    hireDate: string;
    probationEndDate: string | null;
  } | null>(null);
  
  // Get today's date in GST timezone
  const today = todayInGST();

  // Helper function to check if clock-in is late based on work schedule
  const isLateCheckIn = (clockInTime: string, startTime: string | undefined): boolean => {
    if (!clockInTime) return false;
    
    const clockIn = new Date(clockInTime);
    const gracePeriodMinutes = 15;
    
    // Default to 9:00 AM if no schedule
    const defaultStartHour = 9;
    const defaultStartMinute = 0;
    
    let scheduleStartHour = defaultStartHour;
    let scheduleStartMinute = defaultStartMinute;
    
    if (startTime) {
      // Parse time format "HH:MM:SS"
      const [hours, minutes] = startTime.split(':').map(Number);
      scheduleStartHour = hours;
      scheduleStartMinute = minutes;
    }
    
    // Create a date object for scheduled start time on the same day
    const scheduledStart = new Date(clockIn);
    scheduledStart.setHours(scheduleStartHour, scheduleStartMinute + gracePeriodMinutes, 0, 0);
    
    return clockIn > scheduledStart;
  };

  // Fetch dashboard data
  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        // Fetch today's attendance data
        const { data: attendanceData, error: attendanceError } = await supabase
          .from('attendance')
          .select(`
            employee_id,
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

        let formattedData: TodayAttendance[] = [];

        if (attendanceError) {
          console.error('Error fetching today\'s attendance:', attendanceError);
        } else {
          // Fetch work schedules for employees
          const employeeIds = (attendanceData || []).map(record => record.employee_id);
          const { data: scheduleData } = await supabase
            .from('work_schedules')
            .select('employee_id, start_time, working_days')
            .in('employee_id', employeeIds)
            .eq('is_active', true);

          // Create a map of schedules by employee_id
          const scheduleMap = new Map(
            (scheduleData || []).map(s => [s.employee_id, s])
          );

          // Merge schedule data with attendance data
          formattedData = (attendanceData || []).map(record => {
            const schedule = scheduleMap.get(record.employee_id);
            return {
              employee_id: record.employee_id,
              employee_name: record.employees.full_name,
              department: record.employees.department,
              clock_in_time: record.clock_in_time,
              clock_out_time: record.clock_out_time,
              status: record.status,
              start_time: schedule?.start_time,
              working_days: schedule?.working_days
            };
          });

          setTodayAttendance(formattedData);
        }

        // Fetch dashboard stats for admins
        if (userRole === 'admin') {
          // Get total staff count
          const { count: totalStaffCount } = await supabase
            .from('employees')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'active');

          // Get pending leave requests
          const { count: pendingLeaveCount } = await supabase
            .from('leave_requests')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'pending');

          // Get pending exception requests
          const { count: pendingExceptionCount } = await supabase
            .from('attendance_exceptions')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'pending');

          // Get leave requests for today
          const { count: onLeaveCount } = await supabase
            .from('leave_requests')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'approved')
            .lte('start_date', today)
            .gte('end_date', today);

          // Calculate late check-ins using work schedules
          const lateCheckIns = formattedData.filter(record => {
            if (!record.clock_in_time) return false;
            return isLateCheckIn(record.clock_in_time, record.start_time);
          }).length;

          setDashboardStats({
            totalStaff: totalStaffCount || 0,
            loggedInToday: (attendanceData || []).length,
            onLeaveToday: onLeaveCount || 0,
            pendingRequests: (pendingLeaveCount || 0) + (pendingExceptionCount || 0),
            lateCheckIns
          });
        }
      } catch (error) {
        console.error('Error in fetchDashboardData:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, [today, userRole]);

  // Fetch employment info for staff users
  useEffect(() => {
    const fetchEmploymentInfo = async () => {
      if (userRole !== 'staff') return;
      
      try {
        const { data, error } = await supabase
          .from('employees')
          .select('id, hire_date, probation_end_date')
          .eq('user_id', userProfile.user_id)
          .single();

        if (error) {
          console.error('Error fetching employment info:', error);
        } else if (data) {
          setEmployeeId(data.id);
          setEmploymentInfo({
            hireDate: data.hire_date,
            probationEndDate: data.probation_end_date,
          });
        }
      } catch (error) {
        console.error('Error in fetchEmploymentInfo:', error);
      }
    };

    fetchEmploymentInfo();
  }, [userRole, userProfile.user_id]);

  const getAttendanceStatus = (record: TodayAttendance) => {
    if (!record.clock_in_time) return 'absent';
    
    if (isLateCheckIn(record.clock_in_time, record.start_time)) {
      return 'late';
    }
    
    return 'present';
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
                <TimezoneIndicator />
              </div>
            </div>
            
        <div className="flex items-center gap-4">
          <NotificationBell />
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
          <>
            <div className="mb-6 space-y-6">
              <ClockInOut userProfile={userProfile} />
            </div>

            {/* Employment Information Card */}
            {employmentInfo && (
              <div className="mb-8">
                <EnhancedCard variant="elevated" className="bg-gradient-to-br from-primary/5 to-primary/10">
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 pb-2 border-b">
                      <Briefcase className="h-5 w-5 text-primary" />
                      <h3 className="text-lg font-semibold">My Employment Information</h3>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Hire Date */}
                      <div className="space-y-1">
                        <p className="text-sm text-muted-foreground">Hire Date</p>
                        <p className="text-base font-medium">
                          {format(new Date(employmentInfo.hireDate), 'dd MMMM yyyy')}
                        </p>
                      </div>

                      {/* Service Duration */}
                      <div className="space-y-1">
                        <p className="text-sm text-muted-foreground">Service Duration</p>
                        <p className="text-base font-medium">
                          {(() => {
                            const { years, months } = calculateServiceDuration(employmentInfo.hireDate);
                            return formatServiceDuration(years, months);
                          })()}
                        </p>
                      </div>

                      {/* Probation Status */}
                      <div className="space-y-1">
                        <p className="text-sm text-muted-foreground">Probation Status</p>
                        {isProbationCompleted(employmentInfo.hireDate, employmentInfo.probationEndDate) ? (
                          <Badge variant="default" className="bg-success text-success-foreground">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Completed
                          </Badge>
                        ) : (
                          <div className="space-y-1">
                            <Badge variant="secondary" className="bg-warning/10 text-warning">
                              <Clock className="h-3 w-3 mr-1" />
                              In Probation
                            </Badge>
                            {employmentInfo.probationEndDate && (
                              <p className="text-xs text-muted-foreground">
                                Ends: {format(new Date(employmentInfo.probationEndDate), 'dd MMM yyyy')}
                              </p>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Leave Eligibility */}
                      <div className="space-y-1">
                        <p className="text-sm text-muted-foreground">Leave Eligibility</p>
                        {(() => {
                          const { totalMonths } = calculateServiceDuration(employmentInfo.hireDate);
                          const probationComplete = isProbationCompleted(employmentInfo.hireDate, employmentInfo.probationEndDate);
                          
                          if (totalMonths < 6) {
                            return (
                              <Badge variant="secondary" className="bg-muted">
                                <CalendarIcon className="h-3 w-3 mr-1" />
                                {6 - totalMonths} month{6 - totalMonths !== 1 ? 's' : ''} until annual leave
                              </Badge>
                            );
                          } else if (totalMonths < 12) {
                            return (
                              <Badge variant="default" className="bg-primary/10 text-primary">
                                <CalendarIcon className="h-3 w-3 mr-1" />
                                {(totalMonths - 5) * 2} days annual leave
                              </Badge>
                            );
                          } else {
                            return (
                              <Badge variant="default" className="bg-success/10 text-success">
                                <CheckCircle2 className="h-3 w-3 mr-1" />
                                Full entitlement (30 days)
                              </Badge>
                            );
                          }
                        })()}
                      </div>
                    </div>

                    {!isProbationCompleted(employmentInfo.hireDate, employmentInfo.probationEndDate) && (
                      <div className="pt-2 border-t">
                        <p className="text-xs text-muted-foreground flex items-start gap-2">
                          <AlertCircle className="h-3 w-3 mt-0.5 flex-shrink-0" />
                          <span>Sick leave (90 days) will be available after completing your probation period.</span>
                        </p>
                      </div>
                    )}
                  </div>
                </EnhancedCard>
              </div>
            )}
          </>
        )}

        {/* Clock-In/Out Test Suite (Admin only) */}
        {userRole === 'admin' && (
          <div className="mb-8">
            <ClockInOutTest />
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
                    <span className="text-3xl font-bold">{dashboardStats.totalStaff}</span>
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
                    <span className="text-3xl font-bold">{dashboardStats.loggedInToday}</span>
                    <span className="text-sm text-muted-foreground">/{dashboardStats.totalStaff}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {dashboardStats.totalStaff > 0 ? Math.round((dashboardStats.loggedInToday / dashboardStats.totalStaff) * 100) : 0}% attendance
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
                  <span className="text-3xl font-bold">{dashboardStats.onLeaveToday}</span>
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
                  <p className="text-sm font-medium text-muted-foreground">Pending Requests</p>
                  <span className="text-3xl font-bold">{dashboardStats.pendingRequests}</span>
                  <p className="text-xs text-muted-foreground">Awaiting approval</p>
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

          {/* Alerts for Admin */}
          {userRole === 'admin' && dashboardStats.lateCheckIns > 0 && (
            <EnhancedCard
              title="Attention Required"
              icon={AlertCircle}
              variant="elevated"
              className="border-warning/50 bg-warning/5"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 flex-1">
                  <div className="p-2 bg-warning/10 rounded-lg">
                    <AlertCircle className="h-5 w-5 text-warning" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-foreground font-medium mb-1">
                      {dashboardStats.lateCheckIns} staff members had late check-ins today
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Consider following up for attendance policy compliance.
                    </p>
                  </div>
                </div>
                {onNavigate && (
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => onNavigate('attendance')}
                  >
                    Review Attendance
                  </Button>
                )}
              </div>
            </EnhancedCard>
          )}
        </div>
      </div>
    </div>
  );
};
