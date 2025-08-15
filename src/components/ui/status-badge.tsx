import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { CheckCircle, Clock, XCircle, AlertCircle, UserCheck, UserX } from "lucide-react";

const statusBadgeVariants = cva(
  "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors",
  {
    variants: {
      variant: {
        approved: "bg-status-approved-light text-status-approved border-status-approved/20",
        pending: "bg-status-pending-light text-status-pending border-status-pending/20",
        rejected: "bg-status-rejected-light text-status-rejected border-status-rejected/20",
        present: "bg-status-approved-light text-status-approved border-status-approved/20",
        absent: "bg-status-rejected-light text-status-rejected border-status-rejected/20",
        late: "bg-status-pending-light text-status-pending border-status-pending/20",
      },
    },
    defaultVariants: {
      variant: "pending",
    },
  }
);

const statusIcons = {
  approved: CheckCircle,
  pending: Clock,
  rejected: XCircle,
  present: UserCheck,
  absent: UserX,
  late: AlertCircle,
};

export interface StatusBadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof statusBadgeVariants> {
  children: React.ReactNode;
  showIcon?: boolean;
}

const StatusBadge = ({ 
  className, 
  variant = "pending", 
  children, 
  showIcon = true,
  ...props 
}: StatusBadgeProps) => {
  const Icon = variant ? statusIcons[variant] : Clock;

  return (
    <div 
      className={cn(statusBadgeVariants({ variant }), className)}
      role="status"
      aria-label={`Status: ${children}`}
      {...props}
    >
      {showIcon && Icon && <Icon className="h-3 w-3" aria-hidden="true" />}
      <span className="capitalize">{children}</span>
    </div>
  );
};

export { StatusBadge, statusBadgeVariants };