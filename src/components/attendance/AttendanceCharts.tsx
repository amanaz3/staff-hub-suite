import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useMemo } from 'react';

interface AttendanceChartsProps {
  data: any[];
}

export const AttendanceCharts = ({ data }: AttendanceChartsProps) => {
  // Prepare data for trend chart (daily aggregation)
  const trendData = useMemo(() => {
    const dailyStats: Record<string, { date: string; late: number; early: number; absent: number; onTime: number }> = {};
    
    data.forEach(record => {
      if (!dailyStats[record.date]) {
        dailyStats[record.date] = { date: record.date, late: 0, early: 0, absent: 0, onTime: 0 };
      }
      
      if (record.remark === 'Late' || record.remark === 'Late & Early') {
        dailyStats[record.date].late++;
      }
      if (record.remark === 'Early' || record.remark === 'Late & Early') {
        dailyStats[record.date].early++;
      }
      if (record.remark === 'Absent') {
        dailyStats[record.date].absent++;
      }
      if (record.remark === 'On Time') {
        dailyStats[record.date].onTime++;
      }
    });
    
    return Object.values(dailyStats)
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(d => ({
        ...d,
        date: new Date(d.date).getDate().toString(), // Show day number
      }));
  }, [data]);

  // Prepare data for employee performance chart
  const employeeData = useMemo(() => {
    const employeeStats: Record<string, { name: string; onTime: number; issues: number }> = {};
    
    data.forEach(record => {
      if (!employeeStats[record.employeeId]) {
        employeeStats[record.employeeId] = { name: record.employeeName, onTime: 0, issues: 0 };
      }
      
      if (record.remark === 'On Time') {
        employeeStats[record.employeeId].onTime++;
      } else if (record.remark !== 'Absent') {
        employeeStats[record.employeeId].issues++;
      }
    });
    
    return Object.values(employeeStats)
      .sort((a, b) => b.onTime - a.onTime)
      .slice(0, 10); // Top 10 employees
  }, [data]);

  // Prepare data for status distribution pie chart
  const statusData = useMemo(() => {
    const stats = {
      'On Time': 0,
      'Late': 0,
      'Early': 0,
      'Absent': 0,
      'Incomplete': 0,
    };
    
    data.forEach(record => {
      if (record.remark === 'Late & Early') {
        stats['Late']++;
      } else if (stats[record.remark as keyof typeof stats] !== undefined) {
        stats[record.remark as keyof typeof stats]++;
      }
    });
    
    return Object.entries(stats)
      .filter(([_, value]) => value > 0)
      .map(([name, value]) => ({ name, value }));
  }, [data]);

  const COLORS = {
    'On Time': 'hsl(var(--success))',
    'Late': 'hsl(var(--warning))',
    'Early': 'hsl(var(--warning))',
    'Absent': 'hsl(var(--destructive))',
    'Incomplete': 'hsl(var(--muted-foreground))',
  };

  if (data.length === 0) {
    return null;
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Attendance Trend Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Daily Attendance Trend</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis 
                dataKey="date" 
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
              />
              <YAxis 
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                }}
              />
              <Legend />
              <Line 
                type="monotone" 
                dataKey="late" 
                stroke="hsl(var(--warning))" 
                strokeWidth={2}
                name="Late"
              />
              <Line 
                type="monotone" 
                dataKey="early" 
                stroke="hsl(var(--warning))" 
                strokeWidth={2}
                strokeDasharray="5 5"
                name="Early"
              />
              <Line 
                type="monotone" 
                dataKey="absent" 
                stroke="hsl(var(--destructive))" 
                strokeWidth={2}
                name="Absent"
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Status Distribution Pie Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Status Distribution</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={statusData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {statusData.map((entry) => (
                  <Cell 
                    key={`cell-${entry.name}`} 
                    fill={COLORS[entry.name as keyof typeof COLORS]} 
                  />
                ))}
              </Pie>
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Employee Performance Chart */}
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle className="text-base">Top 10 Employee Attendance</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={employeeData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis 
                type="number" 
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
              />
              <YAxis 
                type="category" 
                dataKey="name" 
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
                width={120}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                }}
              />
              <Legend />
              <Bar dataKey="onTime" fill="hsl(var(--success))" name="On Time" />
              <Bar dataKey="issues" fill="hsl(var(--warning))" name="Issues" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
};
