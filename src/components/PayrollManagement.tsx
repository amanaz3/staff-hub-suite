import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download, Receipt, FileText, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { toast } from "sonner";

interface PayrollRecord {
  id: string;
  pay_period_start: string;
  pay_period_end: string;
  payment_date: string;
  fixed_salary: number;
  variable_salary: number;
  allowances: number;
  gross_pay: number;
  deductions_tax: number;
  deductions_insurance: number;
  deductions_pension: number;
  deductions_other: number;
  total_deductions: number;
  net_pay: number;
  payslip_pdf_url: string | null;
  status: string;
}

export const PayrollManagement = () => {
  const { profile } = useAuth();

  // Fetch employee ID
  const { data: employeeData } = useQuery({
    queryKey: ['employee', profile?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('employees')
        .select('id')
        .eq('user_id', profile?.user_id)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: !!profile?.user_id,
  });

  // Fetch payroll records
  const { data: payrollRecords, isLoading } = useQuery({
    queryKey: ['payroll-records', employeeData?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payroll_records')
        .select('*')
        .eq('employee_id', employeeData?.id)
        .eq('status', 'paid')
        .order('payment_date', { ascending: false })
        .limit(12);
      
      if (error) throw error;
      return data as PayrollRecord[];
    },
    enabled: !!employeeData?.id,
  });

  const handleDownloadPayslip = async (payslipUrl: string | null, month: string) => {
    if (!payslipUrl) {
      toast.error("Payslip not available");
      return;
    }

    try {
      // Extract the path from the full URL if it's a storage URL
      const path = payslipUrl.includes('payslip-documents/') 
        ? payslipUrl.split('payslip-documents/')[1] 
        : payslipUrl;

      const { data, error } = await supabase.storage
        .from('payslip-documents')
        .download(path);

      if (error) throw error;

      // Create a download link
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `payslip-${month}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success("Payslip downloaded successfully");
    } catch (error) {
      console.error('Error downloading payslip:', error);
      toast.error("Failed to download payslip");
    }
  };

  const handleDownloadAll = async () => {
    if (!payrollRecords || payrollRecords.length === 0) {
      toast.error("No payslips available to download");
      return;
    }

    toast.info("Downloading all payslips...");
    
    for (const record of payrollRecords) {
      if (record.payslip_pdf_url) {
        const month = format(new Date(record.payment_date), 'MMM yyyy');
        await handleDownloadPayslip(record.payslip_pdf_url, month);
        // Add a small delay between downloads
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Payroll</h1>
          <p className="text-muted-foreground mt-1">View your salary information and payslips</p>
        </div>
      </div>

      {/* Recent Payslips */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5 text-primary" />
              Recent Payslips
            </CardTitle>
            {payrollRecords && payrollRecords.length > 0 && (
              <Button variant="outline" size="sm" onClick={handleDownloadAll}>
                <FileText className="h-4 w-4 mr-2" />
                Download All
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : !payrollRecords || payrollRecords.length === 0 ? (
            <div className="text-center py-8">
              <Receipt className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No payslips available yet</p>
              <p className="text-sm text-muted-foreground mt-2">
                Your payslips will appear here once they are processed
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Period</TableHead>
                  <TableHead className="text-right">Fixed Salary</TableHead>
                  <TableHead className="text-right">Variable</TableHead>
                  <TableHead className="text-right">Gross Pay</TableHead>
                  <TableHead className="text-right">Deductions</TableHead>
                  <TableHead className="text-right">Net Pay</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payrollRecords.map((record) => {
                  const month = format(new Date(record.payment_date), 'MMM yyyy');
                  
                  return (
                    <TableRow key={record.id}>
                      <TableCell className="font-medium">{month}</TableCell>
                      <TableCell className="text-right">
                        ${record.fixed_salary.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right">
                        ${record.variable_salary.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        ${record.gross_pay.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right text-destructive">
                        -${record.total_deductions.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right font-bold text-primary">
                        ${record.net_pay.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => handleDownloadPayslip(record.payslip_pdf_url, month)}
                          disabled={!record.payslip_pdf_url}
                        >
                          <Download className="h-4 w-4" />
                        </Button>
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
