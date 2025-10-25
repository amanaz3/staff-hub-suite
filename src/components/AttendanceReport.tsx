import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { StatusBadge } from '@/components/ui/status-badge';
import { Download, Search, FileText, ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';
import { format, startOfMonth, endOfMonth, getDay, isFuture, startOfDay } from 'date-fns';
import { toast } from 'sonner';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export const AttendanceReport = () => {
  const currentDate = new Date();
  const [selectedMonth, setSelectedMonth] = useState(format(currentDate, 'yyyy-MM'));
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEmployee, setSelectedEmployee] = useState<string>('all');
  const [showExceptionsOnly, setShowExceptionsOnly] = useState(false);
  const [showLateOnly, setShowLateOnly] = useState(false);
  const [showEarlyOnly, setShowEarlyOnly] = useState(false);
  const [showAbsentOnly, setShowAbsentOnly] = useState(false);
  const [sortColumn, setSortColumn] = useState<string>('date');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // Generate last 12 months for dropdown
  const monthOptions = useMemo(() => {
    const months = [];
    for (let i = 0; i < 12; i++) {
      const date = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
      months.push({
        value: format(date, 'yyyy-MM'),
        label: format(date, 'MMMM yyyy')
      });
    }
    return months;
  }, []);

  // Fetch employees for dropdown
  const { data: employeesList } = useQuery({
    queryKey: ['employees-list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('employees')
        .select('id, employee_id, full_name')
        .eq('status', 'active')
        .order('full_name');
      
      if (error) throw error;
      return data;
    }
  });

  const { data: attendanceData, isLoading } = useQuery({
    queryKey: ['attendance-report', selectedMonth],
    queryFn: async () => {
      const monthDate = new Date(selectedMonth + '-01');
      const startDate = format(startOfMonth(monthDate), 'yyyy-MM-dd');
      const endDate = format(endOfMonth(monthDate), 'yyyy-MM-dd');

      // Fetch employees
      const { data: employees, error: empError } = await supabase
        .from('employees')
        .select('id, employee_id, full_name, user_id')
        .eq('status', 'active');

      if (empError) throw empError;

      // Fetch attendance records
      const { data: attendance, error: attError } = await supabase
        .from('attendance')
        .select('*')
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: false });

      if (attError) throw attError;

      // Fetch work schedules
      const { data: schedules, error: schedError } = await supabase
        .from('work_schedules')
        .select('*')
        .eq('is_active', true);

      if (schedError) throw schedError;

      // Fetch pending leave counts
      const { data: leaves, error: leaveError } = await supabase
        .from('leave_requests')
        .select('employee_id')
        .eq('status', 'pending');

      if (leaveError) throw leaveError;

      // Map pending leaves count per employee
      const pendingLeavesMap = leaves?.reduce((acc, leave) => {
        acc[leave.employee_id] = (acc[leave.employee_id] || 0) + 1;
        return acc;
      }, {} as Record<string, number>) || {};

      // Map schedules by employee
      const scheduleMap = schedules?.reduce((acc, schedule) => {
        acc[schedule.employee_id] = schedule;
        return acc;
      }, {} as Record<string, any>) || {};

      // Create attendance records for each employee for each day in the month
      const result = [];
      const daysInMonth = endOfMonth(monthDate).getDate();

      for (const employee of employees || []) {
        for (let day = 1; day <= daysInMonth; day++) {
          const currentDay = new Date(monthDate.getFullYear(), monthDate.getMonth(), day);
          const dateStr = format(currentDay, 'yyyy-MM-dd');
          
          // Skip future dates
          if (isFuture(startOfDay(currentDay))) {
            continue;
          }
          
          const attRecord = attendance?.find(
            a => a.employee_id === employee.id && a.date === dateStr
          );

          const schedule = scheduleMap[employee.id];
          const scheduledStart = schedule?.start_time || '09:00:00';
          const scheduledEnd = schedule?.end_time || '17:00:00';

          let lateHours = 0;
          let earlyHours = 0;
          let remark = 'Absent';

          if (attRecord?.clock_in_time && attRecord?.clock_out_time) {
            const clockIn = new Date(attRecord.clock_in_time);
            const clockOut = new Date(attRecord.clock_out_time);
            
            const scheduledStartTime = new Date(attRecord.date + 'T' + scheduledStart);
            const scheduledEndTime = new Date(attRecord.date + 'T' + scheduledEnd);

            // Calculate late hours
            if (clockIn > scheduledStartTime) {
              lateHours = (clockIn.getTime() - scheduledStartTime.getTime()) / (1000 * 60 * 60);
            }

            // Calculate early hours
            if (clockOut < scheduledEndTime) {
              earlyHours = (scheduledEndTime.getTime() - clockOut.getTime()) / (1000 * 60 * 60);
            }

            // Determine remark
            if (lateHours > 0 && earlyHours > 0) {
              remark = 'Late & Early';
            } else if (lateHours > 0) {
              remark = 'Late';
            } else if (earlyHours > 0) {
              remark = 'Early';
            } else {
              remark = 'On Time';
            }
          } else if (attRecord?.clock_in_time) {
            remark = 'Incomplete';
          }

          result.push({
            employeeId: employee.employee_id,
            employeeName: employee.full_name,
            employeeDbId: employee.id,
            date: dateStr,
            day: DAYS[getDay(currentDay)],
            clockIn: attRecord?.clock_in_time ? format(new Date(attRecord.clock_in_time), 'HH:mm') : '--:--',
            clockOut: attRecord?.clock_out_time ? format(new Date(attRecord.clock_out_time), 'HH:mm') : '--:--',
            lateHours: lateHours > 0 ? lateHours.toFixed(2) : '0.00',
            earlyHours: earlyHours > 0 ? earlyHours.toFixed(2) : '0.00',
            pendingLeaves: pendingLeavesMap[employee.id] || 0,
            remark
          });
        }
      }

      return result;
    }
  });

  const filteredData = useMemo(() => {
    if (!attendanceData) return [];

    return attendanceData.filter(record => {
      const matchesSearch = !searchTerm || 
        record.employeeId.toLowerCase().includes(searchTerm.toLowerCase()) ||
        record.employeeName.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesEmployee = selectedEmployee === 'all' || record.employeeDbId === selectedEmployee;
      const matchesExceptions = !showExceptionsOnly || record.remark !== 'On Time';
      const matchesLate = !showLateOnly || parseFloat(record.lateHours) > 0;
      const matchesEarly = !showEarlyOnly || parseFloat(record.earlyHours) > 0;
      const matchesAbsent = !showAbsentOnly || record.remark === 'Absent';

      return matchesSearch && matchesEmployee && matchesExceptions && matchesLate && matchesEarly && matchesAbsent;
    });
  }, [attendanceData, searchTerm, selectedEmployee, showExceptionsOnly, showLateOnly, showEarlyOnly, showAbsentOnly]);

  const sortedData = useMemo(() => {
    if (!filteredData.length) return [];

    const sorted = [...filteredData].sort((a, b) => {
      let compareValue = 0;

      switch (sortColumn) {
        case 'employeeId':
          compareValue = a.employeeId.localeCompare(b.employeeId);
          break;
        case 'employeeName':
          compareValue = a.employeeName.localeCompare(b.employeeName);
          break;
        case 'date':
          compareValue = new Date(a.date).getTime() - new Date(b.date).getTime();
          break;
        case 'lateHours':
          compareValue = parseFloat(a.lateHours) - parseFloat(b.lateHours);
          break;
        case 'earlyHours':
          compareValue = parseFloat(a.earlyHours) - parseFloat(b.earlyHours);
          break;
        case 'pendingLeaves':
          compareValue = a.pendingLeaves - b.pendingLeaves;
          break;
        default:
          compareValue = 0;
      }

      return sortDirection === 'asc' ? compareValue : -compareValue;
    });

    return sorted;
  }, [filteredData, sortColumn, sortDirection]);

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      if (sortDirection === 'desc') {
        setSortDirection('asc');
      } else {
        // Reset to default (date desc)
        setSortColumn('date');
        setSortDirection('desc');
      }
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const getSortIcon = (column: string) => {
    if (sortColumn !== column) {
      return <ArrowUpDown className="h-3.5 w-3.5 ml-1.5 opacity-50" />;
    }
    return sortDirection === 'asc' 
      ? <ArrowUp className="h-3.5 w-3.5 ml-1.5 text-primary" />
      : <ArrowDown className="h-3.5 w-3.5 ml-1.5 text-primary" />;
  };

  const handleExport = () => {
    if (!filteredData.length) {
      toast.error('No data to export');
      return;
    }

    const headers = [
      'Staff ID',
      'Staff Name',
      'Date',
      'Day',
      'Clock In',
      'Clock Out',
      'Late Hours',
      'Early Hours',
      'Leave Pending',
      'Remark'
    ];

    const csvContent = [
      headers.join(','),
      ...sortedData.map(row => [
        row.employeeId,
        `"${row.employeeName}"`,
        row.date,
        row.day,
        row.clockIn,
        row.clockOut,
        row.lateHours,
        row.earlyHours,
        row.pendingLeaves,
        row.remark
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `attendance_report_${selectedMonth}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    
    toast.success('Report exported successfully');
  };

  const getRemarkVariant = (remark: string) => {
    if (remark === 'On Time') return 'approved';
    if (remark === 'Late' || remark === 'Late & Early') return 'rejected';
    if (remark === 'Early') return 'pending';
    return 'rejected';
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Employee Attendance Report</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="w-full sm:w-48">
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {monthOptions.map(month => (
                  <SelectItem key={month.value} value={month.value}>
                    {month.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="w-full sm:w-64">
            <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
              <SelectTrigger>
                <SelectValue placeholder="All Employees" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Employees</SelectItem>
                {employeesList?.map(emp => (
                  <SelectItem key={emp.id} value={emp.id}>
                    {emp.full_name} ({emp.employee_id})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by Staff ID or Name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          <Button 
            onClick={() => setShowExceptionsOnly(!showExceptionsOnly)} 
            variant={showExceptionsOnly ? "default" : "outline"}
            className="gap-2"
          >
            <FileText className="h-4 w-4" />
            Exception Days {showExceptionsOnly && '✓'}
          </Button>

          <Button onClick={handleExport} variant="outline" className="gap-2">
            <Download className="h-4 w-4" />
            Export
          </Button>
        </div>

        {/* Filter Checkboxes */}
        <div className="flex flex-wrap gap-4">
          <div className="flex items-center space-x-2">
            <Checkbox 
              id="late" 
              checked={showLateOnly}
              onCheckedChange={(checked) => setShowLateOnly(checked as boolean)}
            />
            <label htmlFor="late" className="text-sm cursor-pointer">
              Show Late Only
            </label>
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox 
              id="early" 
              checked={showEarlyOnly}
              onCheckedChange={(checked) => setShowEarlyOnly(checked as boolean)}
            />
            <label htmlFor="early" className="text-sm cursor-pointer">
              Show Early Only
            </label>
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox 
              id="absent" 
              checked={showAbsentOnly}
              onCheckedChange={(checked) => setShowAbsentOnly(checked as boolean)}
            />
            <label htmlFor="absent" className="text-sm cursor-pointer">
              Show Absent Only
            </label>
          </div>
        </div>

        {/* Table */}
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead 
                  className="cursor-pointer hover:bg-accent transition-colors select-none"
                  onClick={() => handleSort('employeeId')}
                >
                  <div className="flex items-center whitespace-nowrap font-semibold">
                    Staff ID
                    {getSortIcon('employeeId')}
                  </div>
                </TableHead>
                <TableHead 
                  className="cursor-pointer hover:bg-accent transition-colors select-none"
                  onClick={() => handleSort('employeeName')}
                >
                  <div className="flex items-center whitespace-nowrap font-semibold">
                    Staff Name
                    {getSortIcon('employeeName')}
                  </div>
                </TableHead>
                <TableHead 
                  className="cursor-pointer hover:bg-accent transition-colors select-none"
                  onClick={() => handleSort('date')}
                >
                  <div className="flex items-center whitespace-nowrap font-semibold">
                    Date
                    {getSortIcon('date')}
                  </div>
                </TableHead>
                <TableHead className="font-semibold">Day</TableHead>
                <TableHead className="font-semibold">Clock In</TableHead>
                <TableHead className="font-semibold">Clock Out</TableHead>
                <TableHead 
                  className="cursor-pointer hover:bg-accent transition-colors select-none"
                  onClick={() => handleSort('lateHours')}
                >
                  <div className="flex items-center whitespace-nowrap font-semibold">
                    Late Hours
                    {getSortIcon('lateHours')}
                  </div>
                </TableHead>
                <TableHead 
                  className="cursor-pointer hover:bg-accent transition-colors select-none"
                  onClick={() => handleSort('earlyHours')}
                >
                  <div className="flex items-center whitespace-nowrap font-semibold">
                    Early Hours
                    {getSortIcon('earlyHours')}
                  </div>
                </TableHead>
                <TableHead 
                  className="cursor-pointer hover:bg-accent transition-colors select-none"
                  onClick={() => handleSort('pendingLeaves')}
                >
                  <div className="flex items-center whitespace-nowrap font-semibold">
                    Leave Pending
                    {getSortIcon('pendingLeaves')}
                  </div>
                </TableHead>
                <TableHead className="font-semibold">Remark</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center py-8">
                    Loading attendance data...
                  </TableCell>
                </TableRow>
              ) : filteredData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center py-8">
                    No attendance records found
                  </TableCell>
                </TableRow>
              ) : (
                sortedData.map((record, index) => (
                  <TableRow key={index}>
                    <TableCell className="font-medium">{record.employeeId}</TableCell>
                    <TableCell>{record.employeeName}</TableCell>
                    <TableCell>{format(new Date(record.date), 'MMM dd, yyyy')}</TableCell>
                    <TableCell>{record.day}</TableCell>
                    <TableCell>{record.clockIn}</TableCell>
                    <TableCell>{record.clockOut}</TableCell>
                    <TableCell>{record.lateHours}</TableCell>
                    <TableCell>{record.earlyHours}</TableCell>
                    <TableCell className="text-center">{record.pendingLeaves}</TableCell>
                    <TableCell>
                      <StatusBadge variant={getRemarkVariant(record.remark)}>
                        {record.remark}
                      </StatusBadge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
};
