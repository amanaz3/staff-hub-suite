import { Search, Home, Bell } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { useNavigate } from 'react-router-dom';
import { useNotifications } from '@/hooks/useNotifications';

interface DashboardHeaderProps {
  currentUser: {
    name: string;
    email: string;
    avatar?: string;
  };
  onLogout: () => void;
}

export const DashboardHeader = ({ currentUser, onLogout }: DashboardHeaderProps) => {
  const navigate = useNavigate();
  const { unreadCount } = useNotifications();

  return (
    <header className="sticky top-0 z-50 bg-slate-800 border-b border-slate-700">
      <div className="container mx-auto px-6 py-3">
        <div className="flex items-center gap-6">
          {/* Logo */}
          <div className="text-xl font-bold text-white">INSPIRE</div>
          
          {/* Search Bar */}
          <div className="flex-1 max-w-2xl hidden md:block">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-700" />
              <Input 
                placeholder="Ask &quot;how much PTO do I have?&quot;"
                className="pl-10 bg-white border-0"
              />
            </div>
          </div>
          
          {/* Right actions */}
          <div className="flex items-center gap-4 ml-auto">
            <Button variant="ghost" size="icon" className="text-white hover:bg-slate-700">
              <Home className="h-5 w-5" />
            </Button>
            
            <Button variant="ghost" size="icon" className="relative text-white hover:bg-slate-700">
              <Bell className="h-5 w-5" />
              {unreadCount > 0 && (
                <Badge 
                  variant="destructive"
                  className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
                >
                  {unreadCount > 9 ? '9+' : unreadCount}
                </Badge>
              )}
            </Button>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-10 w-10 rounded-full">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={currentUser.avatar} alt={currentUser.name} />
                    <AvatarFallback className="bg-primary text-primary-foreground">
                      {currentUser.name.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem onClick={() => navigate('/profile')}>
                  View Profile
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onLogout}>
                  Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </header>
  );
};
