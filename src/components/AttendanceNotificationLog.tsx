import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, RefreshCw, Download } from "lucide-react";
import { format } from "date-fns";
import { toast } from "@/hooks/use-toast";

export const AttendanceNotificationLog = () => {
  const [dateRange, setDateRange] = useState<{ from: Date; to: Date }>({
    from: new Date(new Date().setDate(new Date().getDate() - 7)),
    to: new Date(),
  });
  const [isManualTrigger, setIsManualTrigger] = useState(false);

  const { data: notifications, isLoading, refetch } = useQuery({
    queryKey: ["attendance-notifications", dateRange],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("attendance_notification_log")
        .select(`
          *,
          employees:employee_id (
            full_name,
            email,
            employee_id
          )
        `)
        .gte("attendance_date", format(dateRange.from, "yyyy-MM-dd"))
        .lte("attendance_date", format(dateRange.to, "yyyy-MM-dd"))
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  const handleManualTrigger = async () => {
    setIsManualTrigger(true);
    try {
      const { data, error } = await supabase.functions.invoke(
        "daily-attendance-notifications",
        {
          body: { scheduled_run: false },
        }
      );

      if (error) throw error;

      toast({
        title: "Notifications Triggered",
        description: `Successfully processed attendance notifications. Sent: ${data.results?.sent || 0}, Failed: ${data.results?.failed || 0}`,
      });

      refetch();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsManualTrigger(false);
    }
  };

  const getIssueColor = (issue: string) => {
    switch (issue) {
      case "absent":
        return "destructive";
      case "late":
        return "default";
      case "early":
        return "secondary";
      case "incomplete_hours":
        return "outline";
      default:
        return "default";
    }
  };

  const exportToCSV = () => {
    if (!notifications || notifications.length === 0) return;

    const headers = ["Date", "Employee ID", "Employee Name", "Email", "Issues", "Status"];
    const rows = notifications.map((n: any) => [
      format(new Date(n.attendance_date), "yyyy-MM-dd"),
      n.employees?.employee_id || "",
      n.employees?.full_name || "",
      n.employees?.email || "",
      Array.isArray(n.issues_detected) ? n.issues_detected.join(", ") : "",
      n.email_status,
    ]);

    const csv = [headers, ...rows].map((row) => row.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `attendance-notifications-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Attendance Notification Log</CardTitle>
          <CardDescription>
            View all attendance notifications sent to employees about late check-ins, early check-outs, absences, and incomplete hours.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-4 items-center">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-[280px]">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {format(dateRange.from, "PPP")} - {format(dateRange.to, "PPP")}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="range"
                  selected={{ from: dateRange.from, to: dateRange.to }}
                  onSelect={(range: any) => {
                    if (range?.from && range?.to) {
                      setDateRange({ from: range.from, to: range.to });
                    }
                  }}
                  numberOfMonths={2}
                />
              </PopoverContent>
            </Popover>

            <Button onClick={() => refetch()} variant="outline" size="sm">
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>

            <Button onClick={handleManualTrigger} disabled={isManualTrigger} size="sm">
              {isManualTrigger ? "Processing..." : "Trigger Notifications"}
            </Button>

            <Button onClick={exportToCSV} variant="outline" size="sm">
              <Download className="mr-2 h-4 w-4" />
              Export CSV
            </Button>
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Employee</TableHead>
                  <TableHead>Issues</TableHead>
                  <TableHead>Details</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Sent At</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center">
                      Loading notifications...
                    </TableCell>
                  </TableRow>
                ) : notifications && notifications.length > 0 ? (
                  notifications.map((notification: any) => (
                    <TableRow key={notification.id}>
                      <TableCell>
                        {format(new Date(notification.attendance_date), "MMM dd, yyyy")}
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{notification.employees?.full_name}</div>
                          <div className="text-sm text-muted-foreground">
                            {notification.employees?.employee_id}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {Array.isArray(notification.issues_detected) &&
                            notification.issues_detected.map((issue: string, idx: number) => (
                              <Badge key={idx} variant={getIssueColor(issue)}>
                                {issue.replace("_", " ")}
                              </Badge>
                            ))}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm space-y-1">
                          {notification.issue_details?.late_hours && (
                            <div>Late: {notification.issue_details.late_hours}h</div>
                          )}
                          {notification.issue_details?.early_hours && (
                            <div>Early: {notification.issue_details.early_hours}h</div>
                          )}
                          {notification.issue_details?.total_hours && (
                            <div>
                              Hours: {notification.issue_details.total_hours}/
                              {notification.issue_details.minimum_hours}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={notification.email_status === "sent" ? "default" : "destructive"}>
                          {notification.email_status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {notification.email_sent_at
                          ? format(new Date(notification.email_sent_at), "MMM dd, HH:mm")
                          : "-"}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground">
                      No notifications found for the selected date range
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
