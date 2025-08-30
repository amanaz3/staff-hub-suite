
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
  const [exceptionType, setExceptionType] = useState<'late_arrival' | 'early_departure' | 'missed_clock_in' | 'missed_clock_out' | 'wrong_time' | ''>('');
  const [reason, setReason] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [targetDate, setTargetDate] = useState<Date>();
  const [proposedClockIn, setProposedClockIn] = useState('');
  const [proposedClockOut, setProposedClockOut] = useState('');
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

    // Validation for new exception types
    if (['missed_clock_in', 'missed_clock_out', 'wrong_time'].includes(exceptionType)) {
      if (!targetDate) {
        toast({
          title: "Error",
          description: "Target date is required for this exception type",
          variant: "destructive"
        });
        return;
      }

      if (exceptionType === 'missed_clock_in' && !proposedClockIn) {
        toast({
          title: "Error",
          description: "Proposed clock-in time is required",
          variant: "destructive"
        });
        return;
      }

      if (exceptionType === 'missed_clock_out' && !proposedClockOut) {
        toast({
          title: "Error",
          description: "Proposed clock-out time is required",
          variant: "destructive"
        });
        return;
      }

      if (exceptionType === 'wrong_time' && (!proposedClockIn || !proposedClockOut)) {
        toast({
          title: "Error",
          description: "Both proposed clock-in and clock-out times are required for wrong time correction",
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

      const { error } = await supabase
        .from('attendance_exceptions')
        .insert({
          attendance_id: attendanceId || null,
          employee_id: employeeId,
          exception_type: exceptionType,
          reason: reason.trim(),
          document_url: documentUrl,
          status: 'pending',
          target_date: targetDate ? format(targetDate, 'yyyy-MM-dd') : null,
          proposed_clock_in_time: proposedInTime?.toISOString(),
          proposed_clock_out_time: proposedOutTime?.toISOString()
        });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Exception request submitted successfully"
      });

      // Reset form
      setExceptionType('');
      setReason('');
      setFile(null);
      setTargetDate(undefined);
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

  const needsDateTime = ['missed_clock_in', 'missed_clock_out', 'wrong_time'].includes(exceptionType);
  const needsClockIn = ['missed_clock_in', 'wrong_time'].includes(exceptionType);
  const needsClockOut = ['missed_clock_out', 'wrong_time'].includes(exceptionType);

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
                <SelectItem value="late_arrival">Late Arrival</SelectItem>
                <SelectItem value="early_departure">Early Departure</SelectItem>
                <SelectItem value="missed_clock_in">Missed Clock In</SelectItem>
                <SelectItem value="missed_clock_out">Missed Clock Out</SelectItem>
                <SelectItem value="wrong_time">Wrong Clock In/Out Time</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {needsDateTime && (
            <>
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

          <Button type="submit" disabled={loading || !exceptionType || !reason.trim()}>
            {loading ? 'Submitting...' : 'Submit Request'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};
