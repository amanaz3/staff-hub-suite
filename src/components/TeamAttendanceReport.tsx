import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Download, Calendar, CalendarDays, Search, X, Users, LayoutGrid } from 'lucide-react';
import { format, parse, isWeekend, addDays, startOfMonth, endOfMonth, startOfWeek, endOfWeek, subDays, subMonths } from 'date-fns';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { AttendanceCalendar } from './AttendanceCalendar';
import { useSystemSettings } from '@/hooks/useSystemSettings';

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
  const { getDeductionInHours } = useSystemSettings();

  // Helper function to parse hours from "X Hrs Y Mins" format
  const parseHoursFromString = (hoursString: string): number => {
    if (!hoursString || hoursString === '0 Hrs 0 Mins') return 0;
    
    // Match pattern "X Hrs Y Mins"
    const hoursMatch = hoursString.match(/(\d+)\s*Hrs?/i);
    const minsMatch = hoursString.match(/(\d+)\s*Mins?/i);
    
    const hours = hoursMatch ? parseInt(hoursMatch[1], 10) : 0;
    const minutes = minsMatch ? parseInt(minsMatch[1], 10) : 0;
    
    // Convert to decimal hours
    return hours + (minutes / 60);
  };

  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [startDate, setStartDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [isStartDateOpen, setIsStartDateOpen] = useState(false);
  const [isEndDateOpen, setIsEndDateOpen] = useState(false);
  
  // Filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEmployee, setSelectedEmployee] = useState<string>('all');
  const [selectedDepartment, setSelectedDepartment] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'table' | 'calendar'>('table');

  useEffect(() => {
    fetchAttendanceData();
  }, [startDate, endDate]);

  const applyPresetRange = (preset: string) => {
    const today = new Date();
    let newStart: Date;
    let newEnd: Date;
    
    switch (preset) {
      case 'today':
        newStart = today;
        newEnd = today;
        break;
      case 'yesterday':
        newStart = subDays(today, 1);
        newEnd = subDays(today, 1);
        break;
      case 'last7days':
        newStart = subDays(today, 6);
        newEnd = today;
        break;
      case 'last30days':
        newStart = subDays(today, 29);
        newEnd = today;
        break;
      case 'thisMonth':
        newStart = startOfMonth(today);
        newEnd = endOfMonth(today);
        break;
      case 'lastMonth':
        const lastMonth = subMonths(today, 1);
        newStart = startOfMonth(lastMonth);
        newEnd = endOfMonth(lastMonth);
        break;
      case 'thisWeek':
        newStart = startOfWeek(today);
        newEnd = endOfWeek(today);
        break;
      default:
        return;
    }
    
    setStartDate(format(newStart, 'yyyy-MM-dd'));
    setEndDate(format(newEnd, 'yyyy-MM-dd'));
  };

  const validateDateRange = () => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    if (end < start) {
      toast.error('End date must be after start date');
      return false;
    }
    
    const daysDiff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    if (daysDiff > 365) {
      toast.error('Date range cannot exceed 365 days');
      return false;
    }
    
    return true;
  };

  const fetchAttendanceData = async () => {
    if (!validateDateRange()) return;
    
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
        ...filteredRecords.map(r => [
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

  // Get unique values for filters
  const uniqueEmployees = useMemo(() => {
    const employeeMap = new Map<string, { id: string; name: string; code: string }>();
    records.forEach(r => {
      if (!employeeMap.has(r.employee_id)) {
        employeeMap.set(r.employee_id, { id: r.employee_id, name: r.employee_name, code: r.employee_code });
      }
    });
    return Array.from(employeeMap.values()).sort((a, b) => a.code.localeCompare(b.code));
  }, [records]);

  const uniqueDepartments = useMemo(() => {
    return Array.from(new Set(records.map(r => r.department))).sort();
  }, [records]);

  // Filter records
  const filteredRecords = useMemo(() => {
    return records.filter(record => {
      // Search filter (name or employee ID)
      const matchesSearch = searchTerm === '' || 
        record.employee_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        record.employee_code.toLowerCase().includes(searchTerm.toLowerCase());
      
      // Employee filter
      const matchesEmployee = selectedEmployee === 'all' || 
        record.employee_id === selectedEmployee;
      
      // Department filter
      const matchesDepartment = selectedDepartment === 'all' || 
        record.department === selectedDepartment;
      
      // Status filter
      let matchesStatus = true;
      if (selectedStatus !== 'all') {
        switch (selectedStatus) {
          case 'present':
            matchesStatus = record.status === 'present' && record.late_in === '-';
            break;
          case 'late':
            matchesStatus = record.late_in !== '-';
            break;
          case 'absent':
            matchesStatus = record.status === 'absent';
            break;
          case 'leave':
            matchesStatus = record.leave_type !== null;
            break;
          case 'weekend':
            matchesStatus = record.comments === 'WEEKEND';
            break;
        }
      }
      
      return matchesSearch && matchesEmployee && matchesDepartment && matchesStatus;
    });
  }, [records, searchTerm, selectedEmployee, selectedDepartment, selectedStatus]);

  // Calculate statistics
  const statistics = useMemo(() => {
    const uniqueEmployeeIds = new Set(filteredRecords.map(r => r.employee_id));
    const totalEmployees = uniqueEmployeeIds.size;
    const present = filteredRecords.filter(r => r.status === 'present' && r.late_in === '-').length;
    const late = filteredRecords.filter(r => r.late_in !== '-').length;
    const absent = filteredRecords.filter(r => r.status === 'absent').length;
    const onLeave = filteredRecords.filter(r => r.leave_type !== null).length;
    const weekend = filteredRecords.filter(r => r.comments === 'WEEKEND').length;
    
    return { totalEmployees, present, late, absent, onLeave, weekend };
  }, [filteredRecords]);

  // Clear all filters
  const clearFilters = () => {
    setSearchTerm('');
    setSelectedEmployee('all');
    setSelectedDepartment('all');
    setSelectedStatus('all');
  };

  // Active filter count
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (searchTerm) count++;
    if (selectedEmployee !== 'all') count++;
    if (selectedDepartment !== 'all') count++;
    if (selectedStatus !== 'all') count++;
    return count;
  }, [searchTerm, selectedEmployee, selectedDepartment, selectedStatus]);

  // Calendar view data - transform to AttendanceCalendar format
  const calendarAttendanceData = useMemo(() => {
    if (viewMode !== 'calendar' || selectedEmployee === 'all') return [];
    
    const employeeRecords = filteredRecords.filter(r => r.employee_id === selectedEmployee);
    
    return employeeRecords.map(record => {
      // Parse times (they're already in string format HH:MM:SS)
      const clockInTime = record.actual_punch_in ? 
        new Date(`${record.work_date}T${record.actual_punch_in}`) : null;
      const clockOutTime = record.actual_punch_out ? 
        new Date(`${record.work_date}T${record.actual_punch_out}`) : null;
      
      // Parse total hours from "X Hrs Y Mins" format
      const rawHours = parseHoursFromString(record.work_hours);
      const totalHours = Math.max(0, rawHours - getDeductionInHours());
      
      // Determine if it's a working day
      const isWorkingDay = record.comments !== 'WEEKEND' && !record.leave_type;
      
      // Calculate late/early minutes
      const lateMinutes = record.late_in !== '-' ? 
        parseInt(record.late_in.replace(/[^\d]/g, '')) || 0 : 0;
      const earlyMinutes = record.early_out !== '-' ? 
        parseInt(record.early_out.replace(/[^\d]/g, '')) || 0 : 0;
      
      return {
        id: `${record.employee_id}-${record.work_date}`,
        date: record.work_date,
        status: record.status,
        clock_in_time: record.actual_punch_in,
        clock_out_time: record.actual_punch_out,
        total_hours: totalHours,
        is_wfh: record.comments?.includes('WFH') || false,
        notes: record.comments,
        dayOfWeek: record.day,
        isWorkingDay,
        lateMinutes,
        earlyMinutes,
        leaveType: record.leave_type,
        clockInTime,
        clockOutTime,
      };
    });
  }, [filteredRecords, selectedEmployee, viewMode]);

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
            <div className="flex items-center gap-2">
              <Button onClick={handleExport} variant="outline" size="sm" disabled={filteredRecords.length === 0}>
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
            </div>
          </div>
          <div className="space-y-4 mt-4">
            {/* Preset Range Buttons */}
            <div className="flex flex-wrap gap-2">
              <Button 
                onClick={() => applyPresetRange('today')} 
                variant="outline" 
                size="sm"
              >
                Today
              </Button>
              <Button 
                onClick={() => applyPresetRange('yesterday')} 
                variant="outline" 
                size="sm"
              >
                Yesterday
              </Button>
              <Button 
                onClick={() => applyPresetRange('thisWeek')} 
                variant="outline" 
                size="sm"
              >
                This Week
              </Button>
              <Button 
                onClick={() => applyPresetRange('last7days')} 
                variant="outline" 
                size="sm"
              >
                Last 7 Days
              </Button>
              <Button 
                onClick={() => applyPresetRange('last30days')} 
                variant="outline" 
                size="sm"
              >
                Last 30 Days
              </Button>
              <Button 
                onClick={() => applyPresetRange('thisMonth')} 
                variant="outline" 
                size="sm"
              >
                This Month
              </Button>
              <Button 
                onClick={() => applyPresetRange('lastMonth')} 
                variant="outline" 
                size="sm"
              >
                Last Month
              </Button>
            </div>

            {/* Date Range Selectors with Calendar Popups */}
            <div className="flex items-center gap-4 flex-wrap">
              {/* Start Date */}
              <div className="flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-muted-foreground" />
                <label className="text-sm font-medium">From:</label>
                <Popover open={isStartDateOpen} onOpenChange={setIsStartDateOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-[200px] justify-start text-left font-normal",
                        !startDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarDays className="mr-2 h-4 w-4" />
                      {startDate ? format(new Date(startDate), 'PPP') : <span>Pick a date</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarComponent
                      mode="single"
                      selected={startDate ? new Date(startDate) : undefined}
                      onSelect={(date) => {
                        if (date) {
                          setStartDate(format(date, 'yyyy-MM-dd'));
                          setIsStartDateOpen(false);
                        }
                      }}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              {/* End Date */}
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium">To:</label>
                <Popover open={isEndDateOpen} onOpenChange={setIsEndDateOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-[200px] justify-start text-left font-normal",
                        !endDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarDays className="mr-2 h-4 w-4" />
                      {endDate ? format(new Date(endDate), 'PPP') : <span>Pick a date</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarComponent
                      mode="single"
                      selected={endDate ? new Date(endDate) : undefined}
                      onSelect={(date) => {
                        if (date) {
                          setEndDate(format(date, 'yyyy-MM-dd'));
                          setIsEndDateOpen(false);
                        }
                      }}
                      disabled={(date) => {
                        // Disable dates before start date
                        return startDate ? date < new Date(startDate) : false;
                      }}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <Button onClick={fetchAttendanceData} variant="default" size="sm">
                Refresh
              </Button>
            </div>

            {/* Filters Section */}
            <div className="border-t pt-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <Search className="h-4 w-4" />
                  Filters
                  {activeFilterCount > 0 && (
                    <Badge variant="secondary" className="ml-2">
                      {activeFilterCount} active
                    </Badge>
                  )}
                </h3>
                {activeFilterCount > 0 && (
                  <Button onClick={clearFilters} variant="ghost" size="sm">
                    <X className="h-4 w-4 mr-1" />
                    Clear All
                  </Button>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                {/* Search Input */}
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Search</label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Name or Employee ID..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                </div>

                {/* Employee Filter */}
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Employee</label>
                  <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                    <SelectTrigger>
                      <SelectValue placeholder="All Employees" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Employees</SelectItem>
                      {uniqueEmployees.map(emp => (
                        <SelectItem key={emp.id} value={emp.id}>
                          {emp.code} - {emp.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Department Filter */}
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Department</label>
                  <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
                    <SelectTrigger>
                      <SelectValue placeholder="All Departments" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Departments</SelectItem>
                      {uniqueDepartments.map(dept => (
                        <SelectItem key={dept} value={dept}>
                          {dept}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Status Filter */}
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Status</label>
                  <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                    <SelectTrigger>
                      <SelectValue placeholder="All Statuses" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Statuses</SelectItem>
                      <SelectItem value="present">Present</SelectItem>
                      <SelectItem value="late">Late In</SelectItem>
                      <SelectItem value="absent">Absent</SelectItem>
                      <SelectItem value="leave">On Leave</SelectItem>
                      <SelectItem value="weekend">Weekend</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Statistics Summary */}
            {filteredRecords.length > 0 && (
              <div className="bg-muted/50 rounded-lg p-4 border">
                <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-primary">{statistics.totalEmployees}</div>
                    <div className="text-xs text-muted-foreground">Employees</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600 dark:text-green-400">{statistics.present}</div>
                    <div className="text-xs text-muted-foreground">Present</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">{statistics.late}</div>
                    <div className="text-xs text-muted-foreground">Late</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-red-600 dark:text-red-400">{statistics.absent}</div>
                    <div className="text-xs text-muted-foreground">Absent</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{statistics.onLeave}</div>
                    <div className="text-xs text-muted-foreground">On Leave</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-gray-600 dark:text-gray-400">{statistics.weekend}</div>
                    <div className="text-xs text-muted-foreground">Weekend</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {/* View Mode Tabs */}
          <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as 'table' | 'calendar')} className="w-full">
            <TabsList className="grid w-full max-w-md mx-auto grid-cols-2 mb-4">
              <TabsTrigger value="table">
                <LayoutGrid className="h-4 w-4 mr-2" />
                Table View
              </TabsTrigger>
              <TabsTrigger value="calendar">
                <Users className="h-4 w-4 mr-2" />
                Calendar View
              </TabsTrigger>
            </TabsList>

            {/* Table View */}
            <TabsContent value="table" className="mt-0">
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
                    {filteredRecords.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={14} className="text-center py-8 text-muted-foreground">
                          {records.length === 0 
                            ? 'No attendance records found for the selected date range'
                            : 'No records match the selected filters'}
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredRecords.map((record, idx) => (
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
              
              {filteredRecords.length > 0 && (
                <div className="mt-4 text-sm text-muted-foreground">
                  <p>
                    Showing {filteredRecords.length} of {records.length} records
                    {activeFilterCount > 0 && ` (${activeFilterCount} filter${activeFilterCount > 1 ? 's' : ''} applied)`}
                  </p>
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
            </TabsContent>

            {/* Calendar View */}
            <TabsContent value="calendar" className="mt-0">
              {selectedEmployee === 'all' ? (
                <div className="text-center py-12 px-4">
                  <Users className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Select an Employee</h3>
                  <p className="text-muted-foreground mb-4">
                    Please select a specific employee from the filters above to view their attendance calendar.
                  </p>
                </div>
              ) : calendarAttendanceData.length > 0 ? (
                <div className="max-w-4xl mx-auto">
                  <div className="mb-4 p-4 bg-muted/30 rounded-lg border">
                    <h3 className="font-semibold text-lg mb-1">
                      {uniqueEmployees.find(e => e.id === selectedEmployee)?.name}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      Employee ID: {uniqueEmployees.find(e => e.id === selectedEmployee)?.code}
                    </p>
                  </div>
                  <AttendanceCalendar
                    month={new Date(startDate)}
                    attendanceData={calendarAttendanceData}
                    onDayClick={(record, date) => {
                      if (record) {
                        const workHours = record.total_hours 
                          ? `${record.total_hours.toFixed(1)}h` 
                          : '0h';
                        toast.info(`${format(date, 'PPP')}`, {
                          description: `Status: ${record.status} | Hours: ${workHours}`
                        });
                      }
                    }}
                  />
                </div>
              ) : (
                <div className="text-center py-12 px-4">
                  <Calendar className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No Attendance Data</h3>
                  <p className="text-muted-foreground">
                    No attendance records found for the selected employee in this date range.
                  </p>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};
