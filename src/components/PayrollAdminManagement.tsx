import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import {
  DollarSign,
  Upload,
  Download,
  Pencil,
  Trash2,
  Eye,
  Plus,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface PayrollRecord {
  id: string;
  employee_id: string;
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
  status: string;
  notes: string | null;
  payslip_pdf_url: string | null;
  full_name: string;
  emp_number: string;
  email: string;
}

interface Employee {
  id: string;
  full_name: string;
  employee_id: string;
  email: string;
}

interface FormData {
  employee_id: string;
  pay_period_start: string;
  pay_period_end: string;
  payment_date: string;
  fixed_salary: number;
  variable_salary: number;
  allowances: number;
  deductions_tax: number;
  deductions_insurance: number;
  deductions_pension: number;
  deductions_other: number;
  status: string;
  notes: string;
}

export const PayrollAdminManagement = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<PayrollRecord | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filterEmployee, setFilterEmployee] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");

  const [formData, setFormData] = useState<FormData>({
    employee_id: "",
    pay_period_start: "",
    pay_period_end: "",
    payment_date: "",
    fixed_salary: 0,
    variable_salary: 0,
    allowances: 0,
    deductions_tax: 0,
    deductions_insurance: 0,
    deductions_pension: 0,
    deductions_other: 0,
    status: "draft",
    notes: "",
  });

  // Fetch employees
  const { data: employees = [] } = useQuery({
    queryKey: ["employees-for-payroll"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employees")
        .select("id, full_name, employee_id, email")
        .eq("status", "active")
        .order("full_name");

      if (error) throw error;
      return data as Employee[];
    },
  });

  // Fetch payroll records
  const { data: payrollRecords = [], isLoading } = useQuery({
    queryKey: ["payroll-admin-records"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payroll_records")
        .select(
          `
          *,
          employees!inner (
            full_name,
            employee_id,
            email
          )
        `
        )
        .neq("status", "cancelled")
        .order("payment_date", { ascending: false });

      if (error) throw error;

      return data.map((record: any) => ({
        ...record,
        full_name: record.employees.full_name,
        emp_number: record.employees.employee_id,
        email: record.employees.email,
      })) as PayrollRecord[];
    },
  });

  // Filter records
  const filteredRecords = payrollRecords.filter((record) => {
    const matchesEmployee =
      filterEmployee === "all" || record.employee_id === filterEmployee;
    const matchesStatus =
      filterStatus === "all" || record.status === filterStatus;
    const matchesSearch =
      searchTerm === "" ||
      record.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      format(new Date(record.pay_period_start), "yyyy-MM").includes(searchTerm);
    return matchesEmployee && matchesStatus && matchesSearch;
  });

  // Upload payslip
  const uploadPayslip = async (
    file: File,
    employeeId: string,
    periodDate: string
  ): Promise<string> => {
    const month = format(new Date(periodDate), "yyyy-MM");
    const fileName = `${employeeId}_${month}.pdf`;
    const filePath = `payslips/${employeeId}/${fileName}`;

    const { error } = await supabase.storage
      .from("payslip-documents")
      .upload(filePath, file, { upsert: true });

    if (error) throw error;

    return filePath;
  };

  // Download payslip
  const downloadPayslip = async (payslipPath: string, employeeName: string) => {
    const { data, error } = await supabase.storage
      .from("payslip-documents")
      .download(payslipPath);

    if (error) {
      toast({
        title: "Download Failed",
        description: "Failed to download payslip",
        variant: "destructive",
      });
      return;
    }

    const url = URL.createObjectURL(data);
    const a = document.createElement("a");
    a.href = url;
    a.download = `payslip_${employeeName}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Create record mutation
  const createMutation = useMutation({
    mutationFn: async () => {
      const { data: userData } = await supabase.auth.getUser();

      let payslipUrl = null;
      if (selectedFile) {
        payslipUrl = await uploadPayslip(
          selectedFile,
          formData.employee_id,
          formData.pay_period_start
        );
      }

      const { error } = await supabase.from("payroll_records").insert({
        employee_id: formData.employee_id,
        pay_period_start: formData.pay_period_start,
        pay_period_end: formData.pay_period_end,
        payment_date: formData.payment_date,
        fixed_salary: formData.fixed_salary,
        variable_salary: formData.variable_salary,
        allowances: formData.allowances,
        deductions_tax: formData.deductions_tax,
        deductions_insurance: formData.deductions_insurance,
        deductions_pension: formData.deductions_pension,
        deductions_other: formData.deductions_other,
        payslip_pdf_url: payslipUrl,
        status: formData.status,
        notes: formData.notes,
        created_by: userData.user?.id,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payroll-admin-records"] });
      setIsAddDialogOpen(false);
      resetForm();
      toast({
        title: "Success",
        description: "Payroll record created successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to create record: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  // Update record mutation
  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!selectedRecord) return;

      let payslipUrl = selectedRecord.payslip_pdf_url;
      if (selectedFile) {
        payslipUrl = await uploadPayslip(
          selectedFile,
          formData.employee_id,
          formData.pay_period_start
        );
      }

      const { error } = await supabase
        .from("payroll_records")
        .update({
          employee_id: formData.employee_id,
          pay_period_start: formData.pay_period_start,
          pay_period_end: formData.pay_period_end,
          payment_date: formData.payment_date,
          fixed_salary: formData.fixed_salary,
          variable_salary: formData.variable_salary,
          allowances: formData.allowances,
          deductions_tax: formData.deductions_tax,
          deductions_insurance: formData.deductions_insurance,
          deductions_pension: formData.deductions_pension,
          deductions_other: formData.deductions_other,
          payslip_pdf_url: payslipUrl,
          status: formData.status,
          notes: formData.notes,
        })
        .eq("id", selectedRecord.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payroll-admin-records"] });
      setIsEditDialogOpen(false);
      setSelectedRecord(null);
      resetForm();
      toast({
        title: "Success",
        description: "Payroll record updated successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to update record: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  // Delete record mutation
  const deleteMutation = useMutation({
    mutationFn: async (recordId: string) => {
      const { error } = await supabase
        .from("payroll_records")
        .update({ status: "cancelled" })
        .eq("id", recordId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payroll-admin-records"] });
      setIsDeleteDialogOpen(false);
      setSelectedRecord(null);
      toast({
        title: "Success",
        description: "Payroll record cancelled successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to cancel record: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setFormData({
      employee_id: "",
      pay_period_start: "",
      pay_period_end: "",
      payment_date: "",
      fixed_salary: 0,
      variable_salary: 0,
      allowances: 0,
      deductions_tax: 0,
      deductions_insurance: 0,
      deductions_pension: 0,
      deductions_other: 0,
      status: "draft",
      notes: "",
    });
    setSelectedFile(null);
  };

  const openEditDialog = (record: PayrollRecord) => {
    setSelectedRecord(record);
    setFormData({
      employee_id: record.employee_id,
      pay_period_start: record.pay_period_start,
      pay_period_end: record.pay_period_end,
      payment_date: record.payment_date,
      fixed_salary: record.fixed_salary,
      variable_salary: record.variable_salary,
      allowances: record.allowances,
      deductions_tax: record.deductions_tax,
      deductions_insurance: record.deductions_insurance,
      deductions_pension: record.deductions_pension,
      deductions_other: record.deductions_other,
      status: record.status,
      notes: record.notes || "",
    });
    setIsEditDialogOpen(true);
  };

  const openDeleteDialog = (record: PayrollRecord) => {
    setSelectedRecord(record);
    setIsDeleteDialogOpen(true);
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive"> = {
      draft: "secondary",
      paid: "default",
      cancelled: "destructive",
    };
    return <Badge variant={variants[status] || "default"}>{status}</Badge>;
  };

  const grossPay =
    formData.fixed_salary + formData.variable_salary + formData.allowances;
  const totalDeductions =
    formData.deductions_tax +
    formData.deductions_insurance +
    formData.deductions_pension +
    formData.deductions_other;
  const netPay = grossPay - totalDeductions;

  const renderFormDialog = (isEdit: boolean) => (
    <Dialog
      open={isEdit ? isEditDialogOpen : isAddDialogOpen}
      onOpenChange={isEdit ? setIsEditDialogOpen : setIsAddDialogOpen}
    >
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Edit Payroll Record" : "Add Payroll Record"}
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {/* Employee Selection */}
          <div className="grid gap-2">
            <Label htmlFor="employee">Employee</Label>
            <Select
              value={formData.employee_id}
              onValueChange={(value) =>
                setFormData({ ...formData, employee_id: value })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select employee" />
              </SelectTrigger>
              <SelectContent>
                {employees.map((emp) => (
                  <SelectItem key={emp.id} value={emp.id}>
                    {emp.full_name} ({emp.employee_id})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Pay Period */}
          <div className="grid grid-cols-3 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="period_start">Period Start</Label>
              <Input
                id="period_start"
                type="date"
                value={formData.pay_period_start}
                onChange={(e) =>
                  setFormData({ ...formData, pay_period_start: e.target.value })
                }
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="period_end">Period End</Label>
              <Input
                id="period_end"
                type="date"
                value={formData.pay_period_end}
                onChange={(e) =>
                  setFormData({ ...formData, pay_period_end: e.target.value })
                }
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="payment_date">Payment Date</Label>
              <Input
                id="payment_date"
                type="date"
                value={formData.payment_date}
                onChange={(e) =>
                  setFormData({ ...formData, payment_date: e.target.value })
                }
              />
            </div>
          </div>

          {/* Salary Components */}
          <div className="grid grid-cols-3 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="fixed_salary">Fixed Salary</Label>
              <Input
                id="fixed_salary"
                type="number"
                min="0"
                step="0.01"
                value={formData.fixed_salary}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    fixed_salary: parseFloat(e.target.value) || 0,
                  })
                }
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="variable_salary">Variable Salary</Label>
              <Input
                id="variable_salary"
                type="number"
                min="0"
                step="0.01"
                value={formData.variable_salary}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    variable_salary: parseFloat(e.target.value) || 0,
                  })
                }
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="allowances">Allowances</Label>
              <Input
                id="allowances"
                type="number"
                min="0"
                step="0.01"
                value={formData.allowances}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    allowances: parseFloat(e.target.value) || 0,
                  })
                }
              />
            </div>
          </div>

          {/* Deductions */}
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="deductions_tax">Tax</Label>
              <Input
                id="deductions_tax"
                type="number"
                min="0"
                step="0.01"
                value={formData.deductions_tax}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    deductions_tax: parseFloat(e.target.value) || 0,
                  })
                }
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="deductions_insurance">Insurance</Label>
              <Input
                id="deductions_insurance"
                type="number"
                min="0"
                step="0.01"
                value={formData.deductions_insurance}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    deductions_insurance: parseFloat(e.target.value) || 0,
                  })
                }
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="deductions_pension">Pension</Label>
              <Input
                id="deductions_pension"
                type="number"
                min="0"
                step="0.01"
                value={formData.deductions_pension}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    deductions_pension: parseFloat(e.target.value) || 0,
                  })
                }
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="deductions_other">Other Deductions</Label>
              <Input
                id="deductions_other"
                type="number"
                min="0"
                step="0.01"
                value={formData.deductions_other}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    deductions_other: parseFloat(e.target.value) || 0,
                  })
                }
              />
            </div>
          </div>

          {/* Calculated Totals */}
          <div className="grid grid-cols-3 gap-4 p-4 bg-muted rounded-lg">
            <div>
              <Label className="text-muted-foreground">Gross Pay</Label>
              <p className="text-lg font-semibold">
                AED {grossPay.toFixed(2)}
              </p>
            </div>
            <div>
              <Label className="text-muted-foreground">Total Deductions</Label>
              <p className="text-lg font-semibold">
                AED {totalDeductions.toFixed(2)}
              </p>
            </div>
            <div>
              <Label className="text-muted-foreground">Net Pay</Label>
              <p className="text-lg font-semibold text-primary">
                AED {netPay.toFixed(2)}
              </p>
            </div>
          </div>

          {/* PDF Upload */}
          <div className="grid gap-2">
            <Label htmlFor="payslip">Payslip PDF</Label>
            <Input
              id="payslip"
              type="file"
              accept=".pdf"
              onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
            />
            {isEdit && selectedRecord?.payslip_pdf_url && !selectedFile && (
              <p className="text-sm text-muted-foreground">
                Current file uploaded. Upload new file to replace.
              </p>
            )}
          </div>

          {/* Status and Notes */}
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="status">Status</Label>
              <Select
                value={formData.status}
                onValueChange={(value) =>
                  setFormData({ ...formData, status: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="notes">Notes (Optional)</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) =>
                setFormData({ ...formData, notes: e.target.value })
              }
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              isEdit ? setIsEditDialogOpen(false) : setIsAddDialogOpen(false);
              resetForm();
            }}
          >
            Cancel
          </Button>
          <Button
            onClick={() =>
              isEdit ? updateMutation.mutate() : createMutation.mutate()
            }
            disabled={
              !formData.employee_id ||
              !formData.pay_period_start ||
              !formData.pay_period_end ||
              !formData.payment_date ||
              createMutation.isPending ||
              updateMutation.isPending
            }
          >
            {createMutation.isPending || updateMutation.isPending ? (
              "Saving..."
            ) : isEdit ? (
              "Update Record"
            ) : (
              "Create Record"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Payroll Management (Admin)
          </CardTitle>
          <Button
            onClick={() => {
              resetForm();
              setIsAddDialogOpen(true);
            }}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Record
          </Button>
        </div>
      </CardHeader>

      <CardContent>
        {/* Filters */}
        <div className="flex gap-4 mb-4">
          <Select value={filterEmployee} onValueChange={setFilterEmployee}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Filter by employee" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Employees</SelectItem>
              {employees.map((emp) => (
                <SelectItem key={emp.id} value={emp.id}>
                  {emp.full_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
            </SelectContent>
          </Select>

          <Input
            placeholder="Search by name or month (YYYY-MM)"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="max-w-xs"
          />
        </div>

        {/* Table */}
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Pay Period</TableHead>
                <TableHead className="text-right">Fixed</TableHead>
                <TableHead className="text-right">Variable</TableHead>
                <TableHead className="text-right">Gross Pay</TableHead>
                <TableHead className="text-right">Deductions</TableHead>
                <TableHead className="text-right">Net Pay</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Payment Date</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center">
                    Loading...
                  </TableCell>
                </TableRow>
              ) : filteredRecords.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center">
                    No payroll records found
                  </TableCell>
                </TableRow>
              ) : (
                filteredRecords.map((record) => (
                  <TableRow key={record.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{record.full_name}</div>
                        <div className="text-sm text-muted-foreground">
                          {record.emp_number}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {format(new Date(record.pay_period_start), "MMM yyyy")}
                    </TableCell>
                    <TableCell className="text-right">
                      {record.fixed_salary.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right">
                      {record.variable_salary.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right">
                      {record.gross_pay.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right">
                      {record.total_deductions.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right font-semibold text-primary">
                      {record.net_pay.toFixed(2)}
                    </TableCell>
                    <TableCell>{getStatusBadge(record.status)}</TableCell>
                    <TableCell>
                      {format(new Date(record.payment_date), "MMM dd, yyyy")}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        {record.payslip_pdf_url && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() =>
                              downloadPayslip(
                                record.payslip_pdf_url!,
                                record.full_name
                              )
                            }
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditDialog(record)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openDeleteDialog(record)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>

      {/* Dialogs */}
      {renderFormDialog(false)}
      {renderFormDialog(true)}

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Payroll Record?</AlertDialogTitle>
            <AlertDialogDescription>
              This will mark the payroll record as cancelled. This action cannot
              be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                selectedRecord && deleteMutation.mutate(selectedRecord.id)
              }
            >
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
};
