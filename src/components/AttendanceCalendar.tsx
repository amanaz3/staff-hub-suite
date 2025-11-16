import { useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  startOfMonth, 
  endOfMonth, 
  eachDayOfInterval, 
  format, 
  isSameMonth,
  startOfWeek,
  endOfWeek,
  getDay,
  isValid
} from 'date-fns';
import { cn } from '@/lib/utils';
import { formatInGST } from '@/lib/timezone';
import { WeeklyHoursSummary } from './WeeklyHoursSummary';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

interface AttendanceRecord {
  id: string;
  date: string;
  status: string;
  clock_in_time: string | null;
  clock_out_time: string | null;
  total_hours: number | null;
  is_wfh: boolean;
  notes: string | null;
  dayOfWeek: string;
  isWorkingDay: boolean;
  lateMinutes: number;
  earlyMinutes: number;
  leaveType: string | null;
  clockInTime: Date | null;
  clockOutTime: Date | null;
}

interface AttendanceCalendarProps {
  month: Date;
  attendanceData: AttendanceRecord[];
  onDayClick?: (record: AttendanceRecord | null, date: Date) => void;
  showWeeklySummary?: boolean;
}

export const AttendanceCalendar = ({ 
  month, 
  attendanceData,
  onDayClick,
  showWeeklySummary = true
}: AttendanceCalendarProps) => {
  
  // Generate calendar grid
  const calendarDays = useMemo(() => {
    // Validate month prop
    if (!month || !isValid(month)) {
      return [];
    }
    
    const monthStart = startOfMonth(month);
    const monthEnd = endOfMonth(month);
    const calendarStart = startOfWeek(monthStart);
    const calendarEnd = endOfWeek(monthEnd);
    
    // Validate calculated dates
    if (!isValid(monthStart) || !isValid(monthEnd) || !isValid(calendarStart) || !isValid(calendarEnd)) {
      return [];
    }
    
    return eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  }, [month]);

  // Create a map of attendance records by date
  const attendanceMap = useMemo(() => {
    const map = new Map<string, AttendanceRecord>();
    attendanceData.forEach(record => {
      map.set(record.date, record);
    });
    return map;
  }, [attendanceData]);

  const getDayColor = (record: AttendanceRecord | null, date: Date) => {
    const isCurrentMonth = isSameMonth(date, month);
    
    if (!isCurrentMonth) {
      return 'bg-muted/30';
    }

    if (!record) {
      return 'bg-background hover:bg-muted/50';
    }

    if (!record.isWorkingDay) {
      return 'bg-muted/50';
    }

    if (record.leaveType) {
      return 'bg-blue-100 dark:bg-blue-950/40 hover:bg-blue-200 dark:hover:bg-blue-950/60';
    }

    if (record.status === 'absent') {
      return 'bg-red-100 dark:bg-red-950/40 hover:bg-red-200 dark:hover:bg-red-950/60';
    }

    if (record.lateMinutes > 0 || record.earlyMinutes > 0) {
      return 'bg-yellow-100 dark:bg-yellow-950/40 hover:bg-yellow-200 dark:hover:bg-yellow-950/60';
    }

    if (record.status === 'present') {
      return 'bg-green-100 dark:bg-green-950/40 hover:bg-green-200 dark:hover:bg-green-950/60';
    }

    return 'bg-background hover:bg-muted/50';
  };

  const getStatusBadge = (record: AttendanceRecord | null) => {
    if (!record) return null;

    if (record.leaveType) {
      return (
        <Badge variant="secondary" className="text-[10px] px-1 py-0 bg-blue-600 text-white">
          {record.leaveType.slice(0, 3)}
        </Badge>
      );
    }

    if (record.status === 'absent') {
      return (
        <Badge variant="destructive" className="text-[10px] px-1 py-0">
          ABS
        </Badge>
      );
    }

    if (record.lateMinutes > 0) {
      return (
        <Badge variant="secondary" className="text-[10px] px-1 py-0 bg-yellow-600 text-white">
          LATE
        </Badge>
      );
    }

    if (record.is_wfh) {
      return (
        <Badge variant="secondary" className="text-[10px] px-1 py-0">
          WFH
        </Badge>
      );
    }

    return null;
  };

  const formatTime = (time: Date | null) => {
    if (!time || !isValid(time)) return '--:--';
    return formatInGST(time, 'HH:mm');
  };

  return (
    <div className="w-full space-y-4">
      {/* Weekly Hours Summary */}
      {showWeeklySummary && (
        <WeeklyHoursSummary attendanceData={attendanceData} month={month} />
      )}
      
      {/* Calendar Grid */}
      <div className="grid grid-cols-7 gap-1">
        {/* Day headers */}
        {DAYS.map(day => (
          <div 
            key={day}
            className="text-center py-2 text-sm font-medium text-muted-foreground"
          >
            {day}
          </div>
        ))}

        {/* Calendar days */}
        {calendarDays.map((date, index) => {
          // Validate date before formatting
          if (!isValid(date)) return null;
          
          const dateStr = format(date, 'yyyy-MM-dd');
          const record = attendanceMap.get(dateStr);
          const isCurrentMonth = isSameMonth(date, month);
          const isToday = format(new Date(), 'yyyy-MM-dd') === dateStr;

          return (
            <Card
              key={index}
              className={cn(
                "min-h-[100px] cursor-pointer transition-all border",
                getDayColor(record, date),
                isToday && "ring-2 ring-primary",
                !isCurrentMonth && "opacity-50"
              )}
              onClick={() => onDayClick?.(record || null, date)}
            >
              <CardContent className="p-2">
                <div className="space-y-1">
                  {/* Date number */}
                  <div className="flex items-center justify-between">
                    <span className={cn(
                      "text-sm font-medium",
                      isToday && "text-primary font-bold"
                    )}>
                      {format(date, 'd')}
                    </span>
                    {getStatusBadge(record)}
                  </div>

                  {/* Attendance info */}
                  {record && isCurrentMonth && (
                    <div className="space-y-0.5">
                      {record.clockInTime && (
                        <div className="text-[10px] text-muted-foreground">
                          In: {formatTime(record.clockInTime)}
                        </div>
                      )}
                      {record.clockOutTime && (
                        <div className="text-[10px] text-muted-foreground">
                          Out: {formatTime(record.clockOutTime)}
                        </div>
                      )}
                      {record.total_hours !== null && (
                        <div className="text-[10px] font-medium">
                          {record.total_hours.toFixed(1)}h
                        </div>
                      )}
                    </div>
                  )}

                  {/* Non-working day indicator */}
                  {record && !record.isWorkingDay && isCurrentMonth && (
                    <div className="text-[10px] text-muted-foreground text-center mt-1">
                      Off
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Legend */}
      <div className="mt-6 flex flex-wrap gap-4 justify-center">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-green-100 dark:bg-green-950/40 border" />
          <span className="text-sm text-muted-foreground">Present</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-yellow-100 dark:bg-yellow-950/40 border" />
          <span className="text-sm text-muted-foreground">Late/Early</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-red-100 dark:bg-red-950/40 border" />
          <span className="text-sm text-muted-foreground">Absent</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-blue-100 dark:bg-blue-950/40 border" />
          <span className="text-sm text-muted-foreground">Leave</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-muted/50 border" />
          <span className="text-sm text-muted-foreground">Non-Working</span>
        </div>
      </div>
    </div>
  );
};
