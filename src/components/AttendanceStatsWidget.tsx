import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Users, 
  UserCheck, 
  UserX, 
  Clock, 
  AlertTriangle,
  TrendingUp,
  TrendingDown
} from 'lucide-react';
import { startOfMonth, endOfMonth, format, isWeekend } from 'date-fns';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';

interface EmployeeAttendanceData {
  employee_id: string;
  employee_name: string;
  total_presents: number;
  total_absents: number;
  total_lates: number;
  has_breach: boolean;
  consecutive_absences: number;
}

interface AttendanceStats {
  totalEmployees: number;
  totalPresents: number;
  totalAbsents: number;
  totalLates: number;
  totalBreaches: number;
  attendanceRate: number;
  employeesWithBreaches: EmployeeAttendanceData[];
  dailyStats: { date: string; presents: number; absents: number; lates: number }[];
}

const COLORS = {
  present: 'hsl(142, 76%, 36%)',
  absent: 'hsl(0, 84%, 60%)',
  late: 'hsl(38, 92%, 50%)',
  breach: 'hsl(0, 84%, 40%)'
};

interface AttendanceStatsWidgetProps {
  onBreachClick?: (employeeId: string) => void;
}

export const AttendanceStatsWidget = ({ onBreachClick }: AttendanceStatsWidgetProps) => {
  const [stats, setStats] = useState<AttendanceStats | null>(null);
  const [loading, setLoading] = useState(true);
  const currentMonth = new Date();
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);

  useEffect(() => {
    fetchAttendanceStats();
  }, []);

  const fetchAttendanceStats = async () => {
    try {
      setLoading(true);

      // Fetch all active employees
      const { data: employees, error: employeesError } = await supabase
        .from('employees')
        .select('id, full_name')
        .eq('status', 'active')
        .is('deleted_at', null);

      if (employeesError) throw employeesError;
      if (!employees || employees.length === 0) {
        setStats({
          totalEmployees: 0,
          totalPresents: 0,
          totalAbsents: 0,
          totalLates: 0,
          totalBreaches: 0,
          attendanceRate: 0,
          employeesWithBreaches: [],
          dailyStats: []
        });
        return;
      }

      // Fetch attendance for all employees for current month
      const { data: attendance, error: attendanceError } = await supabase
        .from('attendance')
        .select('employee_id, date, status, clock_in_time, clock_out_time')
        .gte('date', format(monthStart, 'yyyy-MM-dd'))
        .lte('date', format(monthEnd, 'yyyy-MM-dd'))
        .order('date', { ascending: true });

      if (attendanceError) throw attendanceError;

      // Fetch work schedules for late detection
      const { data: schedules, error: schedulesError } = await supabase
        .from('work_schedules')
        .select('employee_id, start_time')
        .eq('is_active', true);

      if (schedulesError) throw schedulesError;

      const scheduleMap = new Map(
        schedules?.map(s => [s.employee_id, s.start_time]) || []
      );

      // Process attendance data
      const employeeDataMap = new Map<string, EmployeeAttendanceData>();
      const dailyStatsMap = new Map<string, { presents: number; absents: number; lates: number }>();
      
      let totalPresents = 0;
      let totalAbsents = 0;
      let totalLates = 0;

      // Initialize employee data
      employees.forEach(emp => {
        employeeDataMap.set(emp.id, {
          employee_id: emp.id,
          employee_name: emp.full_name,
          total_presents: 0,
          total_absents: 0,
          total_lates: 0,
          has_breach: false,
          consecutive_absences: 0
        });
      });

      // Create a map of attendance by employee and date
      const attendanceMap = new Map<string, Map<string, any>>();
      attendance?.forEach(record => {
        if (!attendanceMap.has(record.employee_id)) {
          attendanceMap.set(record.employee_id, new Map());
        }
        attendanceMap.get(record.employee_id)?.set(record.date, record);
      });

      // Calculate working days in month (excluding weekends)
      const workingDays: Date[] = [];
      let currentDate = new Date(monthStart);
      while (currentDate <= monthEnd && currentDate <= new Date()) {
        if (!isWeekend(currentDate)) {
          workingDays.push(new Date(currentDate));
        }
        currentDate.setDate(currentDate.getDate() + 1);
      }

      // Process each employee's attendance
      employees.forEach(emp => {
        const empData = employeeDataMap.get(emp.id)!;
        const empAttendance = attendanceMap.get(emp.id) || new Map();
        const scheduleStartTime = scheduleMap.get(emp.id) || '09:00:00';
        
        let consecutiveAbsences = 0;
        let maxConsecutiveAbsences = 0;

        workingDays.forEach(day => {
          const dateStr = format(day, 'yyyy-MM-dd');
          const record = empAttendance.get(dateStr);

          // Initialize daily stats
          if (!dailyStatsMap.has(dateStr)) {
            dailyStatsMap.set(dateStr, { presents: 0, absents: 0, lates: 0 });
          }
          const dailyStats = dailyStatsMap.get(dateStr)!;

          if (record && record.clock_in_time) {
            // Check if late
            const clockInTime = new Date(record.clock_in_time);
            const [hours, minutes] = scheduleStartTime.split(':').map(Number);
            const scheduledTime = new Date(clockInTime);
            scheduledTime.setHours(hours, minutes + 15, 0); // 15 min grace period

            const isLate = clockInTime > scheduledTime;

            if (isLate) {
              empData.total_lates++;
              totalLates++;
              dailyStats.lates++;
            } else {
              empData.total_presents++;
              totalPresents++;
              dailyStats.presents++;
            }

            consecutiveAbsences = 0;
          } else {
            // Absent
            empData.total_absents++;
            totalAbsents++;
            dailyStats.absents++;
            consecutiveAbsences++;
            maxConsecutiveAbsences = Math.max(maxConsecutiveAbsences, consecutiveAbsences);
          }
        });

        // Check for breaches
        empData.consecutive_absences = maxConsecutiveAbsences;
        if (maxConsecutiveAbsences >= 3 || empData.total_absents > 5) {
          empData.has_breach = true;
        }
      });

      // Get employees with breaches
      const employeesWithBreaches = Array.from(employeeDataMap.values())
        .filter(emp => emp.has_breach)
        .sort((a, b) => b.total_absents - a.total_absents);

      // Convert daily stats to array
      const dailyStats = Array.from(dailyStatsMap.entries())
        .map(([date, stats]) => ({
          date: format(new Date(date), 'MMM dd'),
          ...stats
        }))
        .slice(-14); // Last 14 days

      const totalAttendanceRecords = totalPresents + totalLates + totalAbsents;
      const attendanceRate = totalAttendanceRecords > 0 
        ? ((totalPresents + totalLates) / totalAttendanceRecords) * 100 
        : 0;

      setStats({
        totalEmployees: employees.length,
        totalPresents,
        totalAbsents,
        totalLates,
        totalBreaches: employeesWithBreaches.length,
        attendanceRate,
        employeesWithBreaches,
        dailyStats
      });
    } catch (error) {
      console.error('Error fetching attendance stats:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card className="p-6 mb-6">
        <Skeleton className="h-8 w-64 mb-6" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
        <Skeleton className="h-64" />
      </Card>
    );
  }

  if (!stats) return null;

  const pieData = [
    { name: 'Present', value: stats.totalPresents, color: COLORS.present },
    { name: 'Late', value: stats.totalLates, color: COLORS.late },
    { name: 'Absent', value: stats.totalAbsents, color: COLORS.absent }
  ];

  const trendDirection = stats.attendanceRate >= 90 ? 'up' : 'down';

  return (
    <Card className="p-6 mb-6 bg-gradient-to-br from-background to-muted/20">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-foreground">
            Attendance Overview - {format(currentMonth, 'MMMM yyyy')}
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Real-time attendance statistics across all employees
          </p>
        </div>
        <Badge 
          variant={stats.totalBreaches > 0 ? 'destructive' : 'default'}
          className="text-lg px-4 py-2"
        >
          {stats.totalBreaches > 0 ? (
            <>
              <AlertTriangle className="h-5 w-5 mr-2" />
              {stats.totalBreaches} Breach{stats.totalBreaches !== 1 ? 'es' : ''}
            </>
          ) : (
            <>
              <UserCheck className="h-5 w-5 mr-2" />
              No Breaches
            </>
          )}
        </Badge>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card className="p-4 bg-card border-2">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Total Employees</p>
              <p className="text-3xl font-bold text-foreground mt-1">{stats.totalEmployees}</p>
            </div>
            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
              <Users className="h-6 w-6 text-primary" />
            </div>
          </div>
        </Card>

        <Card className="p-4 bg-card border-2 border-green-500/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Total Presents</p>
              <p className="text-3xl font-bold text-green-600 mt-1">{stats.totalPresents}</p>
              <p className="text-xs text-muted-foreground mt-1">On-time arrivals</p>
            </div>
            <div className="h-12 w-12 rounded-full bg-green-500/10 flex items-center justify-center">
              <UserCheck className="h-6 w-6 text-green-600" />
            </div>
          </div>
        </Card>

        <Card className="p-4 bg-card border-2 border-orange-500/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Total Lates</p>
              <p className="text-3xl font-bold text-orange-600 mt-1">{stats.totalLates}</p>
              <p className="text-xs text-muted-foreground mt-1">Late arrivals</p>
            </div>
            <div className="h-12 w-12 rounded-full bg-orange-500/10 flex items-center justify-center">
              <Clock className="h-6 w-6 text-orange-600" />
            </div>
          </div>
        </Card>

        <Card className="p-4 bg-card border-2 border-red-500/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Total Absents</p>
              <p className="text-3xl font-bold text-red-600 mt-1">{stats.totalAbsents}</p>
              <p className="text-xs text-muted-foreground mt-1">No clock-in</p>
            </div>
            <div className="h-12 w-12 rounded-full bg-red-500/10 flex items-center justify-center">
              <UserX className="h-6 w-6 text-red-600" />
            </div>
          </div>
        </Card>
      </div>

      {/* Attendance Rate */}
      <div className="mb-6 p-4 bg-muted/30 rounded-lg border">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">Attendance Rate</p>
            <p className="text-4xl font-bold text-foreground mt-1">
              {stats.attendanceRate.toFixed(1)}%
            </p>
          </div>
          <div className="flex items-center gap-2">
            {trendDirection === 'up' ? (
              <TrendingUp className="h-8 w-8 text-green-600" />
            ) : (
              <TrendingDown className="h-8 w-8 text-red-600" />
            )}
            <Badge variant={trendDirection === 'up' ? 'default' : 'destructive'}>
              {stats.attendanceRate >= 95 ? 'Excellent' : stats.attendanceRate >= 90 ? 'Good' : 'Needs Attention'}
            </Badge>
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Daily Trend Chart */}
        <Card className="p-4">
          <h3 className="text-lg font-semibold text-foreground mb-4">Daily Attendance Trend (Last 14 Days)</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={stats.dailyStats}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={12} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'hsl(var(--card))', 
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px'
                }}
              />
              <Bar dataKey="presents" fill={COLORS.present} name="Present" radius={[4, 4, 0, 0]} />
              <Bar dataKey="lates" fill={COLORS.late} name="Late" radius={[4, 4, 0, 0]} />
              <Bar dataKey="absents" fill={COLORS.absent} name="Absent" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        {/* Pie Chart */}
        <Card className="p-4">
          <h3 className="text-lg font-semibold text-foreground mb-4">Attendance Distribution</h3>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, value, percent }) => `${name}: ${value} (${(percent * 100).toFixed(0)}%)`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {pieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'hsl(var(--card))', 
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px'
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Breach Alert */}
      {stats.employeesWithBreaches.length > 0 && (
        <Card className="p-4 bg-red-50 dark:bg-red-950/20 border-red-300 dark:border-red-800">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-red-900 dark:text-red-100 mb-2">
                Employees with Attendance Breaches ({stats.employeesWithBreaches.length})
              </h3>
              <div className="space-y-2">
                {stats.employeesWithBreaches.slice(0, 5).map(emp => (
                  <div 
                    key={emp.employee_id} 
                    className="flex items-center justify-between p-2 bg-background/50 rounded cursor-pointer hover:bg-background/80 transition-colors border border-transparent hover:border-red-300 dark:hover:border-red-800"
                    onClick={() => onBreachClick?.(emp.employee_id)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onBreachClick?.(emp.employee_id);
                      }
                    }}
                  >
                    <div>
                      <p className="font-medium text-foreground hover:text-red-600 transition-colors">
                        {emp.employee_name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {emp.consecutive_absences >= 3 && `${emp.consecutive_absences} consecutive absences`}
                        {emp.consecutive_absences >= 3 && emp.total_absents > 5 && ' • '}
                        {emp.total_absents > 5 && `${emp.total_absents} total absences`}
                      </p>
                    </div>
                    <Badge variant="destructive" className="pointer-events-none">
                      {emp.total_absents} absences
                    </Badge>
                  </div>
                ))}
                {stats.employeesWithBreaches.length > 5 && (
                  <p className="text-sm text-muted-foreground text-center mt-2">
                    And {stats.employeesWithBreaches.length - 5} more...
                  </p>
                )}
              </div>
            </div>
          </div>
        </Card>
      )}
    </Card>
  );
};
