import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LogIn, LogOut, Clock, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { todayInGST, nowInGSTISO, formatInGST } from '@/lib/timezone';

interface ClockInOutProps {
  userProfile: {
    user_id: string;
    email: string;
    full_name: string;
  };
}

interface AttendanceRecord {
  id: string;
  clock_in_time: string | null;
  clock_out_time: string | null;
  total_hours: number | null;
  status: string;
}

interface ClockInOutState {
  status: 'not-clocked-in' | 'clocked-in' | 'clocked-out';
  clockInTime: string | null;
  clockOutTime: string | null;
  totalHours: number | null;
}

export const ClockInOut = ({ userProfile }: ClockInOutProps) => {
  const [state, setState] = useState<ClockInOutState>({
    status: 'not-clocked-in',
    clockInTime: null,
    clockOutTime: null,
    totalHours: null
  });
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [employeeId, setEmployeeId] = useState<string | null>(null);
  const { toast } = useToast();

  // Get today's date in GST timezone
  const today = todayInGST();

  // Fetch employee record and today's attendance
  const fetchAttendanceData = async () => {
    try {
      // First, get the employee record for the current user
      const { data: employee, error: employeeError } = await supabase
        .from('employees')
        .select('id')
        .eq('user_id', userProfile.user_id)
        .maybeSingle();

      if (employeeError) {
        console.error('Error fetching employee:', employeeError);
        toast({
          title: "Error",
          description: "Failed to fetch employee data",
          variant: "destructive"
        });
        return;
      }

      if (!employee) {
        toast({
          title: "Error", 
          description: "Employee record not found. Please contact admin.",
          variant: "destructive"
        });
        return;
      }

      setEmployeeId(employee.id);

      // Then get today's attendance record
      const { data: attendance, error: attendanceError } = await supabase
        .from('attendance')
        .select('id, clock_in_time, clock_out_time, total_hours, status')
        .eq('employee_id', employee.id)
        .eq('date', today)
        .maybeSingle();

      if (attendanceError) {
        console.error('Error fetching attendance:', attendanceError);
        toast({
          title: "Error",
          description: "Failed to fetch attendance data",
          variant: "destructive"
        });
        return;
      }

      if (attendance) {
        const hasClockIn = attendance.clock_in_time !== null;
        const hasClockOut = attendance.clock_out_time !== null;
        
        setState({
          status: hasClockOut ? 'clocked-out' : hasClockIn ? 'clocked-in' : 'not-clocked-in',
          clockInTime: attendance.clock_in_time,
          clockOutTime: attendance.clock_out_time,
          totalHours: attendance.total_hours
        });
      } else {
        setState({
          status: 'not-clocked-in',
          clockInTime: null,
          clockOutTime: null,
          totalHours: null
        });
      }
    } catch (error) {
      console.error('Error in fetchAttendanceData:', error);
      toast({
        title: "Error",
        description: "An unexpected error occurred",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAttendanceData();
  }, [userProfile.user_id, today, toast]);

  const handleClockIn = async () => {
    if (!employeeId) {
      toast({
        title: "Error",
        description: "Employee data not loaded. Please refresh the page.",
        variant: "destructive"
      });
      return;
    }
    
    setActionLoading(true);
    try {
      const now = nowInGSTISO();
      
      // Get user's current IP (in production, this would be server-side)
      const response = await fetch('https://api.ipify.org?format=json');
      const { ip } = await response.json();
      
      // Check if attendance record exists for today
      const { data: existingRecord } = await supabase
        .from('attendance')
        .select('id, clock_in_time, clock_out_time')
        .eq('employee_id', employeeId)
        .eq('date', today)
        .maybeSingle();

      if (existingRecord) {
        // If already clocked in and not clocked out, show error
        if (existingRecord.clock_in_time && !existingRecord.clock_out_time) {
          toast({
            title: "Already Clocked In",
            description: "You have already clocked in today",
            variant: "destructive"
          });
          return;
        }
        
        // If clocked out, allow re-clock-in by updating the record
        const { error } = await supabase
          .from('attendance')
          .update({
            clock_in_time: now,
            clock_out_time: null,
            total_hours: null,
            ip_address: ip
          })
          .eq('id', existingRecord.id);

        if (error) throw error;
      } else {
        // No record exists, insert new one
        const { error } = await supabase
          .from('attendance')
          .insert({
            employee_id: employeeId,
            date: today,
            clock_in_time: now,
            status: 'present',
            ip_address: ip
          });

        if (error) throw error;
      }

      // Refetch attendance data to ensure UI shows actual database state
      await fetchAttendanceData();

      toast({
        title: "Clocked In",
        description: `Successfully clocked in at ${formatInGST(now, 'HH:mm')} GST`,
      });
    } catch (error) {
      console.error('Error clocking in:', error);
      toast({
        title: "Error",
        description: "Failed to clock in. Please try again.",
        variant: "destructive"
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleClockOut = async () => {
    if (!employeeId) {
      toast({
        title: "Error",
        description: "Employee data not loaded. Please refresh the page.",
        variant: "destructive"
      });
      return;
    }
    
    // Allow re-clocking out if already clocked in or clocked out
    if (state.status === 'not-clocked-in') return;
    
    setActionLoading(true);
    try {
      const now = nowInGSTISO();
      
      const { error } = await supabase
        .from('attendance')
        .update({
          clock_out_time: now
        })
        .eq('employee_id', employeeId)
        .eq('date', today);

      if (error) {
        throw error;
      }

      // Refetch attendance data to ensure UI shows actual database state
      await fetchAttendanceData();

      toast({
        title: "Clocked Out",
        description: `Successfully clocked out at ${formatInGST(now, 'HH:mm')} GST`,
      });
    } catch (error) {
      console.error('Error clocking out:', error);
      toast({
        title: "Error",
        description: "Failed to clock out. Please try again.",
        variant: "destructive"
      });
    } finally {
      setActionLoading(false);
    }
  };

  const getStatusDisplay = () => {
    switch (state.status) {
      case 'not-clocked-in':
        return {
          text: 'Not clocked in',
          badge: 'bg-muted text-muted-foreground',
          description: 'Click Clock In to start your day'
        };
      case 'clocked-in':
        return {
          text: 'Clocked in',
          badge: 'bg-status-present text-white',
          description: `Clocked in at ${state.clockInTime ? formatInGST(state.clockInTime, 'HH:mm') : ''} GST`
        };
      case 'clocked-out':
        return {
          text: 'Clocked out',
          badge: 'bg-status-approved text-white',
          description: `Total hours: ${state.totalHours ? state.totalHours.toFixed(2) : 'Calculating...'}`
        };
    }
  };

  if (loading) {
    return (
      <Card className="border-2 border-primary/20 bg-gradient-to-r from-primary/5 to-primary-glow/5">
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span className="ml-2">Loading attendance...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  const statusDisplay = getStatusDisplay();

  return (
    <Card className="border-2 border-primary/20 bg-gradient-to-r from-primary/5 to-primary-glow/5">
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h3 className="text-lg font-semibold text-foreground">
                Today's Attendance
              </h3>
              <Badge className={statusDisplay.badge}>
                {statusDisplay.text}
              </Badge>
            </div>
            <p className="text-muted-foreground mb-2">
              {statusDisplay.description}
            </p>
            
            {/* Show times when available */}
            {(state.clockInTime || state.clockOutTime) && (
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                {state.clockInTime && (
                  <div className="flex items-center gap-1">
                    <LogIn className="h-4 w-4" />
                    In: {formatInGST(state.clockInTime, 'HH:mm')} GST
                  </div>
                )}
                {state.clockOutTime && (
                  <div className="flex items-center gap-1">
                    <LogOut className="h-4 w-4" />
                    Out: {formatInGST(state.clockOutTime, 'HH:mm')} GST
                  </div>
                )}
                {state.totalHours && (
                  <div className="flex items-center gap-1">
                    <Clock className="h-4 w-4" />
                    {state.totalHours.toFixed(2)}h
                  </div>
                )}
              </div>
            )}
          </div>
          
          
          <div className="flex gap-3">
            <Button 
              onClick={handleClockIn}
              size="lg"
              disabled={actionLoading || state.status !== 'not-clocked-in'}
              className="bg-status-present hover:bg-status-present/90 disabled:opacity-50"
            >
              {actionLoading && state.status === 'not-clocked-in' ? (
                <Loader2 className="h-5 w-5 mr-2 animate-spin" />
              ) : (
                <LogIn className="h-5 w-5 mr-2" />
              )}
              Clock In
            </Button>
            
            <Button 
              onClick={handleClockOut}
              size="lg"
              disabled={actionLoading || state.status === 'not-clocked-in'}
              className="bg-status-rejected hover:bg-status-rejected/90 disabled:opacity-50"
            >
              {actionLoading && state.status !== 'not-clocked-in' ? (
                <Loader2 className="h-5 w-5 mr-2 animate-spin" />
              ) : (
                <LogOut className="h-5 w-5 mr-2" />
              )}
              {state.status === 'clocked-out' ? 'Update Clock Out' : 'Clock Out'}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};