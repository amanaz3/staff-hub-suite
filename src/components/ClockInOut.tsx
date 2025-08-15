import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LogIn, LogOut, Clock, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

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

  // Get today's date in YYYY-MM-DD format
  const today = new Date().toISOString().split('T')[0];

  // Fetch employee record and today's attendance
  useEffect(() => {
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

    fetchAttendanceData();
  }, [userProfile.user_id, today, toast]);

  const handleClockIn = async () => {
    if (!employeeId) return;
    
    setActionLoading(true);
    try {
      const now = new Date().toISOString();
      
      const { error } = await supabase
        .from('attendance')
        .insert({
          employee_id: employeeId,
          date: today,
          clock_in_time: now,
          status: 'present'
        });

      if (error) {
        if (error.code === '23505') { // Unique constraint violation
          toast({
            title: "Already Clocked In",
            description: "You have already clocked in today",
            variant: "destructive"
          });
        } else {
          throw error;
        }
        return;
      }

      setState({
        status: 'clocked-in',
        clockInTime: now,
        clockOutTime: null,
        totalHours: null
      });

      toast({
        title: "Clocked In",
        description: `Successfully clocked in at ${format(new Date(now), 'HH:mm')}`,
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
    if (!employeeId || state.status !== 'clocked-in') return;
    
    setActionLoading(true);
    try {
      const now = new Date().toISOString();
      
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

      // Calculate total hours
      const clockInTime = new Date(state.clockInTime!);
      const clockOutTime = new Date(now);
      const totalHours = (clockOutTime.getTime() - clockInTime.getTime()) / (1000 * 60 * 60);

      setState({
        status: 'clocked-out',
        clockInTime: state.clockInTime,
        clockOutTime: now,
        totalHours: totalHours
      });

      toast({
        title: "Clocked Out",
        description: `Successfully clocked out at ${format(new Date(now), 'HH:mm')}`,
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
          description: `Clocked in at ${state.clockInTime ? format(new Date(state.clockInTime), 'HH:mm') : ''}`
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
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
      {/* Today's Clock Section */}
      <div className="lg:col-span-2">
        <Card className="p-6 shadow-lg">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-semibold text-foreground">Today's clock</h2>
            <div className="text-right">
              <div className="text-sm text-muted-foreground">Total work hours today</div>
              <div className="text-xl font-semibold">
                {state.totalHours ? `${state.totalHours.toFixed(2)}:00` : '00:00'}
              </div>
            </div>
          </div>

          <div className="flex flex-col items-center justify-center py-8">
            {state.status === 'not-clocked-in' && (
              <div className="text-center mb-8">
                <p className="text-muted-foreground mb-6">Nothing's scheduled for today</p>
              </div>
            )}
            
            {/* Large Circular Clock Button */}
            <div className="relative">
              <div className="w-48 h-48 bg-gradient-to-br from-primary to-primary-light rounded-full flex items-center justify-center shadow-xl hover:shadow-2xl transition-all duration-300 cursor-pointer group"
                   onClick={state.status === 'not-clocked-in' ? handleClockIn : handleClockOut}>
                <div className="text-center text-white">
                  {actionLoading ? (
                    <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
                  ) : (
                    <Clock className="h-8 w-8 mx-auto mb-2" />
                  )}
                  <div className="text-lg font-semibold">
                    {state.status === 'not-clocked-in' ? 'Clock in' : 
                     state.status === 'clocked-in' ? 'Clock out' : 'Completed'}
                  </div>
                  {state.status === 'clocked-in' && state.clockInTime && (
                    <div className="text-sm opacity-90 mt-1">
                      Started: {format(new Date(state.clockInTime), 'HH:mm')}
                    </div>
                  )}
                </div>
              </div>
              
              {/* Status indicator */}
              {state.status !== 'not-clocked-in' && (
                <div className="absolute -bottom-2 -right-2">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-medium ${
                    state.status === 'clocked-in' ? 'bg-success' : 'bg-primary'
                  }`}>
                    {state.status === 'clocked-in' ? '✓' : '⏹'}
                  </div>
                </div>
              )}
            </div>

            {/* Time Details */}
            {(state.clockInTime || state.clockOutTime) && (
              <div className="mt-8 flex items-center gap-6 text-sm text-muted-foreground">
                {state.clockInTime && (
                  <div className="flex items-center gap-2">
                    <LogIn className="h-4 w-4" />
                    <span>In: {format(new Date(state.clockInTime), 'HH:mm')}</span>
                  </div>
                )}
                {state.clockOutTime && (
                  <div className="flex items-center gap-2">
                    <LogOut className="h-4 w-4" />
                    <span>Out: {format(new Date(state.clockOutTime), 'HH:mm')}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Requests Section */}
      <div>
        <Card className="p-6 shadow-lg">
          <h3 className="text-xl font-semibold text-foreground mb-6">Requests</h3>
          
          <div className="space-y-4">
            <Button 
              variant="outline" 
              className="w-full justify-start h-12 border-primary/20 hover:bg-primary/5"
              size="lg"
            >
              <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center mr-3">
                <div className="text-primary text-lg">+</div>
              </div>
              Add a shift request
            </Button>
            
            <Button 
              variant="outline" 
              className="w-full justify-start h-12 border-secondary/20 hover:bg-secondary/5"
              size="lg"
            >
              <div className="w-8 h-8 bg-secondary/10 rounded-full flex items-center justify-center mr-3">
                <div className="text-secondary text-lg">+</div>
              </div>
              Add an absence request
            </Button>
          </div>

          <div className="mt-8 pt-6 border-t">
            <Button variant="link" className="text-primary p-0 h-auto font-normal">
              View your requests
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
};