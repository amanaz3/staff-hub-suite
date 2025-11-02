import { useState, useEffect } from "react";
import { Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { AttendanceCalendarPopup } from "./AttendanceCalendarPopup";
import { supabase } from "@/integrations/supabase/client";
import { subDays } from "date-fns";

interface AttendanceCalendarButtonProps {
  userProfile: any;
}

export function AttendanceCalendarButton({ userProfile }: AttendanceCalendarButtonProps) {
  const [open, setOpen] = useState(false);
  const [hasIssues, setHasIssues] = useState(false);

  // Check for pending issues in the last 7 days
  useEffect(() => {
    const checkForPendingIssues = async () => {
      if (!userProfile?.id) return;

      try {
        const { data: employeeData } = await supabase
          .from("employees")
          .select("id")
          .eq("user_id", userProfile.id)
          .single();

        if (!employeeData) return;

        const sevenDaysAgo = subDays(new Date(), 7);
        const today = new Date().toISOString().split("T")[0];

        // Check for attendance issues (missing clock in/out, late, etc.)
        const { data: attendanceIssues } = await supabase
          .from("attendance")
          .select("id, date, clock_in_time, clock_out_time")
          .eq("employee_id", employeeData.id)
          .gte("date", sevenDaysAgo.toISOString().split("T")[0])
          .lte("date", today);

        if (attendanceIssues && attendanceIssues.length > 0) {
          const hasUnresolvedIssues = attendanceIssues.some(
            (att) => !att.clock_in_time || !att.clock_out_time
          );
          setHasIssues(hasUnresolvedIssues);
        }
      } catch (error) {
        console.error("Error checking for issues:", error);
      }
    };

    checkForPendingIssues();
  }, [userProfile]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label="View attendance calendar"
        >
          <Calendar className="h-5 w-5" />
          {hasIssues && (
            <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-destructive animate-pulse" />
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent
        className="w-auto p-0"
        align="end"
        side="bottom"
        sideOffset={8}
      >
        <AttendanceCalendarPopup
          userProfile={userProfile}
          onClose={() => setOpen(false)}
        />
      </PopoverContent>
    </Popover>
  );
}
