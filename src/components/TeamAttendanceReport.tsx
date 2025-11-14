import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Download, Calendar } from 'lucide-react';
import { format, parse, isWeekend } from 'date-fns';
import { toast } from 'sonner';

interface AttendanceRecord {
  employee_id: string;
  employee_name: string;
  employee_code: string;
  department: string;
  work_date: string;
  day: string;
  actual_punch_in: string | null;
  actual_punch_out: string | null;
  work_hours: string;
  late_in: string;
  early_out: string;
  flex_time: string;
  comments: string;
  leave_type: string | null;
  status: string;
  expected_start: string | null;
  expected_end: string | null;
}

export const TeamAttendanceReport = () => {
  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [startDate, setStartDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  useEffect(() => {
    fetchAttendanceData();
  }, [startDate, endDate]);

  const fetchAttendanceData = async () => {
    try {
      setLoading(true);

      // Fetch all active employees
      const { data: employees, error: empError } = await supabase
        .from('employees')
        .select('id, full_name, employee_id, department')
        .eq('status', 'active')
        .is('deleted_at', null)
        .order('employee_id');

      if (empError) throw empError;

      // Fetch attendance records for date range
      const { data: attendance, error: attError } = await supabase
        .from('attendance')
        .select('*')
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: true });

      if (attError) throw attError;

      // Fetch work schedules
      const { data: schedules, error: schedError } = await supabase
        .from('work_schedules')
        .select('employee_id, start_time, end_time, working_days')
        .eq('is_active', true);

      if (schedError) throw schedError;

      // Fetch approved leaves for the date range
      const { data: leaves, error: leaveError } = await supabase
        .from('leave_requests')
        .select('employee_id, start_date, end_date, leave_type_id')
        .eq('status', 'approved')
        .lte('start_date', endDate)
        .gte('end_date', startDate);

      if (leaveError) throw leaveError;

      // Fetch leave types
      const { data: leaveTypes, error: leaveTypesError } = await supabase
        .from('leave_types')
        .select('id, name');

      if (leaveTypesError) throw leaveTypesError;

      const leaveTypeMap = new Map(leaveTypes?.map(lt => [lt.id, lt.name]) || []);
      const scheduleMap = new Map(schedules?.map(s => [s.employee_id, s]) || []);
      const attendanceMap = new Map(attendance?.map(a => [`${a.employee_id}_${a.date}`, a]) || []);

      // Build records for each employee and date
      const allRecords: AttendanceRecord[] = [];
      
      const currentDate = new Date(startDate);
      const endDateTime = new Date(endDate);

      while (currentDate <= endDateTime) {
        const dateStr = format(currentDate, 'yyyy-MM-dd');
        const dayName = format(currentDate, 'EEEE').toUpperCase();

        employees?.forEach(emp => {
          const schedule = scheduleMap.get(emp.id);
          const attRecord = attendanceMap.get(`${emp.id}_${dateStr}`);
          const dayLeave = leaves?.find(l => 
            l.employee_id === emp.id && 
            l.start_date <= dateStr && 
            l.end_date >= dateStr
          );

          const isWorkingDay = schedule?.working_days?.includes(format(currentDate, 'EEEE')) || false;
          const isWeekendDay = isWeekend(currentDate);

          let workHours = '0 Hrs 0 Mins';
          let lateIn = '-';
          let earlyOut = '-';

          if (attRecord?.total_hours) {
            const hours = Math.floor(attRecord.total_hours);
            const mins = Math.round((attRecord.total_hours - hours) * 60);
            workHours = hours > 0 ? `${hours} Hrs ${mins} Mins` : `${mins} Mins`;
          }

          // Calculate late in
          if (attRecord?.clock_in_time && schedule?.start_time && isWorkingDay) {
            const clockIn = parse(attRecord.clock_in_time, 'HH:mm:ss', new Date());
            const expectedIn = parse(schedule.start_time, 'HH:mm:ss', new Date());
            const diffMs = clockIn.getTime() - expectedIn.getTime();
            const diffMins = Math.floor(diffMs / 60000);
            
            if (diffMins > 0) {
              const lateHours = Math.floor(diffMins / 60);
              const lateMins = diffMins % 60;
              lateIn = lateHours > 0 ? `${lateHours} Hrs ${lateMins} Mins` : `${lateMins} Mins`;
            }
          }

          // Calculate early out
          if (attRecord?.clock_out_time && schedule?.end_time && isWorkingDay) {
            const clockOut = parse(attRecord.clock_out_time, 'HH:mm:ss', new Date());
            const expectedOut = parse(schedule.end_time, 'HH:mm:ss', new Date());
            const diffMs = expectedOut.getTime() - clockOut.getTime();
            const diffMins = Math.floor(diffMs / 60000);
            
            if (diffMins > 0) {
              const earlyHours = Math.floor(diffMins / 60);
              const earlyMins = diffMins % 60;
              earlyOut = earlyHours > 0 ? `${earlyHours} Hrs ${earlyMins} Mins` : `${earlyMins} Mins`;
            }
          }

          const record: AttendanceRecord = {
            employee_id: emp.employee_id,
            employee_name: emp.full_name,
            employee_code: emp.employee_id,
            department: emp.department,
            work_date: dateStr,
            day: dayName,
            actual_punch_in: attRecord?.clock_in_time || null,
            actual_punch_out: attRecord?.clock_out_time || null,
            work_hours: workHours,
            late_in: lateIn,
            early_out: earlyOut,
            flex_time: '-',
            comments: isWeekendDay ? 'WEEKEND' : (dayLeave ? leaveTypeMap.get(dayLeave.leave_type_id) || 'ON LEAVE' : (attRecord?.notes || '-')),
            leave_type: dayLeave ? leaveTypeMap.get(dayLeave.leave_type_id) || null : null,
            status: attRecord?.status || (isWeekendDay ? 'weekend' : 'absent'),
            expected_start: schedule?.start_time || null,
            expected_end: schedule?.end_time || null,
          };

          allRecords.push(record);
        });

        currentDate.setDate(currentDate.getDate() + 1);
      }

      setRecords(allRecords);
    } catch (error) {
      console.error('Error fetching attendance data:', error);
      toast.error('Failed to load attendance data');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = () => {
    try {
      const headers = [
        'Employee ID',
        'Employee Name',
        'Department',
        'Work Date',
        'Day',
        'Actual Punch In',
        'Actual Punch Out',
        'Expected In',
        'Expected Out',
        'Work Hours',
        'Late In',
        'Early Out',
        'Flex Time',
        'Comments',
        'Leave'
      ];

      const csvContent = [
        headers.join(','),
        ...records.map(r => [
          r.employee_code,
          `"${r.employee_name}"`,
          `"${r.department}"`,
          r.work_date,
          r.day,
          r.actual_punch_in || '-',
          r.actual_punch_out || '-',
          r.expected_start || '-',
          r.expected_end || '-',
          r.work_hours,
          r.late_in,
          r.early_out,
          r.flex_time,
          `"${r.comments}"`,
          r.leave_type || '-'
        ].join(','))
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `team_attendance_${startDate}_to_${endDate}.csv`;
      link.click();

      toast.success('Report exported successfully');
    } catch (error) {
      console.error('Error exporting:', error);
      toast.error('Failed to export report');
    }
  };

  const getRowColor = (record: AttendanceRecord) => {
    if (record.comments === 'WEEKEND') return 'bg-muted/30';
    if (record.leave_type) return 'bg-blue-50 dark:bg-blue-950/20';
    if (record.status === 'absent') return 'bg-red-50 dark:bg-red-950/20';
    if (record.late_in !== '-') return 'bg-yellow-50 dark:bg-yellow-950/20';
    if (record.early_out !== '-') return 'bg-orange-50 dark:bg-orange-950/20';
    return '';
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-8 w-64" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-96 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-2xl font-bold">Team Attendance Report</CardTitle>
            <Button onClick={handleExport} variant="outline" size="sm">
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
          </div>
          <div className="flex items-center gap-4 mt-4">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <label className="text-sm font-medium">From:</label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-40"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium">To:</label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-40"
              />
            </div>
            <Button onClick={fetchAttendanceData} variant="default" size="sm">
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-24">Employee ID</TableHead>
                  <TableHead className="min-w-[180px]">Employee Name</TableHead>
                  <TableHead className="min-w-[150px]">Department</TableHead>
                  <TableHead className="w-28">Work Date</TableHead>
                  <TableHead className="w-24">Day</TableHead>
                  <TableHead className="w-24">Actual In</TableHead>
                  <TableHead className="w-24">Actual Out</TableHead>
                  <TableHead className="w-24">Expected In</TableHead>
                  <TableHead className="w-24">Expected Out</TableHead>
                  <TableHead className="min-w-[120px]">Work Hours</TableHead>
                  <TableHead className="w-24">Late In</TableHead>
                  <TableHead className="w-24">Early Out</TableHead>
                  <TableHead className="min-w-[200px]">Comments</TableHead>
                  <TableHead className="w-24">Leave</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {records.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={14} className="text-center py-8 text-muted-foreground">
                      No attendance records found for the selected date range
                    </TableCell>
                  </TableRow>
                ) : (
                  records.map((record, idx) => (
                    <TableRow key={`${record.employee_id}_${record.work_date}`} className={getRowColor(record)}>
                      <TableCell className="font-mono text-sm">{record.employee_code}</TableCell>
                      <TableCell className="font-medium">{record.employee_name}</TableCell>
                      <TableCell>{record.department}</TableCell>
                      <TableCell>{format(new Date(record.work_date), 'dd-MMM-yyyy')}</TableCell>
                      <TableCell className="font-medium">{record.day}</TableCell>
                      <TableCell className="font-mono text-sm">{record.actual_punch_in || '-'}</TableCell>
                      <TableCell className="font-mono text-sm">{record.actual_punch_out || '-'}</TableCell>
                      <TableCell className="font-mono text-sm text-muted-foreground">{record.expected_start || '-'}</TableCell>
                      <TableCell className="font-mono text-sm text-muted-foreground">{record.expected_end || '-'}</TableCell>
                      <TableCell className="font-medium">{record.work_hours}</TableCell>
                      <TableCell className={record.late_in !== '-' ? 'text-yellow-600 dark:text-yellow-400 font-medium' : ''}>
                        {record.late_in}
                      </TableCell>
                      <TableCell className={record.early_out !== '-' ? 'text-orange-600 dark:text-orange-400 font-medium' : ''}>
                        {record.early_out}
                      </TableCell>
                      <TableCell className="text-sm">{record.comments}</TableCell>
                      <TableCell>
                        {record.leave_type && (
                          <Badge variant="secondary" className="text-xs">
                            {record.leave_type}
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          
          {records.length > 0 && (
            <div className="mt-4 text-sm text-muted-foreground">
              <p>Total Records: {records.length}</p>
              <div className="flex gap-4 mt-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-muted/30 border"></div>
                  <span>Weekend</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-blue-50 dark:bg-blue-950/20 border"></div>
                  <span>On Leave</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-red-50 dark:bg-red-950/20 border"></div>
                  <span>Absent</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-yellow-50 dark:bg-yellow-950/20 border"></div>
                  <span>Late In</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-orange-50 dark:bg-orange-950/20 border"></div>
                  <span>Early Out</span>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
