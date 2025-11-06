import { useState } from 'react';
import { Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AttendanceCalendarDialog } from './AttendanceCalendarDialog';

interface AttendanceCalendarButtonProps {
  employeeId: string;
  employeeName: string;
}

export function AttendanceCalendarButton({ employeeId, employeeName }: AttendanceCalendarButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setOpen(true)}
        className="relative"
        title="View Attendance Calendar"
      >
        <Calendar className="h-5 w-5" />
      </Button>

      <AttendanceCalendarDialog
        open={open}
        onClose={() => setOpen(false)}
        employeeId={employeeId}
        employeeName={employeeName}
      />
    </>
  );
}
