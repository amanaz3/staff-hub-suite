import { useState, useEffect, useMemo } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DayPicker } from "react-day-picker";
import { format, subMonths, addMonths, startOfMonth, endOfMonth, isAfter, isBefore, isEqual } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { AttendanceDayTooltip } from "./AttendanceDayTooltip";
import { cn } from "@/lib/utils";

interface AttendanceCalendarPopupProps {
  userProfile: any;
  onClose?: () => void;
}

interface AttendanceRecord {
  date: string;
  clock_in_time: string | null;
  clock_out_time: string | null;
  total_hours: number | null;
  status: string;
  is_wfh: boolean;
  notes: string | null;
}

interface LeaveRequest {
  start_date: string;
  end_date: string;
  leave_types: { name: string };
}

interface AttendanceException {
  target_date: string;
  exception_type: string;
  status: string;
}

interface WorkSchedule {
  start_time: string;
  end_time: string;
  minimum_daily_hours: number;
  working_days: string[];
}

export interface DayStatus {
  date: string;
  status: "ok" | "pending-exception" | "issues-no-exception" | "leave" | "future" | "non-working" | "absent";
  details?: {
    clockInTime?: string;
    clockOutTime?: string;
    totalHours?: number;
    issues?: string[];
    leaveType?: string;
    exceptionsCount?: number;
    isWfh?: boolean;
  };
}

export function AttendanceCalendarPopup({ userProfile, onClose }: AttendanceCalendarPopupProps) {
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [attendanceData, setAttendanceData] = useState<AttendanceRecord[]>([]);
  const [leaveData, setLeaveData] = useState<LeaveRequest[]>([]);
  const [exceptionsData, setExceptionsData] = useState<AttendanceException[]>([]);
  const [schedule, setSchedule] = useState<WorkSchedule | null>(null);
  const [loading, setLoading] = useState(true);
  const [employeeId, setEmployeeId] = useState<string | null>(null);

  // Fetch employee ID first
  useEffect(() => {
    const fetchEmployeeId = async () => {
      if (!userProfile?.user_id) return;

      const { data } = await supabase
        .from("employees")
        .select("id")
        .eq("user_id", userProfile.user_id)
        .single();

      if (data) {
        setEmployeeId(data.id);
      }
    };

    fetchEmployeeId();
  }, [userProfile]);

  // Fetch data for selected month
  useEffect(() => {
    const fetchMonthData = async () => {
      if (!employeeId) return;

      setLoading(true);
      try {
        const monthStart = startOfMonth(selectedMonth).toISOString().split("T")[0];
        const monthEnd = endOfMonth(selectedMonth).toISOString().split("T")[0];

        // Fetch attendance
        const { data: attendance } = await supabase
          .from("attendance")
          .select("date, clock_in_time, clock_out_time, total_hours, status, is_wfh, notes")
          .eq("employee_id", employeeId)
          .gte("date", monthStart)
          .lte("date", monthEnd)
          .order("date", { ascending: true });

        // Fetch leaves
        const { data: leaves } = await supabase
          .from("leave_requests")
          .select(`
            start_date,
            end_date,
            leave_types (name)
          `)
          .eq("employee_id", employeeId)
          .eq("status", "approved")
          .or(`start_date.lte.${monthEnd},end_date.gte.${monthStart}`);

        // Fetch exceptions
        const { data: exceptions } = await supabase
          .from("attendance_exceptions")
          .select("target_date, exception_type, status")
          .eq("employee_id", employeeId)
          .gte("target_date", monthStart)
          .lte("target_date", monthEnd)
          .in("status", ["pending", "approved"]);

        // Fetch work schedule
        const { data: workSchedule } = await supabase
          .from("work_schedules")
          .select("start_time, end_time, minimum_daily_hours, working_days")
          .eq("employee_id", employeeId)
          .eq("is_active", true)
          .single();

        setAttendanceData(attendance || []);
        setLeaveData(leaves || []);
        setExceptionsData(exceptions || []);
        setSchedule(workSchedule);
      } catch (error) {
        console.error("Error fetching calendar data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchMonthData();
  }, [selectedMonth, employeeId]);

  // Prepare day status map
  const dayStatusMap = useMemo(() => {
    const map = new Map<string, DayStatus>();

    if (!schedule) return map;

    const monthStart = startOfMonth(selectedMonth);
    const monthEnd = endOfMonth(selectedMonth);
    const today = new Date();

    // Process each day in the month
    for (let day = new Date(monthStart); day <= monthEnd; day.setDate(day.getDate() + 1)) {
      const dateStr = format(day, "yyyy-MM-dd");
      const dayName = format(day, "EEEE");

      // Check if future date
      if (isAfter(day, today)) {
        map.set(dateStr, { date: dateStr, status: "future" });
        continue;
      }

      // Check if non-working day
      if (!schedule.working_days.includes(dayName)) {
        map.set(dateStr, { date: dateStr, status: "non-working" });
        continue;
      }

      // Check if on approved leave
      const onLeave = leaveData.find((leave) => {
        const leaveStart = new Date(leave.start_date);
        const leaveEnd = new Date(leave.end_date);
        return (
          (isAfter(day, leaveStart) || isEqual(day, leaveStart)) &&
          (isBefore(day, leaveEnd) || isEqual(day, leaveEnd))
        );
      });

      if (onLeave) {
        map.set(dateStr, {
          date: dateStr,
          status: "leave",
          details: {
            leaveType: onLeave.leave_types.name,
          },
        });
        continue;
      }

      // Check attendance record
      const attendance = attendanceData.find((att) => att.date === dateStr);

      if (!attendance) {
        // Absent
        const hasException = exceptionsData.some(
          (ex) => ex.target_date === dateStr && ex.status === "pending"
        );

        map.set(dateStr, {
          date: dateStr,
          status: hasException ? "pending-exception" : "absent",
          details: {
            issues: ["No attendance record"],
            exceptionsCount: hasException ? 1 : 0,
          },
        });
        continue;
      }

      // Detect issues
      const issues: string[] = [];

      if (!attendance.clock_in_time) {
        issues.push("Missing clock-in");
      } else {
        const clockInTime = new Date(attendance.clock_in_time).toTimeString().split(" ")[0];
        if (clockInTime > schedule.start_time) {
          issues.push("Late arrival");
        }
      }

      if (!attendance.clock_out_time) {
        issues.push("Missing clock-out");
      } else if (attendance.clock_in_time) {
        const clockOutTime = new Date(attendance.clock_out_time).toTimeString().split(" ")[0];
        if (clockOutTime < schedule.end_time) {
          issues.push("Early departure");
        }
      }

      if (attendance.total_hours && attendance.total_hours < schedule.minimum_daily_hours) {
        issues.push("Incomplete hours");
      }

      // Check exceptions for this date
      const dayExceptions = exceptionsData.filter((ex) => ex.target_date === dateStr);
      const approvedExceptions = dayExceptions.filter((ex) => ex.status === "approved");
      const pendingExceptions = dayExceptions.filter((ex) => ex.status === "pending");

      let status: DayStatus["status"] = "ok";

      if (issues.length === 0) {
        status = "ok";
      } else if (approvedExceptions.length >= issues.length) {
        status = "ok";
      } else if (pendingExceptions.length > 0) {
        status = "pending-exception";
      } else {
        status = "issues-no-exception";
      }

      map.set(dateStr, {
        date: dateStr,
        status,
        details: {
          clockInTime: attendance.clock_in_time || undefined,
          clockOutTime: attendance.clock_out_time || undefined,
          totalHours: attendance.total_hours || undefined,
          issues: issues.length > 0 ? issues : undefined,
          exceptionsCount: dayExceptions.length,
          isWfh: attendance.is_wfh,
        },
      });
    }

    return map;
  }, [attendanceData, leaveData, exceptionsData, schedule, selectedMonth]);

  // Prepare modifiers for DayPicker
  const modifiers = useMemo(() => {
    const ok: Date[] = [];
    const pendingException: Date[] = [];
    const issuesNoException: Date[] = [];
    const leave: Date[] = [];

    dayStatusMap.forEach((status, dateStr) => {
      const date = new Date(dateStr + "T00:00:00");
      switch (status.status) {
        case "ok":
          ok.push(date);
          break;
        case "pending-exception":
          pendingException.push(date);
          break;
        case "issues-no-exception":
        case "absent":
          issuesNoException.push(date);
          break;
        case "leave":
          leave.push(date);
          break;
      }
    });

    return { ok, pendingException, issuesNoException, leave };
  }, [dayStatusMap]);

  // Custom day renderer with tooltip
  const DayWithTooltip = (props: any) => {
    const { date } = props;
    const dateStr = format(date, "yyyy-MM-dd");
    const dayStatus = dayStatusMap.get(dateStr);

    // Don't show tooltip for future or non-working days
    if (!dayStatus || dayStatus.status === "future" || dayStatus.status === "non-working") {
      return (
        <button {...props} className={cn(props.className, "rdp-day_button")}>
          {format(date, "d")}
        </button>
      );
    }

    return (
      <TooltipProvider delayDuration={150}>
        <Tooltip>
          <TooltipTrigger asChild>
            <button {...props} className={cn(props.className, "rdp-day_button")}>
              {format(date, "d")}
            </button>
          </TooltipTrigger>
          <TooltipContent side="right" className="z-[100]">
            <AttendanceDayTooltip dayStatus={dayStatus} date={date} />
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  };

  return (
    <div className="p-4 w-[520px]">
      {/* Header with month navigation */}
      <div className="flex items-center justify-between mb-6">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setSelectedMonth(subMonths(selectedMonth, 1))}
          className="h-8 w-8 p-0"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>

        <h3 className="font-semibold text-lg text-foreground">
          {format(selectedMonth, "MMMM yyyy")}
        </h3>

        <Button
          variant="outline"
          size="sm"
          onClick={() => setSelectedMonth(addMonths(selectedMonth, 1))}
          disabled={isAfter(selectedMonth, new Date())}
          className="h-8 w-8 p-0"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Calendar */}
      {loading ? (
        <div className="flex items-center justify-center h-80">
          <div className="space-y-4 text-center">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 mx-auto" 
                 style={{ borderColor: "hsl(var(--primary))" }} />
            <p className="text-sm text-muted-foreground">Loading attendance data...</p>
          </div>
        </div>
      ) : (
        <DayPicker
          mode="default"
          month={selectedMonth}
          onMonthChange={setSelectedMonth}
          modifiers={modifiers}
          modifiersClassNames={{
            ok: "ok",
            pendingException: "pendingException",
            issuesNoException: "issuesNoException",
            leave: "leave",
          }}
          disabled={(date) => isAfter(date, new Date())}
          className={cn("attendance-calendar pointer-events-auto")}
          components={{
            Day: DayWithTooltip,
          }}
        />
      )}

      {/* Enhanced Legend */}
      <div className="mt-6 pt-4 border-t space-y-3" style={{ borderColor: "hsl(var(--border))" }}>
        <h4 className="text-sm font-semibold text-foreground">Status Legend</h4>
        <div className="grid grid-cols-2 gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-5 h-5 rounded border-2 flex items-center justify-center text-xs" 
                 style={{
                   backgroundColor: "hsl(var(--success-light))",
                   borderColor: "hsl(var(--success) / 0.3)",
                   color: "hsl(var(--success))"
                 }}>
              ✓
            </div>
            <span className="text-sm text-foreground">All OK</span>
          </div>
          <div className="flex items-center gap-2.5">
            <div className="w-5 h-5 rounded border-2 flex items-center justify-center text-xs"
                 style={{
                   backgroundColor: "hsl(var(--warning-light))",
                   borderColor: "hsl(var(--warning) / 0.3)"
                 }}>
              ⏳
            </div>
            <span className="text-sm text-foreground">Pending</span>
          </div>
          <div className="flex items-center gap-2.5">
            <div className="w-5 h-5 rounded border-2 flex items-center justify-center text-xs"
                 style={{
                   backgroundColor: "hsl(var(--destructive-light))",
                   borderColor: "hsl(var(--destructive) / 0.3)",
                   color: "hsl(var(--destructive))"
                 }}>
              ⚠
            </div>
            <span className="text-sm text-foreground">Issues</span>
          </div>
          <div className="flex items-center gap-2.5">
            <div className="w-5 h-5 rounded border-2 flex items-center justify-center text-xs"
                 style={{
                   backgroundColor: "hsl(var(--muted))",
                   borderColor: "hsl(var(--border))"
                 }}>
              📅
            </div>
            <span className="text-sm text-foreground">Leave</span>
          </div>
        </div>
        <p className="text-xs text-muted-foreground italic mt-2">
          Hover over any day to see detailed information
        </p>
      </div>
    </div>
  );
}
