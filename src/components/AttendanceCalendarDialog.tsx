import { useState } from 'react';
import { format, addMonths, subMonths } from 'date-fns';
import { ChevronLeft, ChevronRight, AlertTriangle, Download } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AttendanceCalendarView } from './AttendanceCalendarView';
import { AttendanceDayDetailsModal } from './AttendanceDayDetailsModal';
import { useAttendanceCalendar, DayStatus } from '@/hooks/useAttendanceCalendar';
import { exportToCSV, exportToPDF } from './AttendanceExport';

interface AttendanceCalendarDialogProps {
  open: boolean;
  onClose: () => void;
  employeeId: string;
  employeeName: string;
}

export function AttendanceCalendarDialog({
  open,
  onClose,
  employeeId,
  employeeName,
}: AttendanceCalendarDialogProps) {
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<{ date: Date; status: DayStatus } | null>(null);
  
  const { days, summary, loading, error } = useAttendanceCalendar(employeeId, selectedMonth);

  const handlePreviousMonth = () => {
    setSelectedMonth(prev => subMonths(prev, 1));
  };

  const handleNextMonth = () => {
    setSelectedMonth(prev => addMonths(prev, 1));
  };

  const handleDayClick = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    const dayStatus = days.get(dateStr);
    if (dayStatus && dayStatus.status !== 'future' && dayStatus.status !== 'non-working') {
      setSelectedDay({ date, status: dayStatus });
    }
  };

  const handleExportCSV = () => {
    exportToCSV({ days, summary, loading, error }, selectedMonth, employeeName);
  };

  const handleExportPDF = () => {
    exportToPDF({ days, summary, loading, error }, selectedMonth, employeeName);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="max-w-[720px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl">Attendance Calendar</DialogTitle>
          </DialogHeader>

          {/* Summary Panel */}
          <div className="summary-panel">
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div className="text-center">
                <div className="text-3xl font-bold text-green-600">{summary.totalPresents}</div>
                <div className="text-sm text-muted-foreground">Total Presents</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-red-600">{summary.totalAbsents}</div>
                <div className="text-sm text-muted-foreground">Total Absents</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-orange-600">{summary.totalLates}</div>
                <div className="text-sm text-muted-foreground">Total Lates</div>
              </div>
            </div>
          </div>

          {/* Breach Warnings */}
          {summary.breaches.length > 0 && (
            <Alert variant="destructive" className="breach-warning">
              <AlertTriangle className="h-5 w-5" />
              <AlertDescription>
                <div className="font-semibold mb-2">
                  {summary.breaches.length} {summary.breaches.length === 1 ? 'Breach' : 'Breaches'} Detected
                </div>
                <ul className="list-disc list-inside space-y-1 text-sm">
                  {summary.breaches.map((breach, index) => (
                    <li key={index}>{breach.message}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          {/* Calendar Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={handlePreviousMonth}
                disabled={loading}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <h3 className="text-xl font-semibold min-w-[200px] text-center">
                {format(selectedMonth, 'MMMM yyyy')}
              </h3>
              <Button
                variant="outline"
                size="icon"
                onClick={handleNextMonth}
                disabled={loading}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" disabled={loading}>
                  <Download className="h-4 w-4 mr-2" />
                  Export
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={handleExportCSV}>
                  Export as CSV
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleExportPDF}>
                  Export as PDF
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Calendar View */}
          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : (
            <AttendanceCalendarView
              selectedMonth={selectedMonth}
              days={days}
              loading={loading}
              onDayClick={handleDayClick}
            />
          )}

          {/* Legend */}
          <div className="flex flex-wrap gap-4 justify-center pt-4 border-t text-sm">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-green-100 border-2 border-green-300"></div>
              <span>✅ Present</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-orange-100 border-2 border-orange-300"></div>
              <span>🕒 Late</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-red-100 border-2 border-red-300"></div>
              <span>❌ Absent</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-gray-50 border-2 border-gray-200"></div>
              <span>⚪ Future</span>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Day Details Modal */}
      {selectedDay && (
        <AttendanceDayDetailsModal
          open={!!selectedDay}
          onClose={() => setSelectedDay(null)}
          date={selectedDay.date}
          dayStatus={selectedDay.status}
        />
      )}
    </>
  );
}
