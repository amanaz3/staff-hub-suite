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
  );
}
