import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { formatInGST } from '@/lib/timezone';
import { Calendar, Clock, AlertCircle, CheckCircle } from 'lucide-react';

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
  expectedClockIn: Date;
  expectedClockOut: Date;
}

interface AttendanceDayModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  record: AttendanceRecord | null;
  date: Date;
}

export const AttendanceDayModal = ({ 
  open, 
  onOpenChange, 
  record,
  date 
}: AttendanceDayModalProps) => {
  
  const formatTime = (time: Date | null) => {
    if (!time) return 'Not recorded';
    return formatInGST(time, 'HH:mm:ss');
  };

  const formatMinutes = (minutes: number) => {
    if (minutes === 0) return 'On time';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) return `${hours} Hrs ${mins} Mins`;
    return `${mins} Mins`;
  };

  const formatTotalHours = (decimalHours: number) => {
    if (!decimalHours) return '0 Hrs';
    const hours = Math.floor(decimalHours);
    const mins = Math.round((decimalHours - hours) * 60);
    if (hours > 0 && mins > 0) return `${hours} Hrs ${mins} Mins`;
    if (hours > 0) return `${hours} Hrs`;
    return `${mins} Mins`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            {format(date, 'EEEE, MMMM d, yyyy')}
          </DialogTitle>
        </DialogHeader>

        {!record ? (
          <div className="py-8 text-center text-muted-foreground">
            <AlertCircle className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>No attendance record for this day</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Status */}
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Status</span>
              <div className="flex gap-2">
                {record.leaveType && (
                  <Badge variant="secondary" className="bg-blue-100 dark:bg-blue-900">
                    {record.leaveType}
                  </Badge>
                )}
                {record.is_wfh && (
                  <Badge variant="secondary">Work From Home</Badge>
                )}
                <Badge variant={
                  record.status === 'present' ? 'default' :
                  record.status === 'absent' ? 'destructive' :
                  'secondary'
                }>
                  {record.status.toUpperCase()}
                </Badge>
              </div>
            </div>

            {/* Day Type */}
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Day Type</span>
              <span className="text-sm text-muted-foreground">
                {record.isWorkingDay ? record.dayOfWeek : `${record.dayOfWeek} (Non-Working)`}
              </span>
            </div>

            {record.isWorkingDay && record.status !== 'absent' && (
              <>
                {/* Clock In */}
                <div className="space-y-2 p-3 rounded-lg bg-muted/50">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Clock className="h-4 w-4" />
                    Clock In
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <div className="text-muted-foreground">Expected</div>
                      <div className="font-medium">
                        {format(record.expectedClockIn, 'HH:mm:ss')}
                      </div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Actual</div>
                      <div className={`font-medium ${record.lateMinutes > 0 ? 'text-yellow-600 dark:text-yellow-400' : ''}`}>
                        {formatTime(record.clockInTime)}
                      </div>
                    </div>
                  </div>
                  {record.lateMinutes > 0 && (
                    <div className="flex items-center gap-1 text-xs text-yellow-600 dark:text-yellow-400">
                      <AlertCircle className="h-3 w-3" />
                      Late by {formatMinutes(record.lateMinutes)}
                    </div>
                  )}
                  {record.lateMinutes === 0 && record.clockInTime && (
                    <div className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                      <CheckCircle className="h-3 w-3" />
                      On time
                    </div>
                  )}
                </div>

                {/* Clock Out */}
                <div className="space-y-2 p-3 rounded-lg bg-muted/50">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Clock className="h-4 w-4" />
                    Clock Out
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <div className="text-muted-foreground">Expected</div>
                      <div className="font-medium">
                        {format(record.expectedClockOut, 'HH:mm:ss')}
                      </div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Actual</div>
                      <div className={`font-medium ${record.earlyMinutes > 0 ? 'text-orange-600 dark:text-orange-400' : ''}`}>
                        {formatTime(record.clockOutTime)}
                      </div>
                    </div>
                  </div>
                  {record.earlyMinutes > 0 && (
                    <div className="flex items-center gap-1 text-xs text-orange-600 dark:text-orange-400">
                      <AlertCircle className="h-3 w-3" />
                      Left {formatMinutes(record.earlyMinutes)} early
                    </div>
                  )}
                  {record.earlyMinutes === 0 && record.clockOutTime && (
                    <div className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                      <CheckCircle className="h-3 w-3" />
                      Completed full day
                    </div>
                  )}
                </div>

                {/* Total Hours */}
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Total Hours Worked</span>
                  <span className="text-lg font-bold">
                    {record.total_hours ? formatTotalHours(record.total_hours) : '0 Hrs'}
                  </span>
                </div>
              </>
            )}

            {/* Notes */}
            {record.notes && (
              <div className="space-y-1">
                <span className="text-sm font-medium">Notes</span>
                <p className="text-sm text-muted-foreground p-2 rounded-lg bg-muted/50">
                  {record.notes}
                </p>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
