import { format } from 'date-fns';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { AttendanceCalendarData } from '@/hooks/useAttendanceCalendar';

export function exportToCSV(
  data: AttendanceCalendarData,
  month: Date,
  employeeName: string
) {
  const rows = [
    ['Employee', employeeName],
    ['Month', format(month, 'MMMM yyyy')],
    [''],
    ['Date', 'Day', 'Status', 'Clock In', 'Clock Out', 'Total Hours', 'Late'],
    ...Array.from(data.days.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, status]) => [
        format(new Date(date), 'yyyy-MM-dd'),
        format(new Date(date), 'EEEE'),
        status.status.toUpperCase(),
        status.clockInTime ? format(new Date(status.clockInTime), 'HH:mm') : '-',
        status.clockOutTime ? format(new Date(status.clockOutTime), 'HH:mm') : '-',
        status.totalHours?.toFixed(2) || '-',
        status.isLate ? 'Yes' : 'No',
      ]),
  ];

  const csv = rows.map(row => row.join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `attendance-${format(month, 'yyyy-MM')}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportToPDF(
  data: AttendanceCalendarData,
  month: Date,
  employeeName: string
) {
  const doc = new jsPDF();

  // Header
  doc.setFontSize(20);
  doc.text('Attendance Report', 14, 20);
  
  doc.setFontSize(12);
  doc.text(`Employee: ${employeeName}`, 14, 32);
  doc.text(`Month: ${format(month, 'MMMM yyyy')}`, 14, 40);

  // Summary
  doc.setFontSize(14);
  doc.text('Summary', 14, 55);
  
  doc.setFontSize(11);
  doc.text(`Total Presents: ${data.summary.totalPresents}`, 14, 65);
  doc.text(`Total Absents: ${data.summary.totalAbsents}`, 70, 65);
  doc.text(`Total Lates: ${data.summary.totalLates}`, 130, 65);

  // Breaches
  let yPosition = 75;
  if (data.summary.breaches.length > 0) {
    doc.setTextColor(220, 38, 38);
    doc.setFontSize(12);
    doc.text(`⚠ Breaches Detected: ${data.summary.breaches.length}`, 14, yPosition);
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    yPosition += 8;
    
    data.summary.breaches.forEach((breach) => {
      doc.text(`• ${breach.message}`, 20, yPosition);
      yPosition += 6;
    });
    yPosition += 5;
  }

  // Table
  const tableData = Array.from(data.days.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, status]) => [
      format(new Date(date), 'MMM dd, yyyy'),
      format(new Date(date), 'EEE'),
      status.status.toUpperCase(),
      status.clockInTime ? format(new Date(status.clockInTime), 'HH:mm') : '-',
      status.clockOutTime ? format(new Date(status.clockOutTime), 'HH:mm') : '-',
      status.totalHours?.toFixed(2) || '-',
      status.isLate ? 'Yes' : 'No',
    ]);

  autoTable(doc, {
    startY: yPosition,
    head: [['Date', 'Day', 'Status', 'Clock In', 'Clock Out', 'Hours', 'Late']],
    body: tableData,
    styles: { fontSize: 9 },
    headStyles: { fillColor: [59, 130, 246] },
    alternateRowStyles: { fillColor: [249, 250, 251] },
  });

  doc.save(`attendance-${format(month, 'yyyy-MM')}.pdf`);
}
