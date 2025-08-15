import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface NavigationItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  href?: string;
  badge?: string | number;
}

interface NavigationProps {
  items: NavigationItem[];
  activeItem: string;
  onItemClick: (itemId: string) => void;
  className?: string;
  orientation?: 'horizontal' | 'vertical';
}

export const Navigation = ({ 
  items, 
  activeItem, 
  onItemClick, 
  className,
  orientation = 'vertical' 
}: NavigationProps) => {
  return (
    <nav 
      className={cn("space-y-1", className)}
      role="navigation"
      aria-label="Main navigation"
    >
      {items.map((item) => {
        const Icon = item.icon;
        const isActive = activeItem === item.id;
        
        return (
          <Button
            key={item.id}
            variant={isActive ? "default" : "ghost"}
            onClick={() => onItemClick(item.id)}
            className={cn(
              "nav-item w-full justify-start",
              isActive && "nav-item-active",
              orientation === 'horizontal' && "flex-col h-auto py-2 px-3"
            )}
            aria-current={isActive ? "page" : undefined}
          >
            <Icon 
              className={cn(
                "h-4 w-4", 
                orientation === 'vertical' ? "mr-3" : "mb-1"
              )} 
              aria-hidden="true" 
            />
            <span className={cn(
              "text-sm",
              orientation === 'horizontal' && "text-xs"
            )}>
              {item.label}
            </span>
            {item.badge && (
              <span 
                className="ml-auto bg-primary/10 text-primary px-2 py-0.5 rounded-full text-xs"
                aria-label={`${item.badge} notifications`}
              >
                {item.badge}
              </span>
            )}
          </Button>
        );
      })}
    </nav>
  );
};

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
  className?: string;
}

export const Breadcrumb = ({ items, className }: BreadcrumbProps) => {
  return (
    <nav 
      className={cn("flex items-center space-x-1 text-sm text-muted-foreground", className)}
      aria-label="Breadcrumb"
    >
      <ol className="flex items-center space-x-1">
        {items.map((item, index) => (
          <li key={index} className="flex items-center">
            {index > 0 && (
              <span className="mx-2 text-muted-foreground/50" aria-hidden="true">
                /
              </span>
            )}
            {index === items.length - 1 ? (
              <span className="font-medium text-foreground" aria-current="page">
                {item.label}
              </span>
            ) : (
              <button 
                className="hover:text-foreground transition-colors"
                onClick={() => {/* Handle navigation */}}
              >
                {item.label}
              </button>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
};