import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowUpDown, ArrowUp, ArrowDown, LayoutGrid, LayoutList } from 'lucide-react';
import { format, startOfMonth, endOfMonth, getDay } from 'date-fns';
import { toast } from 'sonner';
import { AttendanceSummaryCards } from './attendance/AttendanceSummaryCards';
import { AttendanceCharts } from './attendance/AttendanceCharts';
import { AttendanceFilters } from './attendance/AttendanceFilters';
import { AttendanceTableSummary } from './attendance/AttendanceTableSummary';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

type SortField = 'employeeId' | 'employeeName' | 'date' | 'clockIn' | 'clockOut' | 'lateHours' | 'earlyHours' | 'pendingLeaves' | 'remark';
type SortDirection = 'asc' | 'desc' | null;

export const AttendanceReport = () => {
  const currentDate = new Date();
  const [selectedMonth, setSelectedMonth] = useState(format(currentDate, 'yyyy-MM'));
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'late' | 'early' | 'absent' | 'ontime' | 'issues'>('all');
  const [viewMode, setViewMode] = useState<'summary' | 'detailed'>('summary');
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

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

    let filtered = attendanceData.filter(record => {
      // Search filter
      const matchesSearch = !searchTerm || 
        record.employeeId.toLowerCase().includes(searchTerm.toLowerCase()) ||
        record.employeeName.toLowerCase().includes(searchTerm.toLowerCase());

      // Status filter
      let matchesStatus = true;
      if (statusFilter === 'late') {
        matchesStatus = parseFloat(record.lateHours) > 0;
      } else if (statusFilter === 'early') {
        matchesStatus = parseFloat(record.earlyHours) > 0;
      } else if (statusFilter === 'absent') {
        matchesStatus = record.remark === 'Absent';
      } else if (statusFilter === 'ontime') {
        matchesStatus = record.remark === 'On Time';
      } else if (statusFilter === 'issues') {
        matchesStatus = record.remark !== 'On Time' && record.remark !== 'Absent';
      }

      return matchesSearch && matchesStatus;
    });

    // Apply sorting
    if (sortField && sortDirection) {
      filtered = [...filtered].sort((a, b) => {
        let aValue = a[sortField];
        let bValue = b[sortField];

        // Convert to numbers for numeric fields
        if (sortField === 'lateHours' || sortField === 'earlyHours' || sortField === 'pendingLeaves') {
          aValue = parseFloat(aValue as string) || 0;
          bValue = parseFloat(bValue as string) || 0;
        }

        // Compare values
        if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return filtered;
  }, [attendanceData, searchTerm, statusFilter, sortField, sortDirection]);

  // Calculate summary statistics
  const summaryStats = useMemo(() => {
    if (!attendanceData) {
      return {
        totalRecords: 0,
        onTimeCount: 0,
        lateCount: 0,
        earlyCount: 0,
        absentCount: 0,
        pendingLeavesCount: 0,
      };
    }

    const stats = {
      totalRecords: attendanceData.length,
      onTimeCount: 0,
      lateCount: 0,
      earlyCount: 0,
      absentCount: 0,
      pendingLeavesCount: 0,
    };

    attendanceData.forEach(record => {
      if (record.remark === 'On Time') stats.onTimeCount++;
      if (record.remark === 'Late' || record.remark === 'Late & Early') stats.lateCount++;
      if (record.remark === 'Early' || record.remark === 'Late & Early') stats.earlyCount++;
      if (record.remark === 'Absent') stats.absentCount++;
      if (record.pendingLeaves > 0) stats.pendingLeavesCount += record.pendingLeaves;
    });

    return stats;
  }, [attendanceData]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (statusFilter !== 'all') count++;
    if (searchTerm) count++;
    return count;
  }, [statusFilter, searchTerm]);

  const handleClearFilters = () => {
    setStatusFilter('all');
    setSearchTerm('');
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      // Cycle through: asc -> desc -> null
      if (sortDirection === 'asc') {
        setSortDirection('desc');
      } else if (sortDirection === 'desc') {
        setSortDirection(null);
        setSortField('date');
      } else {
        setSortDirection('asc');
      }
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) {
      return <ArrowUpDown className="h-4 w-4 ml-1 opacity-40" />;
    }
    if (sortDirection === 'asc') {
      return <ArrowUp className="h-4 w-4 ml-1" />;
    }
    if (sortDirection === 'desc') {
      return <ArrowDown className="h-4 w-4 ml-1" />;
    }
    return <ArrowUpDown className="h-4 w-4 ml-1 opacity-40" />;
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
      ...filteredData.map(row => [
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
        <div className="flex items-center justify-between">
          <CardTitle>Employee Attendance Report</CardTitle>
          <Tabs value={viewMode} onValueChange={(v: any) => setViewMode(v)}>
            <TabsList>
              <TabsTrigger value="summary" className="gap-2">
                <LayoutGrid className="h-4 w-4" />
                Summary
              </TabsTrigger>
              <TabsTrigger value="detailed" className="gap-2">
                <LayoutList className="h-4 w-4" />
                Detailed
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Summary Cards */}
        <AttendanceSummaryCards {...summaryStats} />

        {/* Filters */}
        <AttendanceFilters
          selectedMonth={selectedMonth}
          setSelectedMonth={setSelectedMonth}
          monthOptions={monthOptions}
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          statusFilter={statusFilter}
          setStatusFilter={setStatusFilter}
          onExport={handleExport}
          activeFilterCount={activeFilterCount}
          onClearFilters={handleClearFilters}
        />

        {/* Charts */}
        {!isLoading && filteredData.length > 0 && (
          <AttendanceCharts data={filteredData} />
        )}

        {/* View Mode Content */}
        {viewMode === 'summary' ? (
          <AttendanceTableSummary data={filteredData} isLoading={isLoading} />
        ) : (

          <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead 
                  className="cursor-pointer select-none hover:bg-muted/50"
                  onClick={() => handleSort('employeeId')}
                >
                  <div className="flex items-center">
                    Staff ID
                    <SortIcon field="employeeId" />
                  </div>
                </TableHead>
                <TableHead 
                  className="cursor-pointer select-none hover:bg-muted/50"
                  onClick={() => handleSort('employeeName')}
                >
                  <div className="flex items-center">
                    Staff Name
                    <SortIcon field="employeeName" />
                  </div>
                </TableHead>
                <TableHead 
                  className="cursor-pointer select-none hover:bg-muted/50"
                  onClick={() => handleSort('date')}
                >
                  <div className="flex items-center">
                    Date
                    <SortIcon field="date" />
                  </div>
                </TableHead>
                <TableHead>Day</TableHead>
                <TableHead 
                  className="cursor-pointer select-none hover:bg-muted/50"
                  onClick={() => handleSort('clockIn')}
                >
                  <div className="flex items-center">
                    Clock In
                    <SortIcon field="clockIn" />
                  </div>
                </TableHead>
                <TableHead 
                  className="cursor-pointer select-none hover:bg-muted/50"
                  onClick={() => handleSort('clockOut')}
                >
                  <div className="flex items-center">
                    Clock Out
                    <SortIcon field="clockOut" />
                  </div>
                </TableHead>
                <TableHead 
                  className="cursor-pointer select-none hover:bg-muted/50"
                  onClick={() => handleSort('lateHours')}
                >
                  <div className="flex items-center">
                    Late Hours
                    <SortIcon field="lateHours" />
                  </div>
                </TableHead>
                <TableHead 
                  className="cursor-pointer select-none hover:bg-muted/50"
                  onClick={() => handleSort('earlyHours')}
                >
                  <div className="flex items-center">
                    Early Hours
                    <SortIcon field="earlyHours" />
                  </div>
                </TableHead>
                <TableHead 
                  className="cursor-pointer select-none hover:bg-muted/50"
                  onClick={() => handleSort('pendingLeaves')}
                >
                  <div className="flex items-center">
                    Leave Pending
                    <SortIcon field="pendingLeaves" />
                  </div>
                </TableHead>
                <TableHead 
                  className="cursor-pointer select-none hover:bg-muted/50"
                  onClick={() => handleSort('remark')}
                >
                  <div className="flex items-center">
                    Remark
                    <SortIcon field="remark" />
                  </div>
                </TableHead>
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
                filteredData.map((record, index) => (
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
        )}
      </CardContent>
    </Card>
  );
};
