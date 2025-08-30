import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { FileText, Upload, Calendar as CalendarIcon, AlertTriangle, Download, Eye } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface Employee {
  id: string;
  employee_id: string;
  full_name: string;
  email: string;
}

interface StaffDocument {
  id: string;
  employee_id: string;
  document_type: string;
  document_name: string;
  file_url: string;
  issue_date: string | null;
  expiry_date: string | null;
  status: string;
  notes: string | null;
  created_at: string;
  employees?: {
    full_name: string;
    employee_id: string;
  } | null;
}

const documentTypes = [
  { value: 'emirates_id', label: 'Emirates ID' },
  { value: 'passport', label: 'Passport' },
  { value: 'visa', label: 'Visa' },
  { value: 'driving_license', label: 'Driving License' },
  { value: 'work_permit', label: 'Work Permit' },
  { value: 'health_card', label: 'Health Card' },
  { value: 'insurance_card', label: 'Insurance Card' },
  { value: 'other', label: 'Other' }
];

export const DocumentManagement = () => {
  const [documents, setDocuments] = useState<StaffDocument[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const { toast } = useToast();
  
  // Form state
  const [formData, setFormData] = useState({
    employee_id: '',
    document_type: '',
    document_name: '',
    issue_date: null as Date | null,
    expiry_date: null as Date | null,
    notes: ''
  });

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Fetch documents with employee info
      const { data: docsData, error: docsError } = await supabase
        .from('staff_documents')
        .select(`
          *,
          employees!inner(
            full_name,
            employee_id
          )
        `)
        .eq('status', 'active')
        .order('created_at', { ascending: false });

      if (docsError) throw docsError;
      
      // Fetch employees for dropdown
      const { data: empData, error: empError } = await supabase
        .from('employees')
        .select('id, employee_id, full_name, email')
        .eq('status', 'active')
        .order('full_name');

      if (empError) throw empError;

      setDocuments((docsData as any[])?.map(doc => ({
        ...doc,
        employees: doc.employees || null
      })) || []);
      setEmployees(empData || []);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load documents and employees',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleFileUpload = async (file: File): Promise<string> => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}_${Math.random().toString(36).substring(2)}.${fileExt}`;
    const filePath = `documents/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('hr-documents')
      .upload(filePath, file);

    if (uploadError) throw uploadError;

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('hr-documents')
      .getPublicUrl(filePath);

    return publicUrl;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      toast({
        title: 'Error',
        description: 'Please select a file to upload',
        variant: 'destructive',
      });
      return;
    }

    setUploading(true);

    try {
      // Upload file
      const fileUrl = await handleFileUpload(selectedFile);

      // Save document record
      const { error } = await supabase
        .from('staff_documents')
        .insert({
          employee_id: formData.employee_id,
          document_type: formData.document_type,
          document_name: formData.document_name,
          file_url: fileUrl,
          issue_date: formData.issue_date?.toISOString().split('T')[0] || null,
          expiry_date: formData.expiry_date?.toISOString().split('T')[0] || null,
          notes: formData.notes || null,
          uploaded_by: (await supabase.auth.getUser()).data.user?.id
        });

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Document uploaded successfully',
      });

      // Reset form
      setFormData({
        employee_id: '',
        document_type: '',
        document_name: '',
        issue_date: null,
        expiry_date: null,
        notes: ''
      });
      setSelectedFile(null);
      setIsDialogOpen(false);

      // Refresh data
      fetchData();
    } catch (error: any) {
      console.error('Error uploading document:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to upload document',
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
    }
  };

  const getExpiryStatus = (expiryDate: string | null) => {
    if (!expiryDate) return null;
    
    const today = new Date();
    const expiry = new Date(expiryDate);
    const daysUntilExpiry = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysUntilExpiry < 0) {
      return { status: 'expired', message: 'Expired', color: 'destructive' };
    } else if (daysUntilExpiry <= 7) {
      return { status: 'critical', message: `Expires in ${daysUntilExpiry} days`, color: 'destructive' };
    } else if (daysUntilExpiry <= 30) {
      return { status: 'warning', message: `Expires in ${daysUntilExpiry} days`, color: 'secondary' };
    } else if (daysUntilExpiry <= 90) {
      return { status: 'notice', message: `Expires in ${daysUntilExpiry} days`, color: 'outline' };
    }
    return null;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          <h2 className="text-2xl font-semibold">Staff Documents</h2>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Upload className="h-4 w-4 mr-2" />
              Upload Document
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Upload New Document</DialogTitle>
            </DialogHeader>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="employee_id">Employee</Label>
                  <Select 
                    value={formData.employee_id} 
                    onValueChange={(value) => setFormData({ ...formData, employee_id: value })}
                    required
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select employee" />
                    </SelectTrigger>
                    <SelectContent>
                      {employees.map((employee) => (
                        <SelectItem key={employee.id} value={employee.id}>
                          {employee.full_name} ({employee.employee_id})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="document_type">Document Type</Label>
                  <Select 
                    value={formData.document_type} 
                    onValueChange={(value) => setFormData({ ...formData, document_type: value })}
                    required
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select document type" />
                    </SelectTrigger>
                    <SelectContent>
                      {documentTypes.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="document_name">Document Name</Label>
                  <Input
                    id="document_name"
                    value={formData.document_name}
                    onChange={(e) => setFormData({ ...formData, document_name: e.target.value })}
                    placeholder="e.g., John Doe - Emirates ID"
                    required
                  />
                </div>
                
                <div className="space-y-2">
                  <Label>Issue Date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !formData.issue_date && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {formData.issue_date ? format(formData.issue_date, "PPP") : "Pick a date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={formData.issue_date || undefined}
                        onSelect={(date) => setFormData({ ...formData, issue_date: date || null })}
                        initialFocus
                        className="p-3 pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                
                <div className="space-y-2">
                  <Label>Expiry Date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !formData.expiry_date && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {formData.expiry_date ? format(formData.expiry_date, "PPP") : "Pick a date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={formData.expiry_date || undefined}
                        onSelect={(date) => setFormData({ ...formData, expiry_date: date || null })}
                        initialFocus
                        className="p-3 pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="file">Document File</Label>
                  <Input
                    id="file"
                    type="file"
                    onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                    accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                    required
                  />
                </div>
                
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="notes">Notes (Optional)</Label>
                  <Textarea
                    id="notes"
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="Additional notes about this document"
                    rows={3}
                  />
                </div>
              </div>
              
              <div className="flex gap-2 pt-4">
                <Button type="submit" disabled={uploading} className="flex-1">
                  {uploading ? 'Uploading...' : 'Upload Document'}
                </Button>
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Documents Table */}
      <Card>
        <CardHeader>
          <CardTitle>Document Records</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p>Loading documents...</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Document Type</TableHead>
                  <TableHead>Document Name</TableHead>
                  <TableHead>Issue Date</TableHead>
                  <TableHead>Expiry Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {documents.map((doc) => {
                  const expiryStatus = getExpiryStatus(doc.expiry_date);
                  return (
                    <TableRow key={doc.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{doc.employees?.full_name}</p>
                          <p className="text-sm text-muted-foreground">{doc.employees?.employee_id}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        {documentTypes.find(t => t.value === doc.document_type)?.label || doc.document_type}
                      </TableCell>
                      <TableCell>{doc.document_name}</TableCell>
                      <TableCell>
                        {doc.issue_date ? format(new Date(doc.issue_date), 'PPP') : '-'}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          {doc.expiry_date ? format(new Date(doc.expiry_date), 'PPP') : '-'}
                          {expiryStatus && (
                            <Badge variant={expiryStatus.color as any} className="w-fit">
                              <AlertTriangle className="h-3 w-3 mr-1" />
                              {expiryStatus.message}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{doc.status}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => window.open(doc.file_url, '_blank')}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              const link = document.createElement('a');
                              link.href = doc.file_url;
                              link.download = doc.document_name;
                              link.click();
                            }}
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};