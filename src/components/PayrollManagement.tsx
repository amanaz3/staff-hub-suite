import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download, DollarSign, Receipt, TrendingUp, FileText } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

export const PayrollManagement = () => {
  const { profile } = useAuth();

  // Sample payroll data - will be replaced with actual data from database
  const currentSalary = {
    basic: 50000,
    allowances: 5000,
    grossTotal: 55000,
    taxDeductions: 8000,
    insurance: 2000,
    netSalary: 45000
  };

  const payslips = [
    { month: "Nov 2024", grossPay: 4583, deductions: 833, netPay: 3750 },
    { month: "Oct 2024", grossPay: 4583, deductions: 833, netPay: 3750 },
    { month: "Sep 2024", grossPay: 4583, deductions: 833, netPay: 3750 },
    { month: "Aug 2024", grossPay: 4583, deductions: 833, netPay: 3750 },
    { month: "Jul 2024", grossPay: 4583, deductions: 833, netPay: 3750 },
    { month: "Jun 2024", grossPay: 4583, deductions: 833, netPay: 3750 },
  ];

  const ytdSummary = {
    totalEarnings: 50416,
    totalDeductions: 9166,
    netPaid: 41250,
    monthsPaid: 11
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

      {/* Current Salary Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-primary" />
            Current Salary Information
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Basic Salary</span>
                <span className="font-semibold">${currentSalary.basic.toLocaleString()}/year</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Allowances</span>
                <span className="font-semibold">${currentSalary.allowances.toLocaleString()}/year</span>
              </div>
              <div className="flex justify-between items-center pt-3 border-t">
                <span className="font-medium">Total Gross</span>
                <span className="font-bold text-primary">${currentSalary.grossTotal.toLocaleString()}/year</span>
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Tax Deductions</span>
                <span className="font-semibold text-destructive">-${currentSalary.taxDeductions.toLocaleString()}/year</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Insurance</span>
                <span className="font-semibold text-destructive">-${currentSalary.insurance.toLocaleString()}/year</span>
              </div>
              <div className="flex justify-between items-center pt-3 border-t">
                <span className="font-medium">Net Salary</span>
                <span className="font-bold text-primary">${currentSalary.netSalary.toLocaleString()}/year</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* YTD Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            2024 Year-to-Date Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Total Earnings</p>
              <p className="text-2xl font-bold text-primary">${ytdSummary.totalEarnings.toLocaleString()}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Total Deductions</p>
              <p className="text-2xl font-bold text-destructive">${ytdSummary.totalDeductions.toLocaleString()}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Net Paid</p>
              <p className="text-2xl font-bold">${ytdSummary.netPaid.toLocaleString()}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Months Paid</p>
              <p className="text-2xl font-bold">{ytdSummary.monthsPaid}/12</p>
            </div>
          </div>
        </CardContent>
      </Card>

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
