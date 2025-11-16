import { DayPicker } from 'react-day-picker';
import { format, parseISO } from 'date-fns';
import { DayStatus } from '@/hooks/useAttendanceCalendar';
import { Skeleton } from '@/components/ui/skeleton';

interface AttendanceCalendarViewProps {
  selectedMonth: Date;
  days: Map<string, DayStatus>;
  loading: boolean;
  onDayClick: (date: Date) => void;
}

export function AttendanceCalendarView({
  selectedMonth,
  days,
  loading,
  onDayClick,
}: AttendanceCalendarViewProps) {
  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-[400px] w-full" />
      </div>
    );
  }

  // Build modifiers for each status
  const presentDays: Date[] = [];
  const lateDays: Date[] = [];
  const absentDays: Date[] = [];
  const futureDays: Date[] = [];
  const nonWorkingDays: Date[] = [];

  days.forEach((dayStatus, dateStr) => {
    const date = parseISO(dateStr);
    switch (dayStatus.status) {
      case 'present':
        presentDays.push(date);
        break;
      case 'late':
        lateDays.push(date);
        break;
      case 'absent':
        absentDays.push(date);
        break;
      case 'future':
        futureDays.push(date);
        break;
      case 'non-working':
        nonWorkingDays.push(date);
        break;
    }
  });

  return (
    <div className="space-y-4">
      {/* Legend */}
      <div className="flex flex-wrap items-center justify-center gap-4 p-4 bg-muted/50 rounded-lg border border-border">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded bg-green-100 border-2 border-green-300 flex items-center justify-center text-xs">✅</div>
          <span className="text-sm font-medium text-foreground">Present</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded bg-orange-100 border-2 border-orange-300 flex items-center justify-center text-xs">🕒</div>
          <span className="text-sm font-medium text-foreground">Late</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded bg-red-100 border-2 border-red-300 flex items-center justify-center text-xs">❌</div>
          <span className="text-sm font-medium text-foreground">Absent</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded bg-gray-100 border-2 border-gray-200 flex items-center justify-center text-xs">🏖️</div>
          <span className="text-sm font-medium text-foreground">Weekend</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded bg-gray-50 flex items-center justify-center text-xs opacity-60">⚪</div>
          <span className="text-sm font-medium text-muted-foreground">Future</span>
        </div>
      </div>

      {/* Calendar */}
      <div className="attendance-calendar flex justify-center">
        <DayPicker
          mode="default"
          month={selectedMonth}
          modifiers={{
            present: presentDays,
            late: lateDays,
            absent: absentDays,
            future: futureDays,
            nonWorking: nonWorkingDays,
          }}
          modifiersClassNames={{
            present: 'present',
            late: 'late',
            absent: 'absent',
            future: 'future',
            nonWorking: 'non-working',
          }}
          onDayClick={onDayClick}
          disabled={(date) => {
            const dateStr = format(date, 'yyyy-MM-dd');
            const dayStatus = days.get(dateStr);
            return !dayStatus || dayStatus.status === 'future' || dayStatus.status === 'non-working';
          }}
          className="pointer-events-auto"
        />
      </div>
    </div>
  );
}
