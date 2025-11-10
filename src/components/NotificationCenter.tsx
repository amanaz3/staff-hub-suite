import { useNotifications } from '@/hooks/useNotifications';
import { NotificationItem } from './NotificationItem';
import { Button } from './ui/button';
import { ScrollArea } from './ui/scroll-area';
import { Separator } from './ui/separator';
import { CheckCheck, Inbox } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface NotificationCenterProps {
  onClose?: () => void;
}

export const NotificationCenter = ({ onClose }: NotificationCenterProps) => {
  const { notifications, unreadCount, markAsRead, markAllAsRead, deleteNotification } = useNotifications();
  const navigate = useNavigate();

  const handleNotificationClick = (actionUrl: string | null) => {
    if (actionUrl) {
      navigate(actionUrl);
      onClose?.();
    }
  };

  const groupedNotifications = {
    today: notifications.filter(n => {
      const notifDate = new Date(n.created_at);
      const today = new Date();
      return notifDate.toDateString() === today.toDateString();
    }),
    yesterday: notifications.filter(n => {
      const notifDate = new Date(n.created_at);
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      return notifDate.toDateString() === yesterday.toDateString();
    }),
    older: notifications.filter(n => {
      const notifDate = new Date(n.created_at);
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      return notifDate < yesterday;
    }),
  };

  if (notifications.length === 0) {
    return (
      <div className="w-full md:w-96 bg-background border rounded-lg shadow-lg">
        <div className="p-4 border-b">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Notifications</h3>
          </div>
        </div>
        <div className="p-8 text-center">
          <Inbox className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground">No notifications yet</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full md:w-96 bg-background border rounded-lg shadow-lg">
      {/* Header */}
      <div className="p-4 border-b">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold">Notifications</h3>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={markAllAsRead}
              className="h-8 text-xs"
            >
              <CheckCheck className="h-3 w-3 mr-1" />
              Mark all read
            </Button>
          )}
        </div>
        {unreadCount > 0 && (
          <p className="text-xs text-muted-foreground">
            {unreadCount} unread notification{unreadCount !== 1 ? 's' : ''}
          </p>
        )}
      </div>

      {/* Notifications List */}
      <ScrollArea className="h-[400px]">
        <div className="p-2">
          {/* Today */}
          {groupedNotifications.today.length > 0 && (
            <>
              <div className="px-2 py-1 text-xs font-medium text-muted-foreground">
                Today
              </div>
              <div className="space-y-1">
                {groupedNotifications.today.map((notification) => (
                  <NotificationItem
                    key={notification.id}
                    id={notification.id}
                    notification_type={notification.notification_type}
                    title={notification.title}
                    message={notification.message}
                    read={notification.read}
                    created_at={notification.created_at}
                    priority={notification.priority}
                    action_url={notification.action_url}
                    onMarkAsRead={markAsRead}
                    onDelete={deleteNotification}
                    onClick={() => handleNotificationClick(notification.action_url)}
                  />
                ))}
              </div>
              {(groupedNotifications.yesterday.length > 0 || groupedNotifications.older.length > 0) && (
                <Separator className="my-2" />
              )}
            </>
          )}

          {/* Yesterday */}
          {groupedNotifications.yesterday.length > 0 && (
            <>
              <div className="px-2 py-1 text-xs font-medium text-muted-foreground">
                Yesterday
              </div>
              <div className="space-y-1">
                {groupedNotifications.yesterday.map((notification) => (
                  <NotificationItem
                    key={notification.id}
                    id={notification.id}
                    notification_type={notification.notification_type}
                    title={notification.title}
                    message={notification.message}
                    read={notification.read}
                    created_at={notification.created_at}
                    priority={notification.priority}
                    action_url={notification.action_url}
                    onMarkAsRead={markAsRead}
                    onDelete={deleteNotification}
                    onClick={() => handleNotificationClick(notification.action_url)}
                  />
                ))}
              </div>
              {groupedNotifications.older.length > 0 && <Separator className="my-2" />}
            </>
          )}

          {/* Older */}
          {groupedNotifications.older.length > 0 && (
            <>
              <div className="px-2 py-1 text-xs font-medium text-muted-foreground">
                Older
              </div>
              <div className="space-y-1">
                {groupedNotifications.older.map((notification) => (
                  <NotificationItem
                    key={notification.id}
                    id={notification.id}
                    notification_type={notification.notification_type}
                    title={notification.title}
                    message={notification.message}
                    read={notification.read}
                    created_at={notification.created_at}
                    priority={notification.priority}
                    action_url={notification.action_url}
                    onMarkAsRead={markAsRead}
                    onDelete={deleteNotification}
                    onClick={() => handleNotificationClick(notification.action_url)}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      </ScrollArea>
    </div>
  );
};
