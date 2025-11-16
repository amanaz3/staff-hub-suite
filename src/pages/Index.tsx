import { useState } from "react";
import { Navigate } from "react-router-dom";
import { Dashboard } from "@/components/Dashboard";
import { AdminDashboard } from "@/components/AdminDashboard";
import { LeaveManagement } from "@/components/LeaveManagement";
import { Navigation } from "@/components/ui/navigation";
import { Breadcrumb, BreadcrumbList, BreadcrumbItem, BreadcrumbLink, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Users, Calendar, Settings, BarChart, Menu, X, RefreshCw, FileText, ClipboardList, Home } from "lucide-react";
import { DocumentManagement } from "@/components/DocumentManagement";
import { AttendanceReport } from "@/components/AttendanceReport";
import { SettingsManagement } from "@/components/SettingsManagement";
import { PersonalAttendanceReport } from "@/components/PersonalAttendanceReport";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

const Index = () => {
  const { user, profile, loading, signOut, refreshProfile } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Users className="h-8 w-8 text-primary-foreground" />
          </div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // Only redirect to auth if we're sure there's no user (loading is complete)
  if (!loading && !user) {
    return <Navigate to="/auth" replace />;
  }

  // Show loading while profile is being fetched
  if (!loading && user && !profile) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Users className="h-8 w-8 text-primary-foreground" />
          </div>
          <p className="text-muted-foreground">Setting up your profile...</p>
        </div>
      </div>
    );
  }

  const navigationItems = [
    { id: 'dashboard', label: 'Dashboard', icon: BarChart },
    { id: 'my-attendance', label: 'My Attendance', icon: ClipboardList },
    { id: 'leaves', label: 'Leave Management', icon: Calendar },
    ...(profile?.role === 'admin' || profile?.role === 'manager' ? [
      { id: 'attendance', label: 'Team Attendance', icon: FileText },
      { id: 'documents', label: 'Staff Documents', icon: FileText },
    ] : []),
    ...(profile?.role === 'admin' ? [
      { id: 'settings', label: 'Settings', icon: Settings }
    ] : [])
  ];

  const getCurrentPageLabel = () => {
    return navigationItems.find(item => item.id === activeTab)?.label || 'Dashboard';
  };

  const handleNavigationClick = (itemId: string) => {
    setActiveTab(itemId);
    setSidebarOpen(false); // Close mobile sidebar on navigation
  };

  const handleRefreshProfile = async () => {
    setRefreshing(true);
    await refreshProfile();
    setRefreshing(false);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside className={cn(
        "fixed left-0 top-0 h-full w-64 bg-card border-r border-border z-50 transform transition-transform duration-300 ease-in-out",
        "lg:translate-x-0",
        sidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="flex flex-col h-full">
          {/* Sidebar header */}
          <div className="flex items-center justify-between p-6 border-b">
            <div className="text-2xl font-bold text-primary">HRFlow</div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden"
              aria-label="Close sidebar"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>

          {/* Navigation */}
          <div className="flex-1 p-6">
            <Navigation
              items={navigationItems}
              activeItem={activeTab}
              onItemClick={handleNavigationClick}
            />
          </div>

          {/* User info */}
          <div className="p-6 border-t">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-8 w-8 bg-primary rounded-full flex items-center justify-center">
                <span className="text-primary-foreground text-sm font-medium">
                  {(profile?.full_name || profile?.email)?.charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">
                  {profile?.full_name || profile?.email?.split('@')[0]}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {profile?.role === 'admin' ? 'Administrator' : profile?.role === 'manager' ? 'Manager' : 'Staff Member'}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button 
                variant="ghost" 
                onClick={handleRefreshProfile}
                disabled={refreshing}
                size="sm"
                className="flex-1"
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              <Button 
                variant="outline" 
                onClick={signOut} 
                size="sm" 
                className="flex-1"
              >
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="lg:ml-64">
        {activeTab !== 'dashboard' && (
          <header className="sticky top-0 z-30 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
            <div className="container mx-auto px-4 sm:px-6 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setSidebarOpen(true)}
                    className="lg:hidden"
                    aria-label="Open sidebar"
                  >
                    <Menu className="h-5 w-5" />
                  </Button>
                  <Breadcrumb>
                    <BreadcrumbList>
                      <BreadcrumbItem>
                        <BreadcrumbLink 
                          className="cursor-pointer"
                          onClick={() => setActiveTab('dashboard')}
                        >
                          <Home className="h-4 w-4" />
                        </BreadcrumbLink>
                      </BreadcrumbItem>
                      <BreadcrumbSeparator />
                      <BreadcrumbItem>
                        <BreadcrumbPage>{getCurrentPageLabel()}</BreadcrumbPage>
                      </BreadcrumbItem>
                    </BreadcrumbList>
                  </Breadcrumb>
                </div>
              </div>
            </div>
          </header>
        )}

        <main className={cn(
          "min-h-screen",
          activeTab !== 'dashboard' && "pb-20 lg:pb-8"
        )}>
          {activeTab === 'dashboard' && (
            <Dashboard 
              userRole={profile.role} 
              currentUser={{
                name: profile.full_name || profile.email.split('@')[0],
                email: profile.email,
                avatar: profile.avatar_url
              }}
              userProfile={{
                user_id: profile.user_id,
                email: profile.email,
                full_name: profile.full_name || profile.email.split('@')[0]
              }}
              onLogout={signOut}
              onNavigate={handleNavigationClick}
            />
          )}

          {activeTab === 'leaves' && (
            <div className="container mx-auto px-4 sm:px-6 py-8">
              <AdminDashboard userRole={profile.role} />
            </div>
          )}

          {activeTab === 'my-attendance' && (
            <div className="container mx-auto px-4 sm:px-6 py-8">
              <PersonalAttendanceReport />
            </div>
          )}

          {activeTab === 'attendance' && (
            <div className="container mx-auto px-4 sm:px-6 py-8">
              <AttendanceReport />
            </div>
          )}

          {activeTab === 'documents' && (
            <div className="container mx-auto px-4 sm:px-6 py-8">
              <DocumentManagement />
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="container mx-auto px-4 sm:px-6 py-8">
              <SettingsManagement userRole={profile.role} />
            </div>
          )}
        </main>
      </div>

      {/* Mobile bottom navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60 border-t lg:hidden z-30">
        <div className="container mx-auto px-4">
          <Navigation
            items={navigationItems}
            activeItem={activeTab}
            onItemClick={handleNavigationClick}
            orientation="horizontal"
            className="flex flex-row space-y-0 space-x-0 py-2"
          />
        </div>
      </nav>
    </div>
  );
};

export default Index;