
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { AlertTriangle, Upload, X, CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface ExceptionRequestFormProps {
  attendanceId?: string;
  employeeId: string;
  onSuccess?: () => void;
}

export const ExceptionRequestForm = ({ attendanceId, employeeId, onSuccess }: ExceptionRequestFormProps) => {
  const [exceptionType, setExceptionType] = useState<'short_permission_personal' | 'short_permission_official' | 'wfh' | 'missed_clock_in' | 'missed_clock_out' | 'wrong_time' | ''>('');
  const [reason, setReason] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [targetDate, setTargetDate] = useState<Date>();
  const [proposedClockIn, setProposedClockIn] = useState('');
  const [proposedClockOut, setProposedClockOut] = useState('');
  const [durationHours, setDurationHours] = useState('');
  const { toast } = useToast();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      // Validate file size (max 5MB)
      if (selectedFile.size > 5 * 1024 * 1024) {
        toast({
          title: "Error",
          description: "File size must be less than 5MB",
          variant: "destructive"
        });
        return;
      }
      
      // Validate file type
      const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'application/pdf', 'text/plain'];
      if (!allowedTypes.includes(selectedFile.type)) {
        toast({
          title: "Error",
          description: "Only images, PDF, and text files are allowed",
          variant: "destructive"
        });
        return;
      }
      
      setFile(selectedFile);
    }
  };

  const uploadDocument = async (file: File): Promise<string | null> => {
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}.${fileExt}`;
      const filePath = `${employeeId}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('hr-documents')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      return filePath;
    } catch (error) {
      console.error('Error uploading file:', error);
      return null;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!exceptionType || !reason.trim()) return;

    const isNewPermissionType = ['short_permission_personal', 'short_permission_official', 'wfh'].includes(exceptionType);
    const isTimeBasedType = ['missed_clock_in', 'missed_clock_out', 'wrong_time'].includes(exceptionType);

    if (!targetDate) {
      toast({
        title: "Error",
        description: "Target date is required",
        variant: "destructive"
      });
      return;
    }

    // Validation for new permission types
    if (isNewPermissionType) {
      if (exceptionType === 'short_permission_personal') {
        const hours = parseFloat(durationHours);
        if (!durationHours || isNaN(hours) || hours <= 0 || hours > 2.5) {
          toast({
            title: "Error",
            description: "Duration must be between 0.5 and 2.5 hours",
            variant: "destructive"
          });
          return;
        }

        // Check existing approved permissions for the same date
        try {
          const { data: existingPermissions, error: checkError } = await supabase
            .from('attendance_exceptions')
            .select('duration_hours')
            .eq('employee_id', employeeId)
            .eq('exception_type', 'short_permission_personal')
            .eq('target_date', format(targetDate, 'yyyy-MM-dd'))
            .in('status', ['pending', 'approved']);

          if (checkError) throw checkError;

          const totalExistingHours = existingPermissions?.reduce(
            (sum, perm) => sum + (Number(perm.duration_hours) || 0), 
            0
          ) || 0;

          if (totalExistingHours + hours > 2.5) {
            toast({
              title: "Error",
              description: `You already have ${totalExistingHours} hours for this date. Total would exceed 2.5 hours daily limit.`,
              variant: "destructive"
            });
            return;
          }
        } catch (error) {
          console.error('Error checking existing permissions:', error);
        }
      }
    }

    // Validation for time-based exceptions
    if (isTimeBasedType) {
      const needsClockIn = exceptionType === 'missed_clock_in' || exceptionType === 'wrong_time';
      const needsClockOut = exceptionType === 'missed_clock_out' || exceptionType === 'wrong_time';

      if (needsClockIn && !proposedClockIn) {
        toast({
          title: "Error",
          description: "Proposed clock-in time is required",
          variant: "destructive"
        });
        return;
      }

      if (needsClockOut && !proposedClockOut) {
        toast({
          title: "Error",
          description: "Proposed clock-out time is required",
          variant: "destructive"
        });
        return;
      }
    }

    setLoading(true);
    try {
      let documentUrl = null;
      
      if (file) {
        documentUrl = await uploadDocument(file);
        if (!documentUrl) {
          throw new Error('Failed to upload document');
        }
      }

      // Convert time strings to full timestamps if needed
      let proposedInTime = null;
      let proposedOutTime = null;

      if (targetDate) {
        if (proposedClockIn) {
          const [hours, minutes] = proposedClockIn.split(':');
          proposedInTime = new Date(targetDate);
          proposedInTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);
        }

        if (proposedClockOut) {
          const [hours, minutes] = proposedClockOut.split(':');
          proposedOutTime = new Date(targetDate);
          proposedOutTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);
        }
      }

      const insertData: any = {
        attendance_id: attendanceId || null,
        employee_id: employeeId,
        exception_type: exceptionType,
        reason: reason.trim(),
        document_url: documentUrl,
        status: 'pending',
        target_date: format(targetDate, 'yyyy-MM-dd')
      };

      // Add duration_hours only for Personal Short Permission
      if (exceptionType === 'short_permission_personal') {
        insertData.duration_hours = parseFloat(durationHours);
      }

      // Add time fields only for time-based exceptions
      const isTimeBasedType = ['missed_clock_in', 'missed_clock_out', 'wrong_time'].includes(exceptionType);
      if (isTimeBasedType) {
        if (proposedInTime) {
          insertData.proposed_clock_in_time = proposedInTime.toISOString();
        }
        if (proposedOutTime) {
          insertData.proposed_clock_out_time = proposedOutTime.toISOString();
        }
      }

      const { error } = await supabase
        .from('attendance_exceptions')
        .insert(insertData);

      if (error) throw error;

      // Send email notification to admins
      let adminProfiles;
      let employeeData;
      
      try {
        // Get admin emails
        const { data: adminProfilesData } = await supabase
          .from('profiles')
          .select('email, full_name')
          .eq('role', 'admin');
        adminProfiles = adminProfilesData;

        // Get employee details
        const { data: employeeDataResult } = await supabase
          .from('employees')
          .select('full_name')
          .eq('id', employeeId)
          .single();
        employeeData = employeeDataResult;

        // Send email to each admin
        if (adminProfiles && adminProfiles.length > 0 && employeeData) {
          for (const admin of adminProfiles) {
            await supabase.functions.invoke('notify-email', {
              body: {
                type: 'attendance_exception',
                action: 'submitted',
                recipientEmail: admin.email,
                recipientName: admin.full_name,
                submitterName: employeeData.full_name,
                details: {
                  exceptionType: exceptionType,
                  reason: reason.trim()
                }
              }
            });
          }
        }
      } catch (emailError) {
        console.error('Failed to send admin notification:', emailError);
        console.error('Admin profiles data:', adminProfiles);
        console.error('Employee data:', employeeData);
        
        // Show a warning toast that notification may have failed
        toast({
          title: "Warning",
          description: "Request submitted, but admin notification may have failed",
          variant: "destructive"
        });
      }

      toast({
        title: "Success",
        description: "Exception request submitted successfully"
      });

      // Reset form
      setExceptionType('');
      setReason('');
      setFile(null);
      setTargetDate(undefined);
      setDurationHours('');
      setProposedClockIn('');
      setProposedClockOut('');
      
      if (onSuccess) {
        onSuccess();
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to submit exception request",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const removeFile = () => {
    setFile(null);
  };

  const needsDateTime = exceptionType && !['short_permission_personal', 'short_permission_official', 'wfh'].includes(exceptionType);
  const needsClockIn = exceptionType === 'missed_clock_in' || exceptionType === 'wrong_time';
  const needsClockOut = exceptionType === 'missed_clock_out' || exceptionType === 'wrong_time';

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5" />
          Request Exception Approval
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="exceptionType">Exception Type</Label>
            <Select value={exceptionType} onValueChange={setExceptionType as (value: string) => void}>
              <SelectTrigger>
                <SelectValue placeholder="Select exception type" />
              </SelectTrigger>
              <SelectContent>
                <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">Permission Requests</div>
                <SelectItem value="short_permission_personal">Short Permission (Personal)</SelectItem>
                <SelectItem value="short_permission_official">Short Permission (Official)</SelectItem>
                <SelectItem value="wfh">Work from Home (WFH)</SelectItem>
                <div className="my-1 h-px bg-border" />
                <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">Attendance Corrections</div>
                <SelectItem value="missed_clock_in">Missed Clock In</SelectItem>
                <SelectItem value="missed_clock_out">Missed Clock Out</SelectItem>
                <SelectItem value="wrong_time">Wrong Clock In/Out Time</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {!exceptionType ? null : (
            <div>
              <Label>Target Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !targetDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {targetDate ? format(targetDate, "PPP") : <span>Pick a date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={targetDate}
                    onSelect={setTargetDate}
                    disabled={(date) => date > new Date() || date < new Date("1900-01-01")}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
            </div>
          )}

          {exceptionType === 'short_permission_personal' && (
            <div>
              <Label htmlFor="duration">Duration (Hours) *</Label>
              <Input
                id="duration"
                type="number"
                step="0.5"
                min="0.5"
                max="2.5"
                value={durationHours}
                onChange={(e) => setDurationHours(e.target.value)}
                placeholder="e.g., 1.5"
                required
              />
              <p className="text-xs text-muted-foreground mt-1">
                Maximum 2.5 hours allowed per day for personal short permission
              </p>
            </div>
          )}

          {needsDateTime && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {needsClockIn && (
                  <div>
                    <Label htmlFor="proposedClockIn">Proposed Clock In Time</Label>
                    <Input
                      id="proposedClockIn"
                      type="time"
                      value={proposedClockIn}
                      onChange={(e) => setProposedClockIn(e.target.value)}
                      required={needsClockIn}
                    />
                  </div>
                )}

                {needsClockOut && (
                  <div>
                    <Label htmlFor="proposedClockOut">Proposed Clock Out Time</Label>
                    <Input
                      id="proposedClockOut"
                      type="time"
                      value={proposedClockOut}
                      onChange={(e) => setProposedClockOut(e.target.value)}
                      required={needsClockOut}
                    />
                  </div>
                )}
              </div>
            </>
          )}

          <div>
            <Label htmlFor="reason">Reason</Label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Please provide a detailed reason for your exception request..."
              rows={4}
              required
            />
          </div>

          <div>
            <Label htmlFor="document">Supporting Document (Optional)</Label>
            <div className="mt-2">
              {!file ? (
                <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6">
                  <div className="text-center">
                    <Upload className="mx-auto h-12 w-12 text-muted-foreground" />
                    <div className="mt-4">
                      <label htmlFor="file-upload" className="cursor-pointer">
                        <span className="mt-2 block text-sm font-medium text-foreground">
                          Upload a file
                        </span>
                        <span className="mt-1 block text-xs text-muted-foreground">
                          PNG, JPG, PDF up to 5MB
                        </span>
                      </label>
                      <input
                        id="file-upload"
                        name="file-upload"
                        type="file"
                        className="sr-only"
                        onChange={handleFileChange}
                        accept="image/*,.pdf,.txt"
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <div className="flex items-center gap-2">
                    <Upload className="h-4 w-4" />
                    <span className="text-sm">{file.name}</span>
                    <span className="text-xs text-muted-foreground">
                      ({(file.size / 1024).toFixed(1)} KB)
                    </span>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={removeFile}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          </div>

          <Button 
            type="submit" 
            disabled={
              loading || 
              !exceptionType || 
              !reason.trim() || 
              !targetDate ||
              (exceptionType === 'short_permission_personal' && !durationHours) ||
              (needsClockIn && !proposedClockIn) ||
              (needsClockOut && !proposedClockOut)
            }
          >
            {loading ? 'Submitting...' : 'Submit Request'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};
