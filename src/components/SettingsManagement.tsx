import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { IPManagement } from './IPManagement';
import { AttendanceNotificationLog } from './AttendanceNotificationLog';
import { UserManagement } from './UserManagement';
import { ClockInOutTest } from './ClockInOutTest';
import { TestEmailManagement } from './TestEmailManagement';
import { Shield, Bell, Users, FlaskConical, Mail } from 'lucide-react';

interface SettingsManagementProps {
  userRole: 'admin' | 'staff' | 'manager';
}

export const SettingsManagement = ({ userRole }: SettingsManagementProps) => {
  return (
    <Tabs defaultValue="ip-management" className="w-full">
      <TabsList className="grid w-full grid-cols-5">
        <TabsTrigger value="ip-management">
          <Shield className="h-4 w-4 mr-2" />
          IP Management
        </TabsTrigger>
        <TabsTrigger value="notification-log">
          <Bell className="h-4 w-4 mr-2" />
          Notification Log
        </TabsTrigger>
        <TabsTrigger value="user-management">
          <Users className="h-4 w-4 mr-2" />
          User Management
        </TabsTrigger>
        <TabsTrigger value="clock-test">
          <FlaskConical className="h-4 w-4 mr-2" />
          Clock-In/Out Test
        </TabsTrigger>
        <TabsTrigger value="test-emails">
          <Mail className="h-4 w-4 mr-2" />
          Test Emails
        </TabsTrigger>
      </TabsList>
      
      <TabsContent value="ip-management" className="mt-6">
        <IPManagement />
      </TabsContent>
      
      <TabsContent value="notification-log" className="mt-6">
        <AttendanceNotificationLog />
      </TabsContent>

      <TabsContent value="user-management" className="mt-6">
        <UserManagement />
      </TabsContent>

      <TabsContent value="clock-test" className="mt-6">
        <ClockInOutTest />
      </TabsContent>

      <TabsContent value="test-emails" className="mt-6">
        <TestEmailManagement />
      </TabsContent>
    </Tabs>
  );
};
