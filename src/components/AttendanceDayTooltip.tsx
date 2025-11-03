import { format } from "date-fns";
import { Clock, CheckCircle, XCircle, Calendar } from "lucide-react";
import { DayStatus } from "./AttendanceCalendarPopup";

interface AttendanceDayTooltipProps {
  dayStatus: DayStatus;
  date: Date;
}

export function AttendanceDayTooltip({ dayStatus, date }: AttendanceDayTooltipProps) {
  const getStatusIcon = () => {
    switch (dayStatus.status) {
      case "ok":
        return <CheckCircle className="h-4 w-4 text-success" />;
      case "pending-exception":
        return <Clock className="h-4 w-4 text-warning" />;
      case "issues-no-exception":
      case "absent":
        return <XCircle className="h-4 w-4 text-destructive" />;
      case "leave":
        return <Calendar className="h-4 w-4 text-muted-foreground" />;
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
      const dateObj = new Date(timestamp);
      return format(dateObj, "h:mm a");
    } catch {
      return "N/A";
    }
  };

  return (
    <div className="space-y-3 min-w-[240px]">
      {/* Header */}
      <div>
        <div className="font-semibold text-foreground text-sm">
          {format(date, "EEEE, MMM d, yyyy")}
        </div>
        <div className="flex items-center gap-2 mt-1.5">
          {getStatusIcon()}
          <span className="font-medium text-sm">{getStatusText()}</span>
        </div>
      </div>

      {/* Leave Details */}
      {dayStatus.status === "leave" && dayStatus.details?.leaveType && (
        <div className="pt-2 border-t border-border">
          <div className="text-xs text-muted-foreground">Leave Type</div>
          <div className="text-sm font-medium text-foreground mt-0.5">
            {dayStatus.details.leaveType}
          </div>
        </div>
      )}

      {/* OK Status Details */}
      {dayStatus.status === "ok" && dayStatus.details && (
        <div className="pt-2 border-t border-border space-y-1.5 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Clock In:</span>
            <span className="font-medium text-foreground">{formatTime(dayStatus.details.clockInTime)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Clock Out:</span>
            <span className="font-medium text-foreground">{formatTime(dayStatus.details.clockOutTime)}</span>
          </div>
          {dayStatus.details.totalHours && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total Hours:</span>
              <span className="font-medium text-foreground">{dayStatus.details.totalHours.toFixed(2)}h</span>
            </div>
          )}
          {dayStatus.details.isWfh && (
            <div className="mt-2 px-2 py-1 rounded bg-primary/10 text-primary text-xs font-medium">
              🏠 Work from Home
            </div>
          )}
        </div>
      )}

      {/* Issue Details */}
      {(dayStatus.status === "pending-exception" || dayStatus.status === "issues-no-exception") && 
       dayStatus.details?.issues && (
        <div className="pt-2 border-t border-border space-y-2">
          {(dayStatus.details.clockInTime || dayStatus.details.clockOutTime) && (
            <div className="space-y-1.5 text-sm">
              {dayStatus.details.clockInTime && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Clock In:</span>
                  <span className="font-medium text-foreground">{formatTime(dayStatus.details.clockInTime)}</span>
                </div>
              )}
              {dayStatus.details.clockOutTime && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Clock Out:</span>
                  <span className="font-medium text-foreground">{formatTime(dayStatus.details.clockOutTime)}</span>
                </div>
              )}
            </div>
          )}
          
          <div>
            <div className="text-xs font-semibold text-destructive mb-1.5">Issues Detected:</div>
            <ul className="space-y-1">
              {dayStatus.details.issues.map((issue, i) => (
                <li key={i} className="text-xs text-foreground flex items-start gap-1.5">
                  <span className="text-destructive mt-0.5">•</span>
                  <span>{issue}</span>
                </li>
              ))}
            </ul>
          </div>
          
          {dayStatus.details.exceptionsCount !== undefined && (
            <div className="mt-2 px-2 py-1.5 rounded text-xs font-medium" 
                 style={{
                   backgroundColor: dayStatus.status === "pending-exception" 
                     ? "hsl(var(--warning-light))" 
                     : "hsl(var(--destructive-light))",
                   color: dayStatus.status === "pending-exception"
                     ? "hsl(var(--warning))"
                     : "hsl(var(--destructive))"
                 }}>
              {dayStatus.status === "pending-exception" ? (
                <>⏳ {dayStatus.details.exceptionsCount} exception(s) pending review</>
              ) : (
                <>⚠ No exceptions submitted - action required</>
              )}
            </div>
          )}
        </div>
      )}

      {/* Absent Details */}
      {dayStatus.status === "absent" && (
        <div className="pt-2 border-t border-border">
          <div className="text-sm text-destructive font-medium mb-2">
            No attendance record found
          </div>
          {dayStatus.details?.exceptionsCount ? (
            <div className="px-2 py-1.5 rounded text-xs font-medium"
                 style={{
                   backgroundColor: "hsl(var(--warning-light))",
                   color: "hsl(var(--warning))"
                 }}>
              ⏳ Exception submitted and pending review
            </div>
          ) : (
            <div className="px-2 py-1.5 rounded text-xs font-medium"
                 style={{
                   backgroundColor: "hsl(var(--destructive-light))",
                   color: "hsl(var(--destructive))"
                 }}>
              ⚠ Please submit an exception request
            </div>
          )}
        </div>
      )}
    </div>
  );
}
