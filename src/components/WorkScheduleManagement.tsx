import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Clock, Plus, Save, Edit } from 'lucide-react';

interface WorkSchedule {
  id: string;
  employee_id: string;
  start_time: string;
  end_time: string;
  minimum_daily_hours: number;
  working_days: string[];
  is_active: boolean;
  employee_name?: string;
}

interface Employee {
  id: string;
  full_name: string;
  employee_id: string;
}

export const WorkScheduleManagement = () => {
  const [schedules, setSchedules] = useState<WorkSchedule[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('');
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('17:00');
  const [minimumHours, setMinimumHours] = useState(8);
  const [workingDays, setWorkingDays] = useState<string[]>([
    'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'
  ]);
  const [editingSchedule, setEditingSchedule] = useState<WorkSchedule | null>(null);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchEmployees();
    fetchSchedules();
  }, []);

  const fetchEmployees = async () => {
    try {
      const { data, error } = await supabase
        .from('employees')
        .select('id, full_name, employee_id')
        .eq('status', 'active')
        .order('full_name');

      if (error) throw error;
      setEmployees(data || []);
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to fetch employees",
        variant: "destructive"
      });
    }
  };

  const fetchSchedules = async () => {
    try {
      const { data: schedulesData, error } = await supabase
        .from('work_schedules')
        .select('*')
        .eq('is_active', true);

      if (error) throw error;
      
      if (!schedulesData || schedulesData.length === 0) {
        setSchedules([]);
        return;
      }

      // Get employee details
      const employeeIds = schedulesData.map(schedule => schedule.employee_id);
      const { data: employeesData } = await supabase
        .from('employees')
        .select('id, full_name, employee_id')
        .in('id', employeeIds);

      const schedulesWithEmployeeNames = schedulesData.map(schedule => ({
        ...schedule,
        employee_name: employeesData?.find(emp => emp.id === schedule.employee_id)?.full_name || 'Unknown Employee'
      }));
      
      setSchedules(schedulesWithEmployeeNames);
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to fetch work schedules",
        variant: "destructive"
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmployeeId && !editingSchedule) return;

    if (workingDays.length === 0) {
      toast({
        title: "Error",
        description: "Please select at least one working day",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const scheduleData = {
        employee_id: editingSchedule ? editingSchedule.employee_id : selectedEmployeeId,
        start_time: startTime,
        end_time: endTime,
        minimum_daily_hours: minimumHours,
        working_days: workingDays,
        is_active: true
      };

      if (editingSchedule) {
        const { error } = await supabase
          .from('work_schedules')
          .update(scheduleData)
          .eq('id', editingSchedule.id);

        if (error) throw error;

        toast({
          title: "Success",
          description: "Work schedule updated successfully"
        });
      } else {
        // Check if schedule already exists for this employee
        const { data: existing } = await supabase
          .from('work_schedules')
          .select('id')
          .eq('employee_id', selectedEmployeeId)
          .eq('is_active', true)
          .maybeSingle();

        if (existing) {
          toast({
            title: "Error",
            description: "This employee already has an active work schedule",
            variant: "destructive"
          });
          return;
        }

        const { error } = await supabase
          .from('work_schedules')
          .insert(scheduleData);

        if (error) throw error;

        toast({
          title: "Success",
          description: "Work schedule created successfully"
        });
      }

      resetForm();
      fetchSchedules();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setSelectedEmployeeId('');
    setStartTime('09:00');
    setEndTime('17:00');
    setMinimumHours(8);
    setWorkingDays(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']);
    setEditingSchedule(null);
  };

  const handleEdit = (schedule: WorkSchedule) => {
    setEditingSchedule(schedule);
    setStartTime(schedule.start_time);
    setEndTime(schedule.end_time);
    setMinimumHours(schedule.minimum_daily_hours);
    setWorkingDays(schedule.working_days || ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']);
  };

  const getAvailableEmployees = () => {
    const scheduledEmployeeIds = schedules.map(s => s.employee_id);
    return employees.filter(emp => !scheduledEmployeeIds.includes(emp.id));
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            {editingSchedule ? 'Edit Work Schedule' : 'Create Work Schedule'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              {!editingSchedule && (
                <div>
                  <Label htmlFor="employee">Employee</Label>
                  <Select value={selectedEmployeeId} onValueChange={setSelectedEmployeeId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select employee" />
                    </SelectTrigger>
                    <SelectContent>
                      {getAvailableEmployees().map(employee => (
                        <SelectItem key={employee.id} value={employee.id}>
                          {employee.full_name} ({employee.employee_id})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              
              <div>
                <Label htmlFor="startTime">Start Time</Label>
                <Input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  required
                />
              </div>
              
              <div>
                <Label htmlFor="endTime">End Time</Label>
                <Input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  required
                />
              </div>
              
              <div>
                <Label htmlFor="minimumHours">Minimum Daily Hours</Label>
                <Input
                  type="number"
                  step="0.5"
                  min="1"
                  max="24"
                  value={minimumHours}
                  onChange={(e) => setMinimumHours(parseFloat(e.target.value))}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Working Days *</Label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 p-4 border rounded-md">
                {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map((day) => (
                  <div key={day} className="flex items-center space-x-2">
                    <Checkbox
                      id={day}
                      checked={workingDays.includes(day)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setWorkingDays([...workingDays, day]);
                        } else {
                          setWorkingDays(workingDays.filter(d => d !== day));
                        }
                      }}
                    />
                    <Label htmlFor={day} className="cursor-pointer font-normal">
                      {day}
                    </Label>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="flex gap-2">
              <Button type="submit" disabled={loading}>
                {editingSchedule ? <Save className="h-4 w-4 mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
                {editingSchedule ? 'Update Schedule' : 'Create Schedule'}
              </Button>
              {editingSchedule && (
                <Button type="button" variant="outline" onClick={resetForm}>
                  Cancel
                </Button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Current Work Schedules</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {schedules.length === 0 ? (
              <p className="text-muted-foreground">No work schedules configured</p>
            ) : (
              schedules.map(schedule => (
                <div key={schedule.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <h4 className="font-medium">{schedule.employee_name}</h4>
                    <p className="text-sm text-muted-foreground">
                      {schedule.start_time} - {schedule.end_time} | 
                      Minimum: {schedule.minimum_daily_hours}h
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Working: {schedule.working_days?.join(', ') || 'Not set'}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleEdit(schedule)}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};