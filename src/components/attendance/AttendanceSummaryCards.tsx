import { Card, CardContent } from '@/components/ui/card';
import { Calendar, CheckCircle, Clock, XCircle, AlertCircle, FileText } from 'lucide-react';

interface AttendanceSummaryCardsProps {
  totalRecords: number;
  onTimeCount: number;
  lateCount: number;
  earlyCount: number;
  absentCount: number;
  pendingLeavesCount: number;
}

export const AttendanceSummaryCards = ({
  totalRecords,
  onTimeCount,
  lateCount,
  earlyCount,
  absentCount,
  pendingLeavesCount,
}: AttendanceSummaryCardsProps) => {
  const onTimePercentage = totalRecords > 0 ? ((onTimeCount / totalRecords) * 100).toFixed(1) : '0.0';
  const latePercentage = totalRecords > 0 ? ((lateCount / totalRecords) * 100).toFixed(1) : '0.0';
  const earlyPercentage = totalRecords > 0 ? ((earlyCount / totalRecords) * 100).toFixed(1) : '0.0';
  const absentPercentage = totalRecords > 0 ? ((absentCount / totalRecords) * 100).toFixed(1) : '0.0';

  const cards = [
    {
      title: 'Total Records',
      value: totalRecords,
      icon: Calendar,
      iconClass: 'text-primary',
      bgClass: 'bg-primary/10',
    },
    {
      title: 'On-Time',
      value: onTimeCount,
      percentage: onTimePercentage,
      icon: CheckCircle,
      iconClass: 'text-success',
      bgClass: 'bg-success/10',
    },
    {
      title: 'Late Check-ins',
      value: lateCount,
      percentage: latePercentage,
      icon: Clock,
      iconClass: 'text-warning',
      bgClass: 'bg-warning/10',
    },
    {
      title: 'Early Check-outs',
      value: earlyCount,
      percentage: earlyPercentage,
      icon: AlertCircle,
      iconClass: 'text-warning',
      bgClass: 'bg-warning/10',
    },
    {
      title: 'Absences',
      value: absentCount,
      percentage: absentPercentage,
      icon: XCircle,
      iconClass: 'text-destructive',
      bgClass: 'bg-destructive/10',
    },
    {
      title: 'Pending Leaves',
      value: pendingLeavesCount,
      icon: FileText,
      iconClass: 'text-info',
      bgClass: 'bg-info/10',
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
      {cards.map((card) => (
        <Card key={card.title} className="card-elevated hover:shadow-lg transition-shadow">
          <CardContent className="p-4">
            <div className="flex items-start justify-between mb-2">
              <div className={`p-2 rounded-lg ${card.bgClass}`}>
                <card.icon className={`h-5 w-5 ${card.iconClass}`} />
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-2xl font-bold">{card.value}</p>
              <p className="text-xs text-muted-foreground">{card.title}</p>
              {card.percentage && (
                <p className="text-xs font-medium text-muted-foreground">
                  {card.percentage}% of total
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};
