import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { IPManagement } from './IPManagement';
import { AttendanceNotificationLog } from './AttendanceNotificationLog';
import { Shield, Bell } from 'lucide-react';

export const SettingsManagement = () => {
  return (
    <Tabs defaultValue="ip-management" className="w-full">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="ip-management">
          <Shield className="h-4 w-4 mr-2" />
          IP Management
        </TabsTrigger>
        <TabsTrigger value="notification-log">
          <Bell className="h-4 w-4 mr-2" />
          Notification Log
        </TabsTrigger>
      </TabsList>
      
      <TabsContent value="ip-management" className="mt-6">
        <IPManagement />
      </TabsContent>
      
      <TabsContent value="notification-log" className="mt-6">
        <AttendanceNotificationLog />
      </TabsContent>
    </Tabs>
  );
};
