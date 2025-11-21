import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download, Receipt, FileText } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

export const PayrollManagement = () => {
  const { profile } = useAuth();

  // Sample payroll data - will be replaced with actual data from database
  const payslips = [
    { month: "Nov 2024", grossPay: 4583, deductions: 833, netPay: 3750 },
    { month: "Oct 2024", grossPay: 4583, deductions: 833, netPay: 3750 },
    { month: "Sep 2024", grossPay: 4583, deductions: 833, netPay: 3750 },
    { month: "Aug 2024", grossPay: 4583, deductions: 833, netPay: 3750 },
    { month: "Jul 2024", grossPay: 4583, deductions: 833, netPay: 3750 },
    { month: "Jun 2024", grossPay: 4583, deductions: 833, netPay: 3750 },
  ];

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
            <Button variant="outline" size="sm">
              <FileText className="h-4 w-4 mr-2" />
              Download All
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Month</TableHead>
                <TableHead className="text-right">Gross Pay</TableHead>
                <TableHead className="text-right">Deductions</TableHead>
                <TableHead className="text-right">Net Pay</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payslips.map((payslip, index) => (
                <TableRow key={index}>
                  <TableCell className="font-medium">{payslip.month}</TableCell>
                  <TableCell className="text-right">${payslip.grossPay.toLocaleString()}</TableCell>
                  <TableCell className="text-right text-destructive">-${payslip.deductions.toLocaleString()}</TableCell>
                  <TableCell className="text-right font-semibold">${payslip.netPay.toLocaleString()}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm">
                      <Download className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};
