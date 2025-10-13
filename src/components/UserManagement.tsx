import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { UserPlus, Users, KeyRound, Loader2, Pencil, MoreVertical, UserX, UserCheck } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';

interface Employee {
  id: string;
  employee_id: string;
  staff_id?: string;
  full_name: string;
  email?: string;
  department: string;
  division?: string;
  position: string;
  status: string;
  hire_date?: string;
  wfh_enabled?: boolean;
}

export const UserManagement = () => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviting, setInviting] = useState(false);
  const [resettingPassword, setResettingPassword] = useState<string | null>(null);
  const { toast } = useToast();
  const [profile, setProfile] = useState<any>(null);
  const [divisions, setDivisions] = useState<string[]>([]);
  const [isAddingNewDivision, setIsAddingNewDivision] = useState(false);
  const [newDivisionName, setNewDivisionName] = useState('');
  const [staffIdError, setStaffIdError] = useState('');
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [editStaffIdError, setEditStaffIdError] = useState('');
  const [statusToggleEmployee, setStatusToggleEmployee] = useState<Employee | null>(null);
  const [togglingStatus, setTogglingStatus] = useState(false);
  
  // Check if user is admin
  const isAdmin = profile?.role === 'admin';
  
  // Form state
  const [formData, setFormData] = useState({
    email: '',
    full_name: '',
    role: 'staff',
    staff_id: '',
    division: '',
    department: '',
    position: ''
  });

  // Fetch user profile on mount
  useEffect(() => {
    const getCurrentUserProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('*')
          .eq('user_id', user.id)
          .single();
        setProfile(profileData);
      }
    };
    getCurrentUserProfile();
  }, []);

  // Fetch divisions for dropdown
  useEffect(() => {
    const fetchDivisions = async () => {
      const { data, error } = await supabase
        .from('divisions')
        .select('name')
        .eq('is_active', true)
        .order('name');
      
      if (!error && data) {
        setDivisions(data.map(d => d.name));
      }
    };
    
    if (isAdmin) {
      fetchDivisions();
    }
  }, [isAdmin]);

  const fetchEmployees = async () => {
    try {
      let data, error;
      
      if (isAdmin) {
        // Admin gets full employee data
        const result = await supabase
          .from('employees')
          .select('*')
          .order('created_at', { ascending: false });
        data = result.data;
        error = result.error;
      } else {
        // Non-admin gets directory view
        const result = await supabase
          .from('employee_directory')
          .select('*')
          .order('full_name');
        data = result.data;
        error = result.error;
      }

      if (error) throw error;
      setEmployees((data as Employee[]) || []);
    } catch (error) {
      console.error('Error fetching employees:', error);
      toast({
        title: 'Error',
        description: 'Failed to load employees',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Only fetch employees after profile is loaded
    if (profile !== null) {
      fetchEmployees();
    }
  }, [profile, isAdmin]);

  const validateStaffId = (value: string) => {
    if (!/^\d{4}$/.test(value)) {
      setStaffIdError('Staff ID must be 4 digits (e.g., 0032)');
      return false;
    }
    setStaffIdError('');
    return true;
  };

  const handleStaffIdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setFormData({ ...formData, staff_id: value });
    if (value) validateStaffId(value);
  };

  const handleAddNewDivision = async () => {
    if (!newDivisionName.trim()) return;
    
    const { error } = await supabase
      .from('divisions')
      .insert({ name: newDivisionName.trim() });
    
    if (error) {
      toast({
        title: 'Error',
        description: 'Failed to add division',
        variant: 'destructive',
      });
      return;
    }
    
    setDivisions([...divisions, newDivisionName.trim()].sort());
    setFormData({ ...formData, division: newDivisionName.trim() });
    setNewDivisionName('');
    setIsAddingNewDivision(false);
    
    toast({
      title: 'Success',
      description: 'Division added successfully',
    });
  };

  const handleResetPassword = async (employee: Employee) => {
    if (!employee.email) {
      toast({
        title: 'Error',
        description: 'Employee email not found',
        variant: 'destructive',
      });
      return;
    }

    if (!window.confirm(
      `Send password reset link to ${employee.full_name} (${employee.email})?`
    )) {
      return;
    }

    setResettingPassword(employee.id);
    
    try {
      const { data, error } = await supabase.functions.invoke('admin-reset-password', {
        body: {
          user_email: employee.email,
          user_name: employee.full_name
        }
      });

      if (error) throw error;

      toast({
        title: 'Success',
        description: `Password reset link sent to ${employee.email}`,
      });
    } catch (error: any) {
      console.error('Error resetting password:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to send password reset link',
        variant: 'destructive',
      });
    } finally {
      setResettingPassword(null);
    }
  };

  const handleInviteUser = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate staff_id before submitting
    if (!validateStaffId(formData.staff_id)) {
      toast({
        title: 'Validation Error',
        description: 'Please enter a valid 4-digit Staff ID',
        variant: 'destructive',
      });
      return;
    }

    setInviting(true);

    try {
      const { data, error } = await supabase.functions.invoke('invite-user', {
        body: formData
      });

      if (error) throw error;

      toast({
        title: 'Success',
        description: data.message,
      });

      // Reset form
      setFormData({
        email: '',
        full_name: '',
        role: 'staff',
        staff_id: '',
        division: '',
        department: '',
        position: ''
      });
      setStaffIdError('');

      // Refresh employees list
      fetchEmployees();
    } catch (error: any) {
      console.error('Error inviting user:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to invite user',
        variant: 'destructive',
      });
    } finally {
      setInviting(false);
    }
  };

  const handleEditEmployee = async (employee: Employee) => {
    // Fetch the user's role
    const { data: employeeData } = await supabase
      .from('employees')
      .select('user_id')
      .eq('id', employee.id)
      .single();

    if (employeeData?.user_id) {
      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', employeeData.user_id)
        .single();

      setEditingEmployee({
        ...employee,
        role: roleData?.role || 'staff'
      } as any);
    } else {
      setEditingEmployee(employee);
    }
    
    setIsEditDialogOpen(true);
    setEditStaffIdError('');
  };

  const handleUpdateEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEmployee) return;

    // Validate staff_id
    if (!/^\d{4}$/.test(editingEmployee.staff_id || '')) {
      setEditStaffIdError('Staff ID must be 4 digits (e.g., 0032)');
      return;
    }

    setUpdating(true);

    try {
      const { data, error } = await supabase.functions.invoke('update-user', {
        body: {
          employee_id: editingEmployee.id,
          full_name: editingEmployee.full_name,
          email: editingEmployee.email,
          staff_id: editingEmployee.staff_id,
          role: (editingEmployee as any).role || 'staff',
          division: editingEmployee.division || '',
          department: editingEmployee.department,
          position: editingEmployee.position,
          status: editingEmployee.status
        }
      });

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'User updated successfully',
      });

      setIsEditDialogOpen(false);
      setEditingEmployee(null);
      fetchEmployees();
    } catch (error: any) {
      console.error('Error updating user:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to update user',
        variant: 'destructive',
      });
    } finally {
      setUpdating(false);
    }
  };

  const handleToggleStatus = async () => {
    if (!statusToggleEmployee) return;

    setTogglingStatus(true);

    try {
      const newStatus = statusToggleEmployee.status === 'active' ? 'inactive' : 'active';
      
      const { error } = await supabase.functions.invoke('update-user', {
        body: {
          employee_id: statusToggleEmployee.id,
          full_name: statusToggleEmployee.full_name,
          email: statusToggleEmployee.email,
          staff_id: statusToggleEmployee.staff_id,
          role: 'staff',
          division: statusToggleEmployee.division || '',
          department: statusToggleEmployee.department,
          position: statusToggleEmployee.position,
          status: newStatus
        }
      });

      if (error) throw error;

      toast({
        title: 'Success',
        description: `User ${newStatus === 'active' ? 'activated' : 'deactivated'} successfully`,
      });

      setStatusToggleEmployee(null);
      fetchEmployees();
    } catch (error: any) {
      console.error('Error toggling status:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to update user status',
        variant: 'destructive',
      });
    } finally {
      setTogglingStatus(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          <h2 className="text-2xl font-semibold">User Management</h2>
        </div>
      </div>

      {/* Invite User Form - Only for Admins */}
      {isAdmin && (
        <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Invite New User
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleInviteUser} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="full_name">Full Name *</Label>
                <Input
                  id="full_name"
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="staff_id">Staff ID *</Label>
                <Input
                  id="staff_id"
                  value={formData.staff_id}
                  onChange={handleStaffIdChange}
                  placeholder="e.g., 0032"
                  maxLength={4}
                  required
                  className="font-mono"
                />
                {staffIdError && (
                  <p className="text-sm text-destructive">{staffIdError}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="role">Role *</Label>
                <Select value={formData.role} onValueChange={(value) => setFormData({ ...formData, role: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="staff">Staff</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="division">Division *</Label>
                {!isAddingNewDivision ? (
                  <div className="flex gap-2">
                    <Select 
                      value={formData.division} 
                      onValueChange={(value) => {
                        if (value === '__add_new__') {
                          setIsAddingNewDivision(true);
                        } else {
                          setFormData({ ...formData, division: value });
                        }
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select division" />
                      </SelectTrigger>
                      <SelectContent>
                        {divisions.map((div) => (
                          <SelectItem key={div} value={div}>
                            {div}
                          </SelectItem>
                        ))}
                        <SelectItem value="__add_new__">
                          + Add New Division
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <Input
                      value={newDivisionName}
                      onChange={(e) => setNewDivisionName(e.target.value)}
                      placeholder="Enter new division name"
                      autoFocus
                    />
                    <Button 
                      type="button" 
                      onClick={handleAddNewDivision}
                      size="sm"
                    >
                      Add
                    </Button>
                    <Button 
                      type="button" 
                      variant="outline"
                      onClick={() => {
                        setIsAddingNewDivision(false);
                        setNewDivisionName('');
                      }}
                      size="sm"
                    >
                      Cancel
                    </Button>
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="department">Department *</Label>
                <Input
                  id="department"
                  value={formData.department}
                  onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="position">Designation *</Label>
                <Input
                  id="position"
                  value={formData.position}
                  onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                  required
                />
              </div>
            </div>
            <Button type="submit" disabled={inviting} className="w-full">
              {inviting ? 'Inviting...' : 'Invite User'}
            </Button>
          </form>
        </CardContent>
      </Card>
      )}

      {/* Users List */}
      <Card>
        <CardHeader>
          <CardTitle>Current Users</CardTitle>
          {!isAdmin && (
            <p className="text-sm text-muted-foreground">
              Directory view - Contact admin for full employee management
            </p>
          )}
        </CardHeader>
        <CardContent>
          {loading ? (
            <p>Loading employees...</p>
          ) : (
            <Table>
              <TableHeader>
                  <TableRow>
                    <TableHead>Employee ID</TableHead>
                    <TableHead>Staff ID</TableHead>
                    <TableHead>Name</TableHead>
                    {isAdmin && <TableHead>Email</TableHead>}
                    <TableHead>Division</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Designation</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Hire Date</TableHead>
                    {isAdmin && <TableHead>Actions</TableHead>}
                  </TableRow>
              </TableHeader>
              <TableBody>
                {employees.map((employee) => (
                  <TableRow key={employee.id}>
                    <TableCell className="font-medium">{employee.employee_id}</TableCell>
                    <TableCell className="font-mono">{employee.staff_id || 'N/A'}</TableCell>
                    <TableCell>{employee.full_name}</TableCell>
                    {isAdmin && <TableCell>{employee.email || 'N/A'}</TableCell>}
                    <TableCell>{employee.division || 'N/A'}</TableCell>
                    <TableCell>{employee.department}</TableCell>
                    <TableCell>{employee.position}</TableCell>
                    <TableCell>
                      <Badge variant={employee.status === 'active' ? 'default' : 'secondary'}>
                        {employee.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{employee.hire_date ? new Date(employee.hire_date).toLocaleDateString() : 'N/A'}</TableCell>
                    {isAdmin && (
                      <TableCell>
                        <TooltipProvider>
                          <div className="flex gap-1 justify-end">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleEditEmployee(employee)}
                                  className="gap-2"
                                >
                                  <Pencil className="h-4 w-4" />
                                  <span className="hidden md:inline">Edit</span>
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Edit user details</p>
                              </TooltipContent>
                            </Tooltip>

                            <DropdownMenu>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="outline" size="sm">
                                      <MoreVertical className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>More actions</p>
                                </TooltipContent>
                              </Tooltip>
                              <DropdownMenuContent align="end" className="w-48">
                                <DropdownMenuItem
                                  onClick={() => handleResetPassword(employee)}
                                  disabled={resettingPassword === employee.id || !employee.email}
                                  className="gap-2 cursor-pointer"
                                >
                                  {resettingPassword === employee.id ? (
                                    <>
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                      Sending...
                                    </>
                                  ) : (
                                    <>
                                      <KeyRound className="h-4 w-4" />
                                      Reset Password
                                    </>
                                  )}
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => setStatusToggleEmployee(employee)}
                                  className="gap-2 cursor-pointer"
                                >
                                  {employee.status === 'active' ? (
                                    <>
                                      <UserX className="h-4 w-4" />
                                      Deactivate User
                                    </>
                                  ) : (
                                    <>
                                      <UserCheck className="h-4 w-4" />
                                      Activate User
                                    </>
                                  )}
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </TooltipProvider>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Edit User Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
          </DialogHeader>
          {editingEmployee && (
            <form onSubmit={handleUpdateEmployee} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-email">Email *</Label>
                  <Input
                    id="edit-email"
                    type="email"
                    value={editingEmployee.email || ''}
                    onChange={(e) => setEditingEmployee({ ...editingEmployee, email: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-full_name">Full Name *</Label>
                  <Input
                    id="edit-full_name"
                    value={editingEmployee.full_name}
                    onChange={(e) => setEditingEmployee({ ...editingEmployee, full_name: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-staff_id">Staff ID *</Label>
                  <Input
                    id="edit-staff_id"
                    value={editingEmployee.staff_id || ''}
                    onChange={(e) => {
                      setEditingEmployee({ ...editingEmployee, staff_id: e.target.value });
                      if (e.target.value && !/^\d{4}$/.test(e.target.value)) {
                        setEditStaffIdError('Staff ID must be 4 digits');
                      } else {
                        setEditStaffIdError('');
                      }
                    }}
                    placeholder="e.g., 0032"
                    maxLength={4}
                    required
                    className="font-mono"
                  />
                  {editStaffIdError && (
                    <p className="text-sm text-destructive">{editStaffIdError}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-role">Role *</Label>
                  <Select 
                    value={(editingEmployee as any).role || 'staff'} 
                    onValueChange={(value) => setEditingEmployee({ ...editingEmployee, role: value } as any)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="staff">Staff</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-division">Division</Label>
                  <Select 
                    value={editingEmployee.division || ''} 
                    onValueChange={(value) => setEditingEmployee({ ...editingEmployee, division: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select division" />
                    </SelectTrigger>
                    <SelectContent>
                      {divisions.map((div) => (
                        <SelectItem key={div} value={div}>
                          {div}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-department">Department *</Label>
                  <Input
                    id="edit-department"
                    value={editingEmployee.department}
                    onChange={(e) => setEditingEmployee({ ...editingEmployee, department: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-position">Designation *</Label>
                  <Input
                    id="edit-position"
                    value={editingEmployee.position}
                    onChange={(e) => setEditingEmployee({ ...editingEmployee, position: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-status">Status *</Label>
                  <Select 
                    value={editingEmployee.status} 
                    onValueChange={(value) => setEditingEmployee({ ...editingEmployee, status: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsEditDialogOpen(false);
                    setEditingEmployee(null);
                    setEditStaffIdError('');
                  }}
                  disabled={updating}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={updating}>
                  {updating ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Status Toggle Confirmation Dialog */}
      <AlertDialog open={!!statusToggleEmployee} onOpenChange={() => setStatusToggleEmployee(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {statusToggleEmployee?.status === 'active' ? 'Deactivate User' : 'Activate User'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {statusToggleEmployee?.status === 'active' 
                ? `Are you sure you want to deactivate ${statusToggleEmployee?.full_name}? They will no longer be able to access the system.`
                : `Are you sure you want to activate ${statusToggleEmployee?.full_name}? They will regain access to the system.`
              }
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={togglingStatus}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleToggleStatus} disabled={togglingStatus}>
              {togglingStatus ? 'Processing...' : 'Confirm'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};