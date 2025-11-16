import { LeaveManagement } from './LeaveManagement';
import { AttendanceStatsWidget } from './AttendanceStatsWidget';
import { AttendanceReport } from './AttendanceReport';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LayoutDashboard, Users } from 'lucide-react';

interface AdminDashboardProps {
  userRole: 'admin' | 'staff' | 'manager';
}

export const AdminDashboard = ({ userRole }: AdminDashboardProps) => {
  const isAdmin = userRole === 'admin';

  return (
    <div className="space-y-6">
      {/* Attendance Stats Widget - Only for Admins with Tabs */}
      {isAdmin ? (
        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="overview" className="flex items-center gap-2">
              <LayoutDashboard className="h-4 w-4" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="team-attendance" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Team Attendance
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="overview" className="space-y-6">
            <AttendanceStatsWidget />
          </TabsContent>
          
          <TabsContent value="team-attendance">
            <AttendanceReport />
          </TabsContent>
        </Tabs>
      ) : (
        // For managers, just show the stats widget
        <AttendanceStatsWidget />
      )}
      
      {/* LeaveManagement is now the main hub with all navigation */}
      <LeaveManagement userRole={userRole} />
    </div>
  );
};