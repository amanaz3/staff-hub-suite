import { forwardRef } from "react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { type LucideIcon } from "lucide-react";

interface EnhancedCardProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: string;
  subtitle?: string;
  icon?: LucideIcon;
  variant?: 'default' | 'elevated' | 'interactive';
  loading?: boolean;
}

const EnhancedCard = forwardRef<HTMLDivElement, EnhancedCardProps>(
  ({ className, title, subtitle, icon: Icon, variant = 'default', loading, children, ...props }, ref) => {
    return (
      <Card
        ref={ref}
        className={cn(
          "border border-card-border bg-card",
          variant === 'elevated' && "card-elevated",
          variant === 'interactive' && "card-interactive",
          loading && "opacity-60 pointer-events-none",
          className
        )}
        {...props}
      >
        {(title || subtitle || Icon) && (
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-3 text-lg">
              {Icon && (
                <div className="flex-shrink-0 p-2 bg-primary/10 rounded-lg">
                  <Icon className="h-5 w-5 text-primary" aria-hidden="true" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                {title && (
                  <h3 className="font-semibold text-foreground truncate">{title}</h3>
                )}
                {subtitle && (
                  <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
                )}
              </div>
            </CardTitle>
          </CardHeader>
        )}
        <CardContent className={cn(title || subtitle || Icon ? "pt-0" : "")}>
          {loading ? (
            <div className="space-y-3">
              <div className="loading-skeleton h-4 w-3/4"></div>
              <div className="loading-skeleton h-4 w-1/2"></div>
              <div className="loading-skeleton h-8 w-full"></div>
            </div>
          ) : (
            children
          )}
        </CardContent>
      </Card>
    );
  }
);

EnhancedCard.displayName = "EnhancedCard";

export { EnhancedCard };