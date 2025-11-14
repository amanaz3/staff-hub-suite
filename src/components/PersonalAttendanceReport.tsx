import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Download, Calendar as CalendarIcon, List, ChevronLeft, ChevronRight } from 'lucide-react';
import { format, startOfMonth, endOfMonth, getDay, differenceInMinutes, addMonths, subMonths } from 'date-fns';
import { toast } from 'sonner';
import { toGST, formatInGST, createGSTDate } from '@/lib/timezone';
import { useAuth } from '@/hooks/useAuth';
import { AttendanceCalendar } from './AttendanceCalendar';
import { AttendanceDayModal } from './AttendanceDayModal';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export const PersonalAttendanceReport = () => {
  const { user } = useAuth();
  const currentDate = new Date();
  const [viewMode, setViewMode] = useState<'table' | 'calendar'>('calendar');
  const [selectedMonth, setSelectedMonth] = useState(currentDate);
  const [startDate, setStartDate] = useState(format(startOfMonth(currentDate), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(endOfMonth(currentDate), 'yyyy-MM-dd'));
  const [selectedDayRecord, setSelectedDayRecord] = useState<any>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  // Update date range when selected month changes
  const handleMonthChange = (newMonth: Date) => {
    setSelectedMonth(newMonth);
    setStartDate(format(startOfMonth(newMonth), 'yyyy-MM-dd'));
    setEndDate(format(endOfMonth(newMonth), 'yyyy-MM-dd'));
  };

  const handleDayClick = (record: any, date: Date) => {
    setSelectedDayRecord(record);
    setSelectedDate(date);
    setModalOpen(true);
  };

  // Fetch employee's own data with work schedule
  const { data: employeeData } = useQuery({
    queryKey: ['personal-employee-data'],
    queryFn: async () => {
      if (!user?.id) return null;

      const { data: employee, error: empError } = await supabase
        .from('employees')
        .select('id, employee_id, full_name, department, position')
        .eq('user_id', user.id)
        .single();

      if (empError) throw empError;

      // Fetch work schedule
      const { data: schedule, error: schedError } = await supabase
        .from('work_schedules')
        .select('*')
        .eq('employee_id', employee.id)
        .eq('is_active', true)
        .maybeSingle();

      if (schedError) throw schedError;

      return { employee, schedule };
    },
    enabled: !!user?.id
  });

  // Fetch attendance records with leave information
  const { data: attendanceData, isLoading } = useQuery({
    queryKey: ['personal-attendance', startDate, endDate, employeeData?.employee?.id],
    queryFn: async () => {
      if (!employeeData?.employee?.id) return { attendance: [], leaves: [] };

      // Fetch attendance records
      const { data: attendance, error: attError } = await supabase
        .from('attendance')
        .select('*')
        .eq('employee_id', employeeData.employee.id)
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: false });

      if (attError) throw attError;

      // Fetch leave requests for the date range
      const { data: leaves, error: leaveError } = await supabase
        .from('leave_requests')
        .select('*, leave_types(name)')
        .eq('employee_id', employeeData.employee.id)
        .eq('status', 'approved')
        .lte('start_date', endDate)
        .gte('end_date', startDate);

      if (leaveError) throw leaveError;

      return { attendance: attendance || [], leaves: leaves || [] };
    },
    enabled: !!employeeData?.employee?.id
  });

  // Process attendance data with calculations
  const processedData = useMemo(() => {
    if (!attendanceData?.attendance || !employeeData?.schedule) return [];

    const schedule = employeeData.schedule;
    const workingDays = schedule.working_days || [];

    return attendanceData.attendance.map((record) => {
      const recordDate = new Date(record.date + 'T00:00:00');
      const dayOfWeek = DAYS[getDay(recordDate)];
      const isWorkingDay = workingDays.includes(dayOfWeek);

      // Find if there's a leave for this date
      const leaveForDate = attendanceData?.leaves?.find(leave =>
        record.date >= leave.start_date && record.date <= leave.end_date
      );

      // Parse times in GST
      const clockInTime = record.clock_in_time ? toGST(record.clock_in_time) : null;
      const clockOutTime = record.clock_out_time ? toGST(record.clock_out_time) : null;

      // Calculate expected times in GST
      const [schedStartHour, schedStartMin] = schedule.start_time.split(':').map(Number);
      const [schedEndHour, schedEndMin] = schedule.end_time.split(':').map(Number);
      
      const expectedClockIn = createGSTDate(
        recordDate.getFullYear(),
        recordDate.getMonth(),
        recordDate.getDate(),
        schedStartHour,
        schedStartMin,
        0
      );
      
      const expectedClockOut = createGSTDate(
        recordDate.getFullYear(),
        recordDate.getMonth(),
        recordDate.getDate(),
        schedEndHour,
        schedEndMin,
        0
      );

      // Calculate late/early
      let lateMinutes = 0;
      let earlyMinutes = 0;

      if (clockInTime && isWorkingDay) {
        const diff = differenceInMinutes(clockInTime, expectedClockIn);
        if (diff > 0) lateMinutes = diff;
      }

      if (clockOutTime && isWorkingDay) {
        const diff = differenceInMinutes(expectedClockOut, clockOutTime);
        if (diff > 0) earlyMinutes = diff;
      }

      return {
        ...record,
        dayOfWeek,
        isWorkingDay,
        clockInTime,
        clockOutTime,
        expectedClockIn,
        expectedClockOut,
        lateMinutes,
        earlyMinutes,
        leaveType: leaveForDate?.leave_types?.name || null
      };
    });
  }, [attendanceData, employeeData]);

  // Calculate summary statistics
  const summary = useMemo(() => {
    if (!Array.isArray(processedData)) return { totalWorkingDays: 0, daysPresent: 0, daysLate: 0, daysEarly: 0, totalHours: '0.00' };
    
    const workingDays = processedData.filter(r => r.isWorkingDay);
    const presentDays = workingDays.filter(r => r.status === 'present');
    const lateDays = presentDays.filter(r => r.lateMinutes > 0);
    const earlyDays = presentDays.filter(r => r.earlyMinutes > 0);
    const totalHours = presentDays.reduce((sum, r) => sum + (r.total_hours || 0), 0);

    return {
      totalWorkingDays: workingDays.length,
      daysPresent: presentDays.length,
      daysLate: lateDays.length,
      daysEarly: earlyDays.length,
      totalHours: totalHours.toFixed(2)
    };
  }, [processedData]);

  // Export to CSV
  const handleExport = () => {
    if (!processedData.length || !employeeData) {
      toast.error('No data to export');
      return;
    }

    const headers = [
      'Employee ID',
      'Name',
      'Department',
      'Date',
      'Day',
      'Actual Clock In',
      'Actual Clock Out',
      'Expected Clock In',
      'Expected Clock Out',
      'Total Hours',
      'Late (mins)',
      'Early (mins)',
      'Status',
      'WFH',
      'Leave Type',
      'Notes'
    ];

    const rows = processedData.map(record => [
      employeeData.employee.employee_id,
      employeeData.employee.full_name,
      employeeData.employee.department,
      format(new Date(record.date), 'dd/MM/yyyy'),
      record.dayOfWeek,
      record.clockInTime ? formatInGST(record.clockInTime, 'HH:mm:ss') : '-',
      record.clockOutTime ? formatInGST(record.clockOutTime, 'HH:mm:ss') : '-',
      record.isWorkingDay ? format(record.expectedClockIn, 'HH:mm:ss') : '-',
      record.isWorkingDay ? format(record.expectedClockOut, 'HH:mm:ss') : '-',
      record.total_hours?.toFixed(2) || '-',
      record.lateMinutes || '0',
      record.earlyMinutes || '0',
      record.status,
      record.is_wfh ? 'Yes' : 'No',
      record.leaveType || '-',
      record.notes || '-'
    ]);

    const csv = [headers, ...rows]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `my_attendance_${startDate}_to_${endDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    toast.success('Attendance report exported');
  };

  const formatMinutes = (minutes: number) => {
    if (minutes === 0) return '-';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) return `${hours} Hrs ${mins} Mins`;
    return `${mins} Mins`;
  };

  const formatTotalHours = (decimalHours: number) => {
    if (!decimalHours) return '-';
    const hours = Math.floor(decimalHours);
    const mins = Math.round((decimalHours - hours) * 60);
    if (hours > 0 && mins > 0) return `${hours} Hrs ${mins} Mins`;
    if (hours > 0) return `${hours} Hrs`;
    return `${mins} Mins`;
  };

  const getRowColor = (record: any) => {
    if (!record.isWorkingDay) return 'bg-muted/50';
    if (record.leaveType) return 'bg-blue-50 dark:bg-blue-950/20';
    if (record.status === 'absent') return 'bg-red-50 dark:bg-red-950/20';
    if (record.lateMinutes > 0 || record.earlyMinutes > 0) return 'bg-yellow-50 dark:bg-yellow-950/20';
    if (record.status === 'present') return 'bg-green-50 dark:bg-green-950/20';
    return '';
  };

  if (!employeeData?.employee) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-muted-foreground">Loading employee data...</p>
        </CardContent>
      </Card>
    );
  }

  if (!employeeData?.schedule) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-destructive">No work schedule assigned. Please contact your administrator.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Working Days</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{summary.totalWorkingDays}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Days Present</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-600 dark:text-green-400">{summary.daysPresent}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Days Late</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">{summary.daysLate}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Early Departures</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">{summary.daysEarly}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Hours</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatTotalHours(parseFloat(summary.totalHours))}</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Report Card */}
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <CardTitle>My Attendance Report</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                {employeeData.employee.employee_id} - {employeeData.employee.full_name}
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <Button onClick={handleExport} variant="outline" size="sm">
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as 'table' | 'calendar')}>
            <div className="flex items-center justify-between mb-4">
              <TabsList>
                <TabsTrigger value="calendar" className="flex items-center gap-2">
                  <CalendarIcon className="h-4 w-4" />
                  Calendar
                </TabsTrigger>
                <TabsTrigger value="table" className="flex items-center gap-2">
                  <List className="h-4 w-4" />
                  Table
                </TabsTrigger>
              </TabsList>

              {viewMode === 'calendar' && (
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleMonthChange(subMonths(selectedMonth, 1))}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-sm font-medium min-w-[150px] text-center">
                    {format(selectedMonth, 'MMMM yyyy')}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleMonthChange(addMonths(selectedMonth, 1))}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              )}

              {viewMode === 'table' && (
                <div className="flex gap-2">
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-[150px]"
                  />
                  <Input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-[150px]"
                  />
                </div>
              )}
            </div>

            <TabsContent value="calendar" className="mt-0">
              {isLoading ? (
                <div className="text-center py-8 text-muted-foreground">Loading attendance data...</div>
              ) : (
                <AttendanceCalendar
                  month={selectedMonth}
                  attendanceData={processedData}
                  onDayClick={handleDayClick}
                />
              )}
            </TabsContent>

            <TabsContent value="table" className="mt-0">
              {isLoading ? (
                <div className="text-center py-8 text-muted-foreground">Loading attendance data...</div>
              ) : processedData.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">No attendance records found for this period</div>
              ) : (
                <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Day</TableHead>
                    <TableHead>Clock In</TableHead>
                    <TableHead>Clock Out</TableHead>
                    <TableHead>Expected In</TableHead>
                    <TableHead>Expected Out</TableHead>
                    <TableHead className="text-right">Hours</TableHead>
                    <TableHead className="text-right">Late</TableHead>
                    <TableHead className="text-right">Early Out</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {processedData.map((record) => (
                    <TableRow key={record.id} className={getRowColor(record)}>
                      <TableCell className="font-medium">
                        {format(new Date(record.date), 'dd/MM/yyyy')}
                      </TableCell>
                      <TableCell>{record.dayOfWeek}</TableCell>
                      <TableCell>
                        {record.clockInTime ? formatInGST(record.clockInTime, 'HH:mm:ss') : '-'}
                      </TableCell>
                      <TableCell>
                        {record.clockOutTime ? formatInGST(record.clockOutTime, 'HH:mm:ss') : 
                          record.clockInTime ? <span className="text-muted-foreground">Working</span> : '-'}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {record.isWorkingDay ? format(record.expectedClockIn, 'HH:mm:ss') : '-'}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {record.isWorkingDay ? format(record.expectedClockOut, 'HH:mm:ss') : '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        {record.total_hours ? formatTotalHours(record.total_hours) : '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        <span className={record.lateMinutes > 0 ? 'text-yellow-600 dark:text-yellow-400 font-medium' : ''}>
                          {formatMinutes(record.lateMinutes)}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className={record.earlyMinutes > 0 ? 'text-orange-600 dark:text-orange-400 font-medium' : ''}>
                          {formatMinutes(record.earlyMinutes)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {record.leaveType ? (
                            <Badge variant="secondary" className="bg-blue-100 dark:bg-blue-900">
                              {record.leaveType}
                            </Badge>
                          ) : record.is_wfh ? (
                            <Badge variant="secondary">WFH</Badge>
                          ) : null}
                          <Badge variant={
                            record.status === 'present' ? 'default' :
                            record.status === 'absent' ? 'destructive' :
                            'secondary'
                          }>
                            {record.status}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {record.notes || '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Day Details Modal */}
      <AttendanceDayModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        record={selectedDayRecord}
        date={selectedDate || new Date()}
      />
    </div>
  );
};
