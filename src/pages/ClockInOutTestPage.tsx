import { ClockInOutTest } from "@/components/ClockInOutTest";
import { useAuth } from "@/hooks/useAuth";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ShieldAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export const ClockInOutTestPage = () => {
  const { profile } = useAuth();

  // Admin-only access check
  if (profile?.role !== 'admin') {
    return (
      <div className="container mx-auto px-4 sm:px-6 py-8">
        <Alert variant="destructive">
          <ShieldAlert className="h-4 w-4" />
          <AlertTitle>Access Denied</AlertTitle>
          <AlertDescription>
            This page is restricted to administrators only. Please contact your system administrator if you need access.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 sm:px-6 py-8">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-bold text-foreground">Clock-In/Out Testing</h1>
            <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20">
              Admin Only
            </Badge>
          </div>
          <p className="text-muted-foreground mt-2">
            Test and trace clock-in/out operations with detailed backend logging and performance metrics.
          </p>
        </div>
      </div>
      <ClockInOutTest />
    </div>
  );
};
