import { format } from "date-fns";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { DayStatus } from "./AttendanceCalendarPopup";
import { Clock, CheckCircle, AlertCircle, XCircle, Calendar } from "lucide-react";

interface AttendanceDayCellProps {
  date: Date;
  displayMonth: Date;
  dayStatusMap: Map<string, DayStatus>;
}

export function AttendanceDayCell({ date, displayMonth, dayStatusMap, ...props }: AttendanceDayCellProps & React.HTMLAttributes<HTMLButtonElement>) {
  const dateStr = format(date, "yyyy-MM-dd");
  const dayStatus = dayStatusMap.get(dateStr);

  if (!dayStatus || dayStatus.status === "future" || dayStatus.status === "non-working") {
    return (
      <button {...props} className="day-cell">
        {format(date, "d")}
      </button>
    );
  }

  const getStatusIcon = () => {
    switch (dayStatus.status) {
      case "ok":
        return <CheckCircle className="h-3 w-3" />;
      case "pending-exception":
        return <Clock className="h-3 w-3" />;
      case "issues-no-exception":
      case "absent":
        return <XCircle className="h-3 w-3" />;
      case "leave":
        return <Calendar className="h-3 w-3" />;
      default:
        return null;
    }
  };

  const getStatusText = () => {
    switch (dayStatus.status) {
      case "ok":
        return "All OK";
      case "pending-exception":
        return "Pending Approval";
      case "issues-no-exception":
        return "Action Required";
      case "absent":
        return "Absent";
      case "leave":
        return "On Leave";
      default:
        return "";
    }
  };

  const formatTime = (timestamp: string | undefined) => {
    if (!timestamp) return "N/A";
    try {
      const date = new Date(timestamp);
      return format(date, "h:mm a");
    } catch {
      return "N/A";
    }
  };

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button {...props} className="day-cell relative">
            {format(date, "d")}
            <span className="absolute bottom-0 right-0 mb-0.5 mr-0.5">
              {getStatusIcon()}
            </span>
          </button>
        </TooltipTrigger>

        <TooltipContent side="right" className="max-w-xs">
          <div className="space-y-2">
            <div className="font-semibold text-foreground">
              {format(date, "EEEE, MMMM d, yyyy")}
            </div>

            <div className="flex items-center gap-2 text-sm">
              {getStatusIcon()}
              <span className="font-medium">{getStatusText()}</span>
            </div>

            {dayStatus.status === "leave" && dayStatus.details?.leaveType && (
              <div className="text-sm text-muted-foreground">
                <div>Type: <span className="text-foreground">{dayStatus.details.leaveType}</span></div>
              </div>
            )}

            {dayStatus.status === "ok" && dayStatus.details && (
              <div className="text-sm space-y-1">
                <div className="text-muted-foreground">
                  Clock In: <span className="text-foreground">{formatTime(dayStatus.details.clockInTime)}</span>
                </div>
                <div className="text-muted-foreground">
                  Clock Out: <span className="text-foreground">{formatTime(dayStatus.details.clockOutTime)}</span>
                </div>
                {dayStatus.details.totalHours && (
                  <div className="text-muted-foreground">
                    Hours: <span className="text-foreground">{dayStatus.details.totalHours.toFixed(2)}</span>
                  </div>
                )}
                {dayStatus.details.isWfh && (
                  <div className="text-xs text-primary mt-1">🏠 Work from Home</div>
                )}
              </div>
            )}

            {(dayStatus.status === "pending-exception" || dayStatus.status === "issues-no-exception") && 
             dayStatus.details?.issues && (
              <div className="text-sm space-y-1">
                {dayStatus.details.clockInTime && (
                  <div className="text-muted-foreground">
                    Clock In: <span className="text-foreground">{formatTime(dayStatus.details.clockInTime)}</span>
                  </div>
                )}
                {dayStatus.details.clockOutTime && (
                  <div className="text-muted-foreground">
                    Clock Out: <span className="text-foreground">{formatTime(dayStatus.details.clockOutTime)}</span>
                  </div>
                )}
                <div className="mt-2">
                  <div className="text-muted-foreground font-medium mb-1">Issues:</div>
                  <ul className="list-disc list-inside ml-2 space-y-0.5">
                    {dayStatus.details.issues.map((issue, i) => (
                      <li key={i} className="text-foreground text-xs">{issue}</li>
                    ))}
                  </ul>
                </div>
                {dayStatus.details.exceptionsCount !== undefined && (
                  <div className="mt-1 text-xs">
                    {dayStatus.status === "pending-exception" ? (
                      <span className="text-warning">⏳ {dayStatus.details.exceptionsCount} exception(s) submitted</span>
                    ) : (
                      <span className="text-destructive">⚠ No exceptions submitted</span>
                    )}
                  </div>
                )}
              </div>
            )}

            {dayStatus.status === "absent" && (
              <div className="text-sm text-destructive">
                No attendance record for this day
                {dayStatus.details?.exceptionsCount ? (
                  <div className="text-xs text-warning mt-1">⏳ Exception submitted</div>
                ) : (
                  <div className="text-xs mt-1">⚠ Please submit an exception</div>
                )}
              </div>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
