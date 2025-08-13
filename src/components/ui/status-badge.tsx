import React from 'react';
import { Badge } from '@/components/ui/badge';
import { CheckCircle } from 'lucide-react';

interface StatusBadgeProps {
  status: 'present' | 'late' | 'absent' | 'approved' | 'pending' | 'rejected';
  children: React.ReactNode;
}

export const StatusBadge = ({ status, children }: StatusBadgeProps) => {
  const getStatusStyles = (status: string) => {
    switch (status) {
      case 'present':
      case 'approved':
        return "bg-status-present text-white border-transparent shadow-soft";
      case 'late':
      case 'pending':
        return "bg-status-pending text-white border-transparent shadow-soft";
      case 'absent':
      case 'rejected':
        return "bg-status-rejected text-white border-transparent shadow-soft";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  return (
    <Badge className={`${getStatusStyles(status)} px-3 py-1 text-xs font-medium flex items-center gap-1`}>
      {(status === 'present' || status === 'approved') && (
        <CheckCircle className="h-3 w-3" />
      )}
      {children}
    </Badge>
  );
};