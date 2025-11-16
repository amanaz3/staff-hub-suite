import { LeaveManagement } from './LeaveManagement';
import { AttendanceStatsWidget } from './AttendanceStatsWidget';

interface AdminDashboardProps {
  userRole: 'admin' | 'staff' | 'manager';
}

export const AdminDashboard = ({ userRole }: AdminDashboardProps) => {
  const isAdmin = userRole === 'admin';

  return (
    <div className="space-y-6">
      {/* Attendance Stats Widget - Only for Admins */}
      {isAdmin && <AttendanceStatsWidget />}
      
      {/* LeaveManagement is now the main hub with all navigation */}
      <LeaveManagement userRole={userRole} />
    </div>
  );
};