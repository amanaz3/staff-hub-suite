import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";

interface PayslipData {
  employeeName: string;
  employeeId: string;
  email: string;
  payPeriodStart: string;
  payPeriodEnd: string;
  paymentDate: string;
  fixedSalary: number;
  variableSalary: number;
  allowances: number;
  grossPay: number;
  deductionsTax: number;
  deductionsInsurance: number;
  deductionsPension: number;
  deductionsOther: number;
  totalDeductions: number;
  netPay: number;
}

export const generatePayslipPDF = (data: PayslipData): Blob => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();

  // Company Header
  doc.setFillColor(59, 130, 246); // Primary blue color
  doc.rect(0, 0, pageWidth, 40, "F");

  // Company Name
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(24);
  doc.setFont("helvetica", "bold");
  doc.text("HR Flow", pageWidth / 2, 20, { align: "center" });

  doc.setFontSize(12);
  doc.setFont("helvetica", "normal");
  doc.text("Employee Payslip", pageWidth / 2, 30, { align: "center" });

  // Reset text color
  doc.setTextColor(0, 0, 0);

  // Payslip Title
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("PAYSLIP", 20, 55);

  // Pay Period Box
  doc.setFillColor(243, 244, 246);
  doc.roundedRect(pageWidth - 70, 45, 50, 20, 3, 3, "F");
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text("Pay Period", pageWidth - 45, 52, { align: "center" });
  doc.setFont("helvetica", "bold");
  doc.text(
    format(new Date(data.payPeriodStart), "MMM yyyy"),
    pageWidth - 45,
    60,
    { align: "center" }
  );

  // Employee Information Section
  let yPos = 75;
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("Employee Information", 20, yPos);

  yPos += 10;
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");

  const employeeInfo = [
    ["Employee Name:", data.employeeName],
    ["Employee ID:", data.employeeId],
    ["Email:", data.email],
    [
      "Pay Period:",
      `${format(new Date(data.payPeriodStart), "MMM dd, yyyy")} - ${format(
        new Date(data.payPeriodEnd),
        "MMM dd, yyyy"
      )}`,
    ],
    ["Payment Date:", format(new Date(data.paymentDate), "MMM dd, yyyy")],
  ];

  employeeInfo.forEach(([label, value]) => {
    doc.setFont("helvetica", "bold");
    doc.text(label, 20, yPos);
    doc.setFont("helvetica", "normal");
    doc.text(value, 70, yPos);
    yPos += 7;
  });

  // Earnings Section
  yPos += 10;
  autoTable(doc, {
    startY: yPos,
    head: [["Earnings", "Amount (AED)"]],
    body: [
      ["Fixed Salary", data.fixedSalary.toFixed(2)],
      ["Variable Salary", data.variableSalary.toFixed(2)],
      ["Allowances", data.allowances.toFixed(2)],
    ],
    foot: [["Gross Pay", data.grossPay.toFixed(2)]],
    theme: "striped",
    headStyles: {
      fillColor: [59, 130, 246],
      textColor: [255, 255, 255],
      fontStyle: "bold",
    },
    footStyles: {
      fillColor: [243, 244, 246],
      textColor: [0, 0, 0],
      fontStyle: "bold",
    },
    styles: {
      fontSize: 10,
    },
    columnStyles: {
      0: { cellWidth: 100 },
      1: { halign: "right", cellWidth: 70 },
    },
  });

  // Deductions Section
  yPos = (doc as any).lastAutoTable.finalY + 15;
  autoTable(doc, {
    startY: yPos,
    head: [["Deductions", "Amount (AED)"]],
    body: [
      ["Tax", data.deductionsTax.toFixed(2)],
      ["Insurance", data.deductionsInsurance.toFixed(2)],
      ["Pension", data.deductionsPension.toFixed(2)],
      ["Other Deductions", data.deductionsOther.toFixed(2)],
    ],
    foot: [["Total Deductions", data.totalDeductions.toFixed(2)]],
    theme: "striped",
    headStyles: {
      fillColor: [220, 38, 38],
      textColor: [255, 255, 255],
      fontStyle: "bold",
    },
    footStyles: {
      fillColor: [243, 244, 246],
      textColor: [0, 0, 0],
      fontStyle: "bold",
    },
    styles: {
      fontSize: 10,
    },
    columnStyles: {
      0: { cellWidth: 100 },
      1: { halign: "right", cellWidth: 70 },
    },
  });

  // Net Pay Section - Highlighted Box
  yPos = (doc as any).lastAutoTable.finalY + 15;
  doc.setFillColor(34, 197, 94);
  doc.roundedRect(20, yPos, pageWidth - 40, 25, 5, 5, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("NET PAY", 30, yPos + 10);
  doc.setFontSize(18);
  doc.text(
    `AED ${data.netPay.toFixed(2)}`,
    pageWidth - 30,
    yPos + 15,
    { align: "right" }
  );

  // Footer
  yPos += 40;
  doc.setTextColor(107, 114, 128);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(
    "This is a system-generated payslip and does not require a signature.",
    pageWidth / 2,
    yPos,
    { align: "center" }
  );
  doc.text(
    `Generated on ${format(new Date(), "MMM dd, yyyy HH:mm")}`,
    pageWidth / 2,
    yPos + 5,
    { align: "center" }
  );

  // Convert to blob
  return doc.output("blob");
};
