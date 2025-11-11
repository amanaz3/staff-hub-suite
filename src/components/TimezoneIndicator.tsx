import { Clock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export function TimezoneIndicator() {
  return (
    <Badge variant="outline" className="gap-1.5">
      <Clock className="h-3 w-3" />
      GST (UTC+4)
    </Badge>
  );
}
