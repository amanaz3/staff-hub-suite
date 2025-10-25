import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChevronDown, ChevronRight, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { useState, useMemo } from 'react';
import { format } from 'date-fns';

interface AttendanceTableSummaryProps {
  data: any[];
  isLoading: boolean;
}

type SortField = 'employeeId' | 'employeeName' | 'totalDays' | 'present' | 'late' | 'early' | 'absent' | 'onTimePercentage';
type SortDirection = 'asc' | 'desc' | null;

export const AttendanceTableSummary = ({ data, isLoading }: AttendanceTableSummaryProps) => {
  const [expandedEmployees, setExpandedEmployees] = useState<Set<string>>(new Set());
  const [sortField, setSortField] = useState<SortField>('onTimePercentage');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  // Aggregate data by employee
  const summaryData = useMemo(() => {
    const employeeMap: Record<string, any> = {};

    data.forEach(record => {
      if (!employeeMap[record.employeeId]) {
        employeeMap[record.employeeId] = {
          employeeId: record.employeeId,
          employeeName: record.employeeName,
          totalDays: 0,
          present: 0,
          late: 0,
          early: 0,
          absent: 0,
          onTime: 0,
          details: [],
        };
      }

      const emp = employeeMap[record.employeeId];
      emp.totalDays++;
      emp.details.push(record);

      if (record.remark === 'On Time') {
        emp.onTime++;
        emp.present++;
      } else if (record.remark === 'Late' || record.remark === 'Late & Early') {
        emp.late++;
        emp.present++;
      } else if (record.remark === 'Early') {
        emp.early++;
        emp.present++;
      } else if (record.remark === 'Absent') {
        emp.absent++;
      }
    });

    let summary = Object.values(employeeMap).map(emp => ({
      ...emp,
      onTimePercentage: emp.totalDays > 0 ? ((emp.onTime / emp.totalDays) * 100).toFixed(1) : '0.0',
    }));

    // Apply sorting
    if (sortField && sortDirection) {
      summary = summary.sort((a, b) => {
        let aValue = a[sortField];
        let bValue = b[sortField];

        if (sortField === 'onTimePercentage') {
          aValue = parseFloat(aValue);
          bValue = parseFloat(bValue);
        }

        if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return summary;
  }, [data, sortField, sortDirection]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      if (sortDirection === 'asc') {
        setSortDirection('desc');
      } else if (sortDirection === 'desc') {
        setSortDirection(null);
        setSortField('onTimePercentage');
      } else {
        setSortDirection('asc');
      }
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) {
      return <ArrowUpDown className="h-4 w-4 ml-1 opacity-40" />;
    }
    if (sortDirection === 'asc') {
      return <ArrowUp className="h-4 w-4 ml-1" />;
    }
    if (sortDirection === 'desc') {
      return <ArrowDown className="h-4 w-4 ml-1" />;
    }
    return <ArrowUpDown className="h-4 w-4 ml-1 opacity-40" />;
  };

  const toggleExpand = (employeeId: string) => {
    const newExpanded = new Set(expandedEmployees);
    if (newExpanded.has(employeeId)) {
      newExpanded.delete(employeeId);
    } else {
      newExpanded.add(employeeId);
    }
    setExpandedEmployees(newExpanded);
  };

  const getOnTimeColor = (percentage: string) => {
    const value = parseFloat(percentage);
    if (value >= 90) return 'text-success';
    if (value >= 70) return 'text-warning';
    return 'text-destructive';
  };

  if (isLoading) {
    return (
      <div className="border rounded-lg p-8 text-center text-muted-foreground">
        Loading attendance data...
      </div>
    );
  }

  if (summaryData.length === 0) {
    return (
      <div className="border rounded-lg p-8 text-center text-muted-foreground">
        No attendance records found
      </div>
    );
  }

  return (
    <div className="border rounded-lg overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12"></TableHead>
            <TableHead 
              className="cursor-pointer select-none hover:bg-muted/50"
              onClick={() => handleSort('employeeId')}
            >
              <div className="flex items-center">
                Staff ID
                <SortIcon field="employeeId" />
              </div>
            </TableHead>
            <TableHead 
              className="cursor-pointer select-none hover:bg-muted/50"
              onClick={() => handleSort('employeeName')}
            >
              <div className="flex items-center">
                Staff Name
                <SortIcon field="employeeName" />
              </div>
            </TableHead>
            <TableHead 
              className="cursor-pointer select-none hover:bg-muted/50 text-center"
              onClick={() => handleSort('totalDays')}
            >
              <div className="flex items-center justify-center">
                Total Days
                <SortIcon field="totalDays" />
              </div>
            </TableHead>
            <TableHead 
              className="cursor-pointer select-none hover:bg-muted/50 text-center"
              onClick={() => handleSort('present')}
            >
              <div className="flex items-center justify-center">
                Present
                <SortIcon field="present" />
              </div>
            </TableHead>
            <TableHead 
              className="cursor-pointer select-none hover:bg-muted/50 text-center"
              onClick={() => handleSort('late')}
            >
              <div className="flex items-center justify-center">
                Late
                <SortIcon field="late" />
              </div>
            </TableHead>
            <TableHead 
              className="cursor-pointer select-none hover:bg-muted/50 text-center"
              onClick={() => handleSort('early')}
            >
              <div className="flex items-center justify-center">
                Early
                <SortIcon field="early" />
              </div>
            </TableHead>
            <TableHead 
              className="cursor-pointer select-none hover:bg-muted/50 text-center"
              onClick={() => handleSort('absent')}
            >
              <div className="flex items-center justify-center">
                Absent
                <SortIcon field="absent" />
              </div>
            </TableHead>
            <TableHead 
              className="cursor-pointer select-none hover:bg-muted/50 text-center"
              onClick={() => handleSort('onTimePercentage')}
            >
              <div className="flex items-center justify-center">
                On-Time %
                <SortIcon field="onTimePercentage" />
              </div>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {summaryData.map((employee) => (
            <>
              <TableRow key={employee.employeeId} className="hover:bg-muted/50">
                <TableCell>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleExpand(employee.employeeId)}
                    className="h-8 w-8 p-0"
                  >
                    {expandedEmployees.has(employee.employeeId) ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                  </Button>
                </TableCell>
                <TableCell className="font-medium">{employee.employeeId}</TableCell>
                <TableCell>{employee.employeeName}</TableCell>
                <TableCell className="text-center">{employee.totalDays}</TableCell>
                <TableCell className="text-center">{employee.present}</TableCell>
                <TableCell className="text-center">
                  {employee.late > 0 ? (
                    <Badge variant="outline" className="bg-warning/10 text-warning border-warning/20">
                      {employee.late}
                    </Badge>
                  ) : (
                    employee.late
                  )}
                </TableCell>
                <TableCell className="text-center">
                  {employee.early > 0 ? (
                    <Badge variant="outline" className="bg-warning/10 text-warning border-warning/20">
                      {employee.early}
                    </Badge>
                  ) : (
                    employee.early
                  )}
                </TableCell>
                <TableCell className="text-center">
                  {employee.absent > 0 ? (
                    <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20">
                      {employee.absent}
                    </Badge>
                  ) : (
                    employee.absent
                  )}
                </TableCell>
                <TableCell className="text-center">
                  <span className={`font-semibold ${getOnTimeColor(employee.onTimePercentage)}`}>
                    {employee.onTimePercentage}%
                  </span>
                </TableCell>
              </TableRow>

              {/* Expanded Detail Rows */}
              {expandedEmployees.has(employee.employeeId) && (
                <TableRow>
                  <TableCell colSpan={9} className="bg-muted/30 p-4">
                    <div className="space-y-2">
                      <h4 className="font-semibold text-sm mb-3">Daily Breakdown</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 text-sm">
                        {employee.details.map((detail: any, idx: number) => (
                          <div 
                            key={idx} 
                            className="flex items-center justify-between p-2 rounded-md bg-background border"
                          >
                            <div>
                              <span className="font-medium">{format(new Date(detail.date), 'MMM dd')}</span>
                              <span className="text-muted-foreground ml-2">({detail.day})</span>
                            </div>
                            <Badge variant={
                              detail.remark === 'On Time' ? 'default' :
                              detail.remark === 'Absent' ? 'destructive' :
                              'secondary'
                            }>
                              {detail.remark}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};
