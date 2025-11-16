import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Breadcrumb, BreadcrumbList, BreadcrumbItem, BreadcrumbLink, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { LeaveRequestsView } from "@/components/LeaveRequestsView";
import { ExceptionApprovalQueue } from "@/components/ExceptionApprovalQueue";
import { WorkScheduleManagement } from "@/components/WorkScheduleManagement";
import { LeaveBalanceManagement } from "@/components/LeaveBalanceManagement";
import { SettingsManagement } from "@/components/SettingsManagement";
import { 
  LayoutGrid, List, FileText, AlertCircle, ClipboardList, 
  Clock, Calendar, Settings as SettingsIcon
} from "lucide-react";

interface LeaveManagementProps {
  userRole: 'admin' | 'staff' | 'manager';
}

// Navigation tiles configuration
const navigationTiles = [
  {
    id: 'leave-requests',
    label: 'Leave Requests',
    icon: FileText,
    description: 'Submit and manage leave requests',
    gradient: 'from-blue-500 to-blue-600',
    adminOnly: false
  },
  {
    id: 'absences',
    label: 'Absences',
    icon: AlertCircle,
    description: 'Review attendance exceptions',
    gradient: 'from-amber-500 to-amber-600',
    adminOnly: false
  },
  {
    id: 'work-schedules',
    label: 'Work Schedules',
    icon: Clock,
    description: 'Manage work schedules',
    gradient: 'from-green-500 to-green-600',
    adminOnly: true
  },
  {
    id: 'leave-balances',
    label: 'Leave Balances',
    icon: Calendar,
    description: 'Configure leave allocations',
    gradient: 'from-indigo-500 to-indigo-600',
    adminOnly: true
  },
  {
    id: 'settings',
    label: 'Settings',
    icon: SettingsIcon,
    description: 'System settings and logs',
    gradient: 'from-gray-500 to-gray-600',
    adminOnly: true
  }
];

// GridView sub-component
interface GridViewProps {
  tiles: typeof navigationTiles;
  onTileClick: (tileId: string) => void;
}

const GridView = ({ tiles, onTileClick }: GridViewProps) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mt-8">
      {tiles.map((tile) => {
        const Icon = tile.icon;
        return (
          <button
            key={tile.id}
            onClick={() => onTileClick(tile.id)}
            className={`
              group relative aspect-square flex flex-col items-center justify-center p-6
              rounded-xl shadow-lg hover:shadow-2xl transition-all duration-300
              bg-gradient-to-br ${tile.gradient}
              cursor-pointer hover:scale-105 border border-white/20
            `}
          >
            <Icon className="h-12 w-12 text-white mb-4 group-hover:scale-110 transition-transform" />
            <h3 className="text-base font-semibold text-white text-center tracking-wide">
              {tile.label}
            </h3>
            <p className="text-xs text-white/80 text-center mt-2">
              {tile.description}
            </p>
          </button>
        );
      })}
    </div>
  );
};

export const LeaveManagement = ({ userRole }: LeaveManagementProps) => {
  const [viewMode, setViewMode] = useState<'grid' | 'tabs'>('grid');
  const [activeSection, setActiveSection] = useState<string>('leave-requests');

  // Filter tiles based on user role
  const availableTiles = navigationTiles.filter(tile => 
    !tile.adminOnly || userRole === 'admin'
  );

  const handleTileClick = (tileId: string) => {
    setActiveSection(tileId);
    setViewMode('tabs');
  };

  const getSectionLabel = (sectionId: string) => {
    return navigationTiles.find(tile => tile.id === sectionId)?.label || 'Leave Requests';
  };

  return (
    <div className="space-y-6">
      {/* Header with View Toggle */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Leave Management</h2>
          <p className="text-muted-foreground">
            Manage leave requests, absences, and attendance
          </p>
        </div>
        
        <Button
          variant="outline"
          size="sm"
          onClick={() => setViewMode(viewMode === 'grid' ? 'tabs' : 'grid')}
        >
          {viewMode === 'grid' ? (
            <>
              <List className="h-4 w-4 mr-2" />
              List View
            </>
          ) : (
            <>
              <LayoutGrid className="h-4 w-4 mr-2" />
              Grid View
            </>
          )}
        </Button>
      </div>

      {/* Breadcrumb for Tabs Mode */}
      {viewMode === 'tabs' && (
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink 
                className="cursor-pointer"
                onClick={() => setViewMode('grid')}
              >
                Leave Management
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>{getSectionLabel(activeSection)}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      )}

      {/* Navigation Tabs */}
      <Tabs value={activeSection} onValueChange={setActiveSection} className="w-full">
        <TabsList className={`grid w-full ${
          userRole === 'admin' ? 'grid-cols-6' : 'grid-cols-2'
        }`}>
          {availableTiles.map(tile => (
            <TabsTrigger 
              key={tile.id} 
              value={tile.id}
              className="flex items-center gap-2"
            >
              <tile.icon className="h-4 w-4" />
              <span className="hidden sm:inline">{tile.label}</span>
            </TabsTrigger>
          ))}
        </TabsList>

        {/* Conditional Rendering: Grid View or Tabs Content */}
        {viewMode === 'grid' ? (
          <GridView 
            tiles={availableTiles} 
            onTileClick={handleTileClick}
          />
        ) : (
          <>
            {/* Leave Requests Content */}
            <TabsContent value="leave-requests" className="mt-6">
              <LeaveRequestsView userRole={userRole} />
            </TabsContent>

            {/* Absences Content */}
            <TabsContent value="absences" className="mt-6">
              <ExceptionApprovalQueue />
            </TabsContent>

            {/* Work Schedules Content */}
            {userRole === 'admin' && (
              <TabsContent value="work-schedules" className="mt-6">
                <WorkScheduleManagement />
              </TabsContent>
            )}

            {/* Leave Balances Content */}
            {userRole === 'admin' && (
              <TabsContent value="leave-balances" className="mt-6">
                <LeaveBalanceManagement />
              </TabsContent>
            )}

            {/* Settings Content */}
            {userRole === 'admin' && (
              <TabsContent value="settings" className="mt-6">
                <SettingsManagement userRole={userRole} />
              </TabsContent>
            )}
          </>
        )}
      </Tabs>
    </div>
  );
};
