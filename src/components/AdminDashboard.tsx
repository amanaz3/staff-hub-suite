import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { WorkScheduleManagement } from './WorkScheduleManagement';
import { IPManagement } from './IPManagement';
import { ExceptionApprovalQueue } from './ExceptionApprovalQueue';
import { LeaveBalanceManagement } from './LeaveBalanceManagement';
import { LeaveManagement } from './LeaveManagement';
import { AttendanceReport } from './AttendanceReport';
import { Clock, Shield, AlertTriangle, Calendar, FileText, ClipboardList, Bell } from 'lucide-react';
import { AttendanceNotificationLog } from './AttendanceNotificationLog';
import { AttendanceStatsWidget } from './AttendanceStatsWidget';

interface AdminDashboardProps {
  userRole: 'admin' | 'staff' | 'manager';
}

export const AdminDashboard = ({ userRole }: AdminDashboardProps) => {
  const [activeTab, setActiveTab] = useState('leave');

  // Staff users see simplified view
  if (userRole === 'staff') {
    return <LeaveManagement userRole={userRole} />;
  }

  // Managers and admins get tabbed interface
  const isAdmin = userRole === 'admin';

  return (
    <div className="space-y-6">
      {/* Attendance Stats Widget - Only for Admins */}
      {isAdmin && <AttendanceStatsWidget />}
      
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className={`grid w-full ${isAdmin ? 'grid-cols-7' : 'grid-cols-3'}`}>
          <TabsTrigger value="leave" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Leave Requests
          </TabsTrigger>
          <TabsTrigger value="exceptions" className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            Absences
          </TabsTrigger>
          <TabsTrigger value="attendance-report" className="flex items-center gap-2">
            <ClipboardList className="h-4 w-4" />
            Team Attendance
          </TabsTrigger>
          {isAdmin && (
            <>
              <TabsTrigger value="schedules" className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Work Schedules
              </TabsTrigger>
              <TabsTrigger value="ip-management" className="flex items-center gap-2">
                <Shield className="h-4 w-4" />
                IP Management
              </TabsTrigger>
              <TabsTrigger value="leave-balances" className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Leave Balances
              </TabsTrigger>
              <TabsTrigger value="notification-log" className="flex items-center gap-2">
                <Bell className="h-4 w-4" />
                Notification Log
              </TabsTrigger>
            </>
          )}
        </TabsList>

        <TabsContent value="leave" className="mt-6">
          <LeaveManagement userRole={userRole} />
        </TabsContent>

        <TabsContent value="exceptions" className="mt-6">
          <ExceptionApprovalQueue />
        </TabsContent>

        <TabsContent value="attendance-report" className="mt-6">
          <AttendanceReport />
        </TabsContent>

        {isAdmin && (
          <>
            <TabsContent value="schedules" className="mt-6">
              <WorkScheduleManagement />
            </TabsContent>

            <TabsContent value="ip-management" className="mt-6">
              <IPManagement />
            </TabsContent>

            <TabsContent value="leave-balances" className="mt-6">
              <LeaveBalanceManagement />
            </TabsContent>

            <TabsContent value="notification-log" className="mt-6">
              <AttendanceNotificationLog />
            </TabsContent>
          </>
        )}
      </Tabs>
    </div>
  );
};