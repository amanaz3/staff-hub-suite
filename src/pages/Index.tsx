import { useState } from "react";
import { Navigate } from "react-router-dom";
import { Dashboard } from "@/components/Dashboard";
import { LeaveManagement } from "@/components/LeaveManagement";
import { Button } from "@/components/ui/button";
import { Users, Calendar, Settings, BarChart } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

const Index = () => {
  const { user, profile, loading, signOut } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');

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
    { id: 'leaves', label: 'Leave Management', icon: Calendar },
    ...(profile?.role === 'admin' ? [
      { id: 'staff', label: 'Staff Directory', icon: Users },
      { id: 'settings', label: 'Settings', icon: Settings }
    ] : [])
  ];

  return (
    <div className="min-h-screen bg-background">
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
        />
      )}

      {activeTab !== 'dashboard' && (
        <>
          {/* Header for other pages */}
          <header className="border-b bg-card shadow-sm">
            <div className="container mx-auto px-6 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="text-2xl font-bold text-primary">HRFlow</div>
                </div>
                <Button variant="outline" onClick={signOut} size="sm">
                  Logout
                </Button>
              </div>
            </div>
          </header>

          <div className="container mx-auto px-6 py-8">
            {activeTab === 'leaves' && <LeaveManagement userRole={profile.role} />}
            {activeTab === 'staff' && (
              <div className="text-center py-12">
                <h2 className="text-2xl font-bold mb-4">Staff Directory</h2>
                <p className="text-muted-foreground">Staff management features coming soon...</p>
              </div>
            )}
            {activeTab === 'settings' && (
              <div className="text-center py-12">
                <h2 className="text-2xl font-bold mb-4">Settings</h2>
                <p className="text-muted-foreground">System settings coming soon...</p>
              </div>
            )}
          </div>
        </>
      )}

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-card border-t shadow-lg lg:hidden">
        <div className="flex items-center justify-around py-2">
          {navigationItems.map((item) => {
            const Icon = item.icon;
            return (
              <Button
                key={item.id}
                variant={activeTab === item.id ? "default" : "ghost"}
                size="sm"
                onClick={() => setActiveTab(item.id)}
                className="flex flex-col h-auto py-2 px-3"
              >
                <Icon className="h-4 w-4" />
                <span className="text-xs mt-1">{item.label}</span>
              </Button>
            );
          })}
        </div>
      </nav>

      {/* Desktop Sidebar Navigation */}
      <nav className="hidden lg:fixed lg:left-0 lg:top-0 lg:h-full lg:w-64 lg:bg-card lg:border-r lg:flex lg:flex-col lg:z-50">
        <div className="p-6">
          <div className="text-2xl font-bold text-primary mb-8">HRFlow</div>
          <div className="space-y-2">
            {navigationItems.map((item) => {
              const Icon = item.icon;
              return (
                <Button
                  key={item.id}
                  variant={activeTab === item.id ? "default" : "ghost"}
                  onClick={() => setActiveTab(item.id)}
                  className="w-full justify-start"
                >
                  <Icon className="h-4 w-4 mr-3" />
                  {item.label}
                </Button>
              );
            })}
          </div>
        </div>
      </nav>

      {/* Spacer for desktop sidebar */}
      <div className="hidden lg:block lg:w-64"></div>
    </div>
  );
};

export default Index;