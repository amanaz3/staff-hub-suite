import { 
  User, 
  TrendingUp, 
  Gift, 
  GraduationCap, 
  Store, 
  Heart, 
  MessageCircle, 
  Clock, 
  DollarSign, 
  AlertTriangle, 
  Users, 
  Plus,
  LucideIcon
} from 'lucide-react';
import { Card, CardContent } from './ui/card';

interface AppGridProps {
  onNavigate?: (tabId: string) => void;
}

interface App {
  id: string;
  title: string;
  icon: LucideIcon;
  onClick: () => void;
  gradient: string;
}

export const AppGrid = ({ onNavigate }: AppGridProps) => {
  const apps: App[] = [
    { 
      id: 'personal-info', 
      title: 'Personal Info', 
      icon: User, 
      onClick: () => window.location.href = '/profile',
      gradient: 'from-blue-500 to-blue-600'
    },
    { 
      id: 'career', 
      title: 'Career and Performance', 
      icon: TrendingUp, 
      onClick: () => {},
      gradient: 'from-purple-500 to-purple-600'
    },
    { 
      id: 'benefits', 
      title: 'Benefits', 
      icon: Gift, 
      onClick: () => {},
      gradient: 'from-green-500 to-green-600'
    },
    { 
      id: 'learning', 
      title: 'Learning', 
      icon: GraduationCap, 
      onClick: () => {},
      gradient: 'from-orange-500 to-orange-600'
    },
    { 
      id: 'opportunity', 
      title: 'Opportunity Marketplace', 
      icon: Store, 
      onClick: () => {},
      gradient: 'from-teal-500 to-teal-600'
    },
    { 
      id: 'volunteering', 
      title: 'Volunteering', 
      icon: Heart, 
      onClick: () => {},
      gradient: 'from-pink-500 to-pink-600'
    },
    { 
      id: 'brand', 
      title: 'Personal Brand', 
      icon: MessageCircle, 
      onClick: () => {},
      gradient: 'from-indigo-500 to-indigo-600'
    },
    { 
      id: 'time', 
      title: 'Time', 
      icon: Clock, 
      onClick: () => onNavigate?.('my-attendance'),
      gradient: 'from-cyan-500 to-cyan-600'
    },
    { 
      id: 'pay', 
      title: 'Pay', 
      icon: DollarSign, 
      onClick: () => {},
      gradient: 'from-emerald-500 to-emerald-600'
    },
    { 
      id: 'safety', 
      title: 'Safety Incidents', 
      icon: AlertTriangle, 
      onClick: () => {},
      gradient: 'from-red-500 to-red-600'
    },
    { 
      id: 'connections', 
      title: 'Connections', 
      icon: Users, 
      onClick: () => {},
      gradient: 'from-violet-500 to-violet-600'
    },
    { 
      id: 'add', 
      title: 'Add More', 
      icon: Plus, 
      onClick: () => {},
      gradient: 'from-slate-400 to-slate-500'
    },
  ];

  return (
    <div className="flex-1">
      <h3 className="text-sm font-semibold text-muted-foreground mb-4 uppercase tracking-wide">
        Apps
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {apps.map((app) => (
          <Card
            key={app.id}
            className={`cursor-pointer hover:shadow-lg transition-all bg-gradient-to-br ${app.gradient} text-white border-0 group`}
            onClick={app.onClick}
          >
            <CardContent className="flex flex-col items-center justify-center p-6 min-h-[140px]">
              <app.icon className="h-12 w-12 mb-3 opacity-90 group-hover:scale-110 transition-transform" />
              <p className="text-center font-medium text-sm leading-tight">
                {app.title}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};
