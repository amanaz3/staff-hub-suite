import { useState } from 'react';
import { DashboardHeader } from './DashboardHeader';
import { QuickActions } from './QuickActions';
import { AppGrid } from './AppGrid';
import { Tabs, TabsList, TabsTrigger } from './ui/tabs';

interface EmployeeDashboardProps {
  currentUser: {
    name: string;
    email: string;
    avatar?: string;
  };
  onLogout: () => void;
  onNavigate?: (tabId: string) => void;
}

export const EmployeeDashboard = ({ 
  currentUser, 
  onLogout,
  onNavigate 
}: EmployeeDashboardProps) => {
  const [activeTab, setActiveTab] = useState('me');

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <DashboardHeader currentUser={currentUser} onLogout={onLogout} />

      {/* Hero Section with Greeting */}
      <section className="bg-gradient-to-br from-teal-700 to-teal-900 text-white">
        <div className="container mx-auto px-6 py-12">
          {/* Greeting */}
          <h1 className="text-4xl font-serif mb-8">
            {getGreeting()}, {currentUser.name}!
          </h1>
          
          {/* Tab Navigation */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="bg-teal-800/50 border-b border-teal-600">
              <TabsTrigger 
                value="suggestions" 
                className="data-[state=active]:bg-teal-700 data-[state=active]:text-white"
              >
                Suggestions
              </TabsTrigger>
              <TabsTrigger 
                value="me"
                className="data-[state=active]:bg-teal-700 data-[state=active]:text-white"
              >
                Me
              </TabsTrigger>
              <TabsTrigger 
                value="team"
                className="data-[state=active]:bg-teal-700 data-[state=active]:text-white"
              >
                My Team
              </TabsTrigger>
              <TabsTrigger 
                value="clients"
                className="data-[state=active]:bg-teal-700 data-[state=active]:text-white"
              >
                My Client Groups
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </section>

      {/* Main Content - Two Column Layout */}
      <div className="container mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">
          {/* Left: Quick Actions */}
          <aside>
            <QuickActions onNavigate={onNavigate} />
          </aside>
          
          {/* Right: Apps Grid */}
          <main>
            <AppGrid onNavigate={onNavigate} />
          </main>
        </div>
      </div>
    </div>
  );
};
