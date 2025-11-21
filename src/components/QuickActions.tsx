import { useState } from 'react';
import { 
  User, 
  CalendarDays, 
  Mail, 
  TrendingUp, 
  Receipt, 
  DollarSign, 
  Calendar, 
  Search, 
  Store, 
  Lightbulb,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { Button } from './ui/button';

interface QuickActionsProps {
  onNavigate?: (tabId: string) => void;
}

export const QuickActions = ({ onNavigate }: QuickActionsProps) => {
  const [showMore, setShowMore] = useState(false);

  const quickActions = [
    { 
      id: 'personal-details', 
      label: 'Personal Details', 
      icon: User, 
      onClick: () => window.location.href = '/profile'
    },
    { 
      id: 'time-card', 
      label: 'Add Time Card', 
      icon: CalendarDays, 
      onClick: () => onNavigate?.('my-attendance')
    },
    { 
      id: 'contact', 
      label: 'Contact Information', 
      icon: Mail, 
      onClick: () => window.location.href = '/profile'
    },
    { 
      id: 'career', 
      label: 'My Career Development', 
      icon: TrendingUp, 
      onClick: () => {}
    },
    { 
      id: 'payslips', 
      label: 'Payslips', 
      icon: Receipt, 
      onClick: () => {}
    },
    { 
      id: 'pay-advance', 
      label: 'Request Pay Advance', 
      icon: DollarSign, 
      onClick: () => {}
    },
    { 
      id: 'absence', 
      label: 'Add Absence', 
      icon: Calendar, 
      onClick: () => onNavigate?.('leaves')
    },
    { 
      id: 'jobs', 
      label: 'Search Jobs', 
      icon: Search, 
      onClick: () => {}
    },
    { 
      id: 'marketplace', 
      label: 'Opportunity Marketplace', 
      icon: Store, 
      onClick: () => {}
    },
    { 
      id: 'learn', 
      label: 'What to Learn', 
      icon: Lightbulb, 
      onClick: () => {}
    },
  ];

  const visibleActions = showMore ? quickActions : quickActions.slice(0, 7);

  return (
    <div className="bg-teal-700/10 p-6 rounded-lg border border-teal-700/20">
      <h3 className="text-sm font-semibold text-teal-900 mb-4 uppercase tracking-wide">
        Quick Actions
      </h3>
      <nav className="space-y-1">
        {visibleActions.map((action) => (
          <Button
            key={action.id}
            variant="ghost"
            className="w-full justify-start text-left hover:bg-teal-50 group"
            onClick={action.onClick}
          >
            <action.icon className="h-5 w-5 mr-3 text-teal-700 group-hover:text-teal-800" />
            <span className="text-foreground group-hover:text-teal-900">
              {action.label}
            </span>
          </Button>
        ))}
        <Button
          variant="ghost"
          className="w-full justify-start text-teal-700 hover:bg-teal-50 hover:text-teal-800 font-medium"
          onClick={() => setShowMore(!showMore)}
        >
          {showMore ? (
            <>
              <ChevronUp className="h-5 w-5 mr-3" />
              Show Less
            </>
          ) : (
            <>
              <ChevronDown className="h-5 w-5 mr-3" />
              Show More
            </>
          )}
        </Button>
      </nav>
    </div>
  );
};
