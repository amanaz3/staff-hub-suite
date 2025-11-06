import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { startOfMonth, endOfMonth, format, eachDayOfInterval, isAfter, isBefore, parseISO } from 'date-fns';

export interface DayStatus {
  date: string;
  status: 'present' | 'late' | 'absent' | 'future' | 'non-working';
  clockInTime: string | null;
  clockOutTime: string | null;
  totalHours: number | null;
  isLate: boolean;
  minutesLate?: number;
  notes?: string;
}

export interface BreachInfo {
  type: 'consecutive' | 'monthly';
  count: number;
  dates: string[];
  message: string;
}

export interface AttendanceCalendarData {
  days: Map<string, DayStatus>;
  summary: {
    totalPresents: number;
    totalAbsents: number;
    totalLates: number;
    breaches: BreachInfo[];
  };
  loading: boolean;
  error: string | null;
}

export function useAttendanceCalendar(employeeId: string | undefined, selectedMonth: Date) {
  const [data, setData] = useState<AttendanceCalendarData>({
    days: new Map(),
    summary: {
      totalPresents: 0,
      totalAbsents: 0,
      totalLates: 0,
      breaches: [],
    },
    loading: true,
    error: null,
  });

  useEffect(() => {
    if (!employeeId) return;

    async function fetchAttendanceData() {
      try {
        setData(prev => ({ ...prev, loading: true, error: null }));

        // Fetch work schedule
        const { data: schedule, error: scheduleError } = await supabase
          .from('work_schedules')
          .select('*')
          .eq('employee_id', employeeId)
          .eq('is_active', true)
          .maybeSingle();

        if (scheduleError) throw scheduleError;

        // Fetch attendance for the month
        const monthStart = startOfMonth(selectedMonth);
        const monthEnd = endOfMonth(selectedMonth);
        
        const { data: attendance, error: attendanceError } = await supabase
          .from('attendance')
          .select('*')
          .eq('employee_id', employeeId)
          .gte('date', format(monthStart, 'yyyy-MM-dd'))
          .lte('date', format(monthEnd, 'yyyy-MM-dd'))
          .order('date', { ascending: true });

        if (attendanceError) throw attendanceError;

        // Build attendance map
        const attendanceMap = new Map<string, any>();
        attendance?.forEach(record => {
          attendanceMap.set(record.date, record);
        });

        // Process each day of the month
        const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });
        const dayStatusMap = new Map<string, DayStatus>();
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        for (const day of daysInMonth) {
          const dateStr = format(day, 'yyyy-MM-dd');
          const dayDate = new Date(day);
          dayDate.setHours(0, 0, 0, 0);
          
          // Check if future date
          if (isAfter(dayDate, today)) {
            dayStatusMap.set(dateStr, {
              date: dateStr,
              status: 'future',
              clockInTime: null,
              clockOutTime: null,
              totalHours: null,
              isLate: false,
            });
            continue;
          }

          // Check if working day
          const dayName = format(day, 'EEEE');
          const isWorkingDay = schedule?.working_days?.includes(dayName) ?? true;

          if (!isWorkingDay) {
            dayStatusMap.set(dateStr, {
              date: dateStr,
              status: 'non-working',
              clockInTime: null,
              clockOutTime: null,
              totalHours: null,
              isLate: false,
            });
            continue;
          }

          const attendanceRecord = attendanceMap.get(dateStr);

          if (!attendanceRecord || !attendanceRecord.clock_in_time) {
            // Absent
            dayStatusMap.set(dateStr, {
              date: dateStr,
              status: 'absent',
              clockInTime: null,
              clockOutTime: null,
              totalHours: null,
              isLate: false,
            });
            continue;
          }

          // Check if late
          const clockInTime = new Date(attendanceRecord.clock_in_time);
          let isLate = false;
          let minutesLate = 0;

          if (schedule?.start_time) {
            const [hours, minutes] = schedule.start_time.split(':');
            const scheduledTime = new Date(clockInTime);
            scheduledTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);
            
            // Add 15-minute grace period
            scheduledTime.setMinutes(scheduledTime.getMinutes() + 15);
            
            if (clockInTime > scheduledTime) {
              isLate = true;
              minutesLate = Math.floor((clockInTime.getTime() - scheduledTime.getTime()) / 60000);
            }
          }

          dayStatusMap.set(dateStr, {
            date: dateStr,
            status: isLate ? 'late' : 'present',
            clockInTime: attendanceRecord.clock_in_time,
            clockOutTime: attendanceRecord.clock_out_time,
            totalHours: attendanceRecord.total_hours,
            isLate,
            minutesLate: isLate ? minutesLate : undefined,
            notes: attendanceRecord.notes,
          });
        }

        // Calculate summary and detect breaches
        const breaches = detectBreaches(dayStatusMap);
        const summary = calculateSummary(dayStatusMap, breaches);

        setData({
          days: dayStatusMap,
          summary,
          loading: false,
          error: null,
        });
      } catch (error) {
        console.error('Error fetching attendance data:', error);
        setData(prev => ({
          ...prev,
          loading: false,
          error: error instanceof Error ? error.message : 'Failed to load attendance data',
        }));
      }
    }

    fetchAttendanceData();
  }, [employeeId, selectedMonth]);

  return data;
}

function detectBreaches(dayStatusMap: Map<string, DayStatus>): BreachInfo[] {
  const breaches: BreachInfo[] = [];
  const sortedDates = Array.from(dayStatusMap.keys()).sort();
  
  // Check consecutive absences
  let consecutiveAbsences: string[] = [];
  for (const date of sortedDates) {
    const day = dayStatusMap.get(date);
    if (day?.status === 'absent') {
      consecutiveAbsences.push(date);
    } else if (consecutiveAbsences.length >= 3) {
      breaches.push({
        type: 'consecutive',
        count: consecutiveAbsences.length,
        dates: [...consecutiveAbsences],
        message: `${consecutiveAbsences.length} consecutive absences detected (${format(parseISO(consecutiveAbsences[0]), 'MMM dd')} - ${format(parseISO(consecutiveAbsences[consecutiveAbsences.length - 1]), 'MMM dd')})`,
      });
      consecutiveAbsences = [];
    } else {
      consecutiveAbsences = [];
    }
  }
  
  // Check last sequence
  if (consecutiveAbsences.length >= 3) {
    breaches.push({
      type: 'consecutive',
      count: consecutiveAbsences.length,
      dates: [...consecutiveAbsences],
      message: `${consecutiveAbsences.length} consecutive absences detected (${format(parseISO(consecutiveAbsences[0]), 'MMM dd')} - ${format(parseISO(consecutiveAbsences[consecutiveAbsences.length - 1]), 'MMM dd')})`,
    });
  }
  
  // Check total monthly absences
  const totalAbsences = sortedDates.filter(
    date => dayStatusMap.get(date)?.status === 'absent'
  );
  
  if (totalAbsences.length > 5) {
    breaches.push({
      type: 'monthly',
      count: totalAbsences.length,
      dates: totalAbsences,
      message: `Total of ${totalAbsences.length} absences this month (exceeds 5-day threshold)`,
    });
  }
  
  return breaches;
}

function calculateSummary(dayStatusMap: Map<string, DayStatus>, breaches: BreachInfo[]) {
  let totalPresents = 0;
  let totalAbsents = 0;
  let totalLates = 0;

  for (const day of dayStatusMap.values()) {
    if (day.status === 'present') totalPresents++;
    if (day.status === 'late') {
      totalPresents++;
      totalLates++;
    }
    if (day.status === 'absent') totalAbsents++;
  }

  return {
    totalPresents,
    totalAbsents,
    totalLates,
    breaches,
  };
}
