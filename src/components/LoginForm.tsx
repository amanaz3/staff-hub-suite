import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Users, Lock, Mail } from "lucide-react";

interface LoginFormProps {
  onLogin: (role: 'admin' | 'staff', userData: any) => void;
}

export const LoginForm = ({ onLogin }: LoginFormProps) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  // Demo accounts for testing
  const demoAccounts = {
    admin: {
      email: "admin@company.com",
      password: "admin123",
      name: "Sarah Johnson",
      role: "admin" as const
    },
    staff: {
      email: "staff@company.com", 
      password: "staff123",
      name: "John Smith",
      role: "staff" as const
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Check demo credentials
    const isAdmin = email === demoAccounts.admin.email && password === demoAccounts.admin.password;
    const isStaff = email === demoAccounts.staff.email && password === demoAccounts.staff.password;

    if (isAdmin || isStaff) {
      const userData = isAdmin ? demoAccounts.admin : demoAccounts.staff;
      toast({
        title: "Login Successful",
        description: `Welcome back, ${userData.name}!`,
      });
      onLogin(userData.role, userData);
    } else {
      toast({
        title: "Login Failed",
        description: "Invalid email or password. Try the demo accounts below.",
        variant: "destructive",
      });
    }

    setIsLoading(false);
  };

  const handleDemoLogin = (type: 'admin' | 'staff') => {
    const account = demoAccounts[type];
    setEmail(account.email);
    setPassword(account.password);
    onLogin(account.role, account);
    toast({
      title: "Demo Login",
      description: `Logged in as ${account.name} (${type})`,
    });
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Logo and Header */}
        <div className="text-center space-y-4">
          <div className="mx-auto w-16 h-16 bg-primary rounded-2xl flex items-center justify-center">
            <Users className="h-8 w-8 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-foreground">HRFlow</h1>
            <p className="text-muted-foreground">Human Resources Management</p>
          </div>
        </div>

        {/* Login Form */}
        <Card className="shadow-lg border-0 bg-card">
          <CardHeader className="space-y-2 text-center">
            <CardTitle className="text-2xl font-semibold">Welcome Back</CardTitle>
            <CardDescription>
              Sign in to your account to continue
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-medium">
                  Email Address
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="Enter your email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm font-medium">
                  Password
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10"
                    required
                  />
                </div>
              </div>

              <Button
                type="submit"
                className="w-full bg-primary hover:bg-primary/90"
                disabled={isLoading}
              >
                {isLoading ? "Signing in..." : "Sign In"}
              </Button>
            </form>

            {/* Demo Accounts */}
            <div className="space-y-4">
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-border" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground">
                    Demo Accounts
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Button
                  variant="outline"
                  onClick={() => handleDemoLogin('admin')}
                  className="flex flex-col h-auto p-4 space-y-2"
                >
                  <Badge variant="secondary" className="text-xs">Admin</Badge>
                  <span className="text-xs text-muted-foreground">
                    Full Access
                  </span>
                </Button>

                <Button
                  variant="outline"
                  onClick={() => handleDemoLogin('staff')}
                  className="flex flex-col h-auto p-4 space-y-2"
                >
                  <Badge variant="outline" className="text-xs">Staff</Badge>
                  <span className="text-xs text-muted-foreground">
                    Employee View
                  </span>
                </Button>
              </div>

              <div className="text-center">
                <p className="text-xs text-muted-foreground">
                  Use demo accounts to explore the HR system
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center text-xs text-muted-foreground">
          <p>© 2024 HRFlow. Streamline your workforce management.</p>
        </div>
      </div>
    </div>
  );
};