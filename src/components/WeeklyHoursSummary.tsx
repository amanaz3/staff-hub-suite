import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Clock } from 'lucide-react';
import { format, startOfWeek, endOfWeek, isWithinInterval, parseISO } from 'date-fns';

interface AttendanceRecord {
  date: string;
  total_hours?: number;
  status: string;
}

interface WeeklyHoursSummaryProps {
  attendanceData: AttendanceRecord[];
  month: Date;
}

interface WeekSummary {
  weekStart: Date;
  weekEnd: Date;
  totalHours: number;
  daysWorked: number;
}

export function WeeklyHoursSummary({ attendanceData, month }: WeeklyHoursSummaryProps) {
  const weeklySummaries = useMemo(() => {
    // Get all weeks in the month
    const monthStart = new Date(month.getFullYear(), month.getMonth(), 1);
    const monthEnd = new Date(month.getFullYear(), month.getMonth() + 1, 0);
    
    const weeks: WeekSummary[] = [];
    let currentDate = startOfWeek(monthStart, { weekStartsOn: 1 }); // Start from Monday
    
    while (currentDate <= monthEnd) {
      const weekStart = currentDate;
      const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });
      
      // Filter attendance records for this week
      const weekRecords = attendanceData.filter(record => {
        const recordDate = parseISO(record.date);
        return isWithinInterval(recordDate, { start: weekStart, end: weekEnd }) &&
               record.status === 'present' &&
               record.total_hours !== undefined;
      });
      
      const totalHours = weekRecords.reduce((sum, record) => sum + (record.total_hours || 0), 0);
      const daysWorked = weekRecords.length;
      
      weeks.push({
        weekStart,
        weekEnd,
        totalHours,
        daysWorked,
      });
      
      // Move to next week
      currentDate = new Date(weekEnd);
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    return weeks;
  }, [attendanceData, month]);

  const monthTotal = weeklySummaries.reduce((sum, week) => sum + week.totalHours, 0);
  const totalDaysWorked = weeklySummaries.reduce((sum, week) => sum + week.daysWorked, 0);

  return (
    <Card className="mb-4">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Clock className="h-5 w-5" />
          Weekly Hours Summary
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {weeklySummaries.map((week, index) => (
            <div
              key={index}
              className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
            >
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">
                  Week {index + 1}
                </p>
                <p className="text-xs text-muted-foreground">
                  {format(week.weekStart, 'MMM d')} - {format(week.weekEnd, 'MMM d, yyyy')}
                </p>
              </div>
              <div className="text-right">
                <p className="text-lg font-bold text-foreground">
                  {week.totalHours.toFixed(1)} Hrs
                </p>
                <p className="text-xs text-muted-foreground">
                  {week.daysWorked} {week.daysWorked === 1 ? 'day' : 'days'}
                </p>
              </div>
            </div>
          ))}
          
          {weeklySummaries.length > 0 && (
            <div className="flex items-center justify-between p-4 rounded-lg bg-primary/10 border-2 border-primary/20 mt-4">
              <div>
                <p className="text-sm font-semibold text-foreground">
                  Monthly Total
                </p>
                <p className="text-xs text-muted-foreground">
                  {totalDaysWorked} working {totalDaysWorked === 1 ? 'day' : 'days'}
                </p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-primary">
                  {monthTotal.toFixed(1)} Hrs
                </p>
                <p className="text-xs text-muted-foreground">
                  Avg: {totalDaysWorked > 0 ? (monthTotal / totalDaysWorked).toFixed(1) : '0'} hrs/day
                </p>
              </div>
            </div>
          )}
          
          {weeklySummaries.length === 0 && (
            <p className="text-center text-sm text-muted-foreground py-4">
              No attendance data available for this month
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
