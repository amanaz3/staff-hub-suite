import { formatDistanceToNow } from 'date-fns';
import { Bell, Calendar, AlertTriangle, FileText, Info, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from './ui/button';

interface NotificationItemProps {
  id: string;
  notification_type: string;
  title: string;
  message: string;
  read: boolean;
  created_at: string;
  priority: string;
  action_url?: string | null;
  onMarkAsRead: (id: string) => void;
  onDelete: (id: string) => void;
  onClick?: () => void;
}

const getNotificationIcon = (type: string) => {
  switch (type) {
    case 'attendance':
      return <Bell className="h-4 w-4" />;
    case 'leave_request':
      return <Calendar className="h-4 w-4" />;
    case 'exception_request':
      return <AlertTriangle className="h-4 w-4" />;
    case 'document_expiry':
      return <FileText className="h-4 w-4" />;
    default:
      return <Info className="h-4 w-4" />;
  }
};

const getNotificationColor = (type: string) => {
  switch (type) {
    case 'attendance':
      return 'text-destructive';
    case 'leave_request':
      return 'text-primary';
    case 'exception_request':
      return 'text-warning';
    case 'document_expiry':
      return 'text-purple-600';
    default:
      return 'text-muted-foreground';
  }
};

export const NotificationItem = ({
  id,
  notification_type,
  title,
  message,
  read,
  created_at,
  priority,
  action_url,
  onMarkAsRead,
  onDelete,
  onClick,
}: NotificationItemProps) => {
  const handleClick = () => {
    if (!read) {
      onMarkAsRead(id);
    }
    if (onClick) {
      onClick();
    }
  };

  const timeAgo = formatDistanceToNow(new Date(created_at), { addSuffix: true });

  return (
    <div
      className={cn(
        'group relative flex gap-3 p-3 rounded-lg transition-colors',
        read ? 'bg-background hover:bg-muted/50' : 'bg-primary/5 hover:bg-primary/10',
        action_url && 'cursor-pointer'
      )}
      onClick={action_url ? handleClick : undefined}
      role={action_url ? 'button' : undefined}
      tabIndex={action_url ? 0 : undefined}
    >
      {/* Icon */}
      <div
        className={cn(
          'flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center',
          priority === 'high' || priority === 'urgent' ? 'bg-destructive/10' : 'bg-muted'
        )}
      >
        <span className={getNotificationColor(notification_type)}>
          {getNotificationIcon(notification_type)}
        </span>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-start justify-between gap-2">
          <p className={cn('text-sm font-medium', !read && 'text-foreground')}>{title}</p>
          {!read && (
            <span className="flex-shrink-0 w-2 h-2 bg-primary rounded-full mt-1.5" />
          )}
        </div>
        <p className="text-sm text-muted-foreground line-clamp-2">{message}</p>
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">{timeAgo}</p>
        </div>
      </div>

      {/* Delete button */}
      <Button
        variant="ghost"
        size="icon"
        className="flex-shrink-0 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={(e) => {
          e.stopPropagation();
          onDelete(id);
        }}
      >
        <X className="h-3 w-3" />
      </Button>
    </div>
  );
};
