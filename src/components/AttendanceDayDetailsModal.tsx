import { format } from 'date-fns';
import { Clock, Calendar, AlertCircle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { DayStatus } from '@/hooks/useAttendanceCalendar';

interface AttendanceDayDetailsModalProps {
  open: boolean;
  onClose: () => void;
  date: Date;
  dayStatus: DayStatus;
}

export function AttendanceDayDetailsModal({
  open,
  onClose,
  date,
  dayStatus,
}: AttendanceDayDetailsModalProps) {
  const getStatusBadge = () => {
    switch (dayStatus.status) {
      case 'present':
        return <Badge className="bg-green-100 text-green-800 hover:bg-green-200">✅ Present</Badge>;
      case 'late':
        return <Badge className="bg-orange-100 text-orange-800 hover:bg-orange-200">🕒 Late</Badge>;
      case 'absent':
        return <Badge className="bg-red-100 text-red-800 hover:bg-red-200">❌ Absent</Badge>;
      default:
        return null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            {format(date, 'EEEE, MMMM d, yyyy')}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Status:</span>
            {getStatusBadge()}
          </div>

          {dayStatus.status === 'absent' ? (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-red-800 text-sm">
                No attendance record found for this date.
              </p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <div className="text-sm text-muted-foreground">Clock In</div>
                  <div className="flex items-center gap-2 font-medium">
                    <Clock className="h-4 w-4" />
                    {dayStatus.clockInTime
                      ? format(new Date(dayStatus.clockInTime), 'hh:mm a')
                      : '-'}
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="text-sm text-muted-foreground">Clock Out</div>
                  <div className="flex items-center gap-2 font-medium">
                    <Clock className="h-4 w-4" />
                    {dayStatus.clockOutTime
                      ? format(new Date(dayStatus.clockOutTime), 'hh:mm a')
                      : '-'}
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <div className="text-sm text-muted-foreground">Total Hours</div>
                <div className="text-2xl font-bold">
                  {dayStatus.totalHours ? dayStatus.totalHours.toFixed(2) : '-'} hrs
                </div>
              </div>

              {dayStatus.isLate && dayStatus.minutesLate && (
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-orange-600 mt-0.5" />
                  <div>
                    <p className="font-medium text-orange-800">Late Arrival</p>
                    <p className="text-sm text-orange-700">
                      Arrived {dayStatus.minutesLate} minute{dayStatus.minutesLate !== 1 ? 's' : ''} late
                    </p>
                  </div>
                </div>
              )}

              {dayStatus.notes && (
                <div className="space-y-1">
                  <div className="text-sm text-muted-foreground">Notes</div>
                  <p className="text-sm bg-muted p-3 rounded-lg">{dayStatus.notes}</p>
                </div>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
