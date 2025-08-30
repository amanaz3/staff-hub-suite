import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Calendar, Plus, Edit } from 'lucide-react';

interface LeaveBalance {
  id: string;
  employee_id: string;
  leave_type_id: string;
  allocated_days: number;
  used_days: number;
  year: number;
  employee_name?: string;
  leave_type_name?: string;
}

interface Employee {
  id: string;
  full_name: string;
  employee_id: string;
}

interface LeaveType {
  id: string;
  name: string;
  max_days: number;
}

export const LeaveBalanceManagement = () => {
  const [balances, setBalances] = useState<LeaveBalance[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('');
  const [selectedLeaveTypeId, setSelectedLeaveTypeId] = useState<string>('');
  const [allocatedDays, setAllocatedDays] = useState<number>(0);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [editingBalance, setEditingBalance] = useState<LeaveBalance | null>(null);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchEmployees();
    fetchLeaveTypes();
    fetchBalances();
  }, [selectedYear]);

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

  const fetchLeaveTypes = async () => {
    try {
      const { data, error } = await supabase
        .from('leave_types')
        .select('id, name, max_days')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setLeaveTypes(data || []);
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to fetch leave types",
        variant: "destructive"
      });
    }
  };

  const fetchBalances = async () => {
    try {
      const { data: balancesData, error } = await supabase
        .from('employee_leave_balances')
        .select('*')
        .eq('year', selectedYear)
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (!balancesData || balancesData.length === 0) {
        setBalances([]);
        return;
      }

      // Get employee and leave type details
      const employeeIds = [...new Set(balancesData.map(b => b.employee_id))];
      const leaveTypeIds = [...new Set(balancesData.map(b => b.leave_type_id))];

      const [employeesResponse, leaveTypesResponse] = await Promise.all([
        supabase.from('employees').select('id, full_name').in('id', employeeIds),
        supabase.from('leave_types').select('id, name').in('id', leaveTypeIds)
      ]);

      const balancesWithDetails = balancesData.map(balance => ({
        ...balance,
        employee_name: employeesResponse.data?.find(emp => emp.id === balance.employee_id)?.full_name || 'Unknown Employee',
        leave_type_name: leaveTypesResponse.data?.find(lt => lt.id === balance.leave_type_id)?.name || 'Unknown Type'
      }));

      setBalances(balancesWithDetails);
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to fetch leave balances",
        variant: "destructive"
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmployeeId || !selectedLeaveTypeId || allocatedDays < 0) return;

    setLoading(true);
    try {
      const balanceData = {
        employee_id: editingBalance ? editingBalance.employee_id : selectedEmployeeId,
        leave_type_id: editingBalance ? editingBalance.leave_type_id : selectedLeaveTypeId,
        allocated_days: allocatedDays,
        year: selectedYear
      };

      if (editingBalance) {
        const { error } = await supabase
          .from('employee_leave_balances')
          .update({ allocated_days: allocatedDays })
          .eq('id', editingBalance.id);

        if (error) throw error;

        toast({
          title: "Success",
          description: "Leave balance updated successfully"
        });
      } else {
        // Check if balance already exists for this employee/leave type/year
        const { data: existing } = await supabase
          .from('employee_leave_balances')
          .select('id')
          .eq('employee_id', selectedEmployeeId)
          .eq('leave_type_id', selectedLeaveTypeId)
          .eq('year', selectedYear)
          .maybeSingle();

        if (existing) {
          toast({
            title: "Error", 
            description: "Balance already exists for this employee, leave type and year",
            variant: "destructive"
          });
          return;
        }

        const { error } = await supabase
          .from('employee_leave_balances')
          .insert(balanceData);

        if (error) throw error;

        toast({
          title: "Success",
          description: "Leave balance created successfully"
        });
      }

      resetForm();
      fetchBalances();
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
    setSelectedLeaveTypeId('');
    setAllocatedDays(0);
    setEditingBalance(null);
  };

  const handleEdit = (balance: LeaveBalance) => {
    setEditingBalance(balance);
    setAllocatedDays(balance.allocated_days);
  };

  const getAvailableEmployeeLeaveTypes = () => {
    if (!selectedEmployeeId) return [];
    
    const existingBalances = balances.filter(b => 
      b.employee_id === selectedEmployeeId && b.year === selectedYear
    );
    const usedLeaveTypeIds = existingBalances.map(b => b.leave_type_id);
    
    return leaveTypes.filter(lt => !usedLeaveTypeIds.includes(lt.id));
  };

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            {editingBalance ? 'Edit Leave Balance' : 'Set Leave Balance'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="year">Year</Label>
                <Select value={selectedYear.toString()} onValueChange={(value) => setSelectedYear(parseInt(value))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select year" />
                  </SelectTrigger>
                  <SelectContent>
                    {years.map(year => (
                      <SelectItem key={year} value={year.toString()}>
                        {year}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {!editingBalance && (
                <>
                  <div>
                    <Label htmlFor="employee">Employee</Label>
                    <Select value={selectedEmployeeId} onValueChange={setSelectedEmployeeId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select employee" />
                      </SelectTrigger>
                      <SelectContent>
                        {employees.map(employee => (
                          <SelectItem key={employee.id} value={employee.id}>
                            {employee.full_name} ({employee.employee_id})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="leaveType">Leave Type</Label>
                    <Select value={selectedLeaveTypeId} onValueChange={setSelectedLeaveTypeId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select leave type" />
                      </SelectTrigger>
                      <SelectContent>
                        {getAvailableEmployeeLeaveTypes().map(leaveType => (
                          <SelectItem key={leaveType.id} value={leaveType.id}>
                            {leaveType.name} (Max: {leaveType.max_days} days)
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}

              <div>
                <Label htmlFor="allocatedDays">Allocated Days</Label>
                <Input
                  type="number"
                  min="0"
                  max="365"
                  value={allocatedDays}
                  onChange={(e) => setAllocatedDays(parseInt(e.target.value) || 0)}
                  required
                />
              </div>
            </div>

            <div className="flex gap-2">
              <Button type="submit" disabled={loading}>
                {editingBalance ? <Edit className="h-4 w-4 mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
                {editingBalance ? 'Update Balance' : 'Set Balance'}
              </Button>
              {editingBalance && (
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
          <CardTitle>Leave Balances for {selectedYear}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {balances.length === 0 ? (
              <p className="text-muted-foreground">No leave balances configured for {selectedYear}</p>
            ) : (
              balances.map(balance => (
                <div key={balance.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <h4 className="font-medium">{balance.employee_name}</h4>
                    <p className="text-sm text-muted-foreground">
                      {balance.leave_type_name}: {balance.used_days}/{balance.allocated_days} days used
                    </p>
                    <div className="w-full bg-muted rounded-full h-2 mt-2">
                      <div 
                        className="bg-primary h-2 rounded-full" 
                        style={{ width: `${Math.min((balance.used_days / balance.allocated_days) * 100, 100)}%` }}
                      ></div>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleEdit(balance)}
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