import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { UserPlus, Users, KeyRound, Loader2 } from 'lucide-react';

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
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleResetPassword(employee)}
                          disabled={resettingPassword === employee.id || !employee.email}
                          className="gap-2"
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
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};