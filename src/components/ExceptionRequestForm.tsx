import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { AlertTriangle, Upload, X } from 'lucide-react';

interface ExceptionRequestFormProps {
  attendanceId: string;
  employeeId: string;
  onSuccess?: () => void;
}

export const ExceptionRequestForm = ({ attendanceId, employeeId, onSuccess }: ExceptionRequestFormProps) => {
  const [exceptionType, setExceptionType] = useState<'late_arrival' | 'early_departure' | ''>('');
  const [reason, setReason] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
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

    setLoading(true);
    try {
      let documentUrl = null;
      
      if (file) {
        documentUrl = await uploadDocument(file);
        if (!documentUrl) {
          throw new Error('Failed to upload document');
        }
      }

      const { error } = await supabase
        .from('attendance_exceptions')
        .insert({
          attendance_id: attendanceId,
          employee_id: employeeId,
          exception_type: exceptionType,
          reason: reason.trim(),
          document_url: documentUrl,
          status: 'pending'
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
              </SelectContent>
            </Select>
          </div>

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