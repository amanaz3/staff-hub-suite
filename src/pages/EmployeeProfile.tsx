import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ArrowLeft, Edit } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";

interface EmployeeData {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  department: string;
  division: string | null;
  position: string;
  hire_date: string;
  employee_id: string;
  staff_id: string | null;
}

export default function EmployeeProfile() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [employee, setEmployee] = useState<EmployeeData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchEmployeeData = async () => {
      if (!user) return;

      try {
        const { data, error } = await supabase
          .from("employees")
          .select("*")
          .eq("user_id", user.id)
          .single();

        if (error) throw error;
        setEmployee(data);
      } catch (error) {
        console.error("Error fetching employee data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchEmployeeData();
  }, [user]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Loading profile...</p>
      </div>
    );
  }

  if (!employee) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Employee data not found</p>
      </div>
    );
  }

  const nameParts = employee.full_name.split(" ");
  const firstName = nameParts[0] || "";
  const lastName = nameParts.slice(1).join(" ") || "";
  const initials = `${firstName[0] || ""}${lastName[0] || ""}`.toUpperCase();

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Header */}
      <div className="bg-[hsl(var(--primary))] text-primary-foreground p-6">
        <div className="container mx-auto">
          <div className="flex items-center gap-6">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/")}
              className="text-primary-foreground hover:bg-primary-foreground/10"
            >
              <ArrowLeft className="h-6 w-6" />
            </Button>
            <Avatar className="h-24 w-24 border-4 border-primary-foreground/20">
              <AvatarImage src={profile?.avatar_url || ""} />
              <AvatarFallback className="text-2xl bg-primary-foreground/20">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div>
              <h1 className="text-3xl font-bold">Personal Details</h1>
              <p className="text-primary-foreground/80 text-lg mt-1">{employee.full_name}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto py-8 px-4 max-w-4xl">
        <Accordion type="multiple" defaultValue={["name", "demographic"]} className="space-y-4">
          {/* Name Section */}
          <AccordionItem value="name" className="bg-card rounded-lg border">
            <AccordionTrigger className="px-6 py-4 hover:no-underline">
              <span className="text-xl font-semibold">Name</span>
            </AccordionTrigger>
            <AccordionContent className="px-6 pb-6">
              <div className="space-y-6">
                {/* Global Name */}
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm text-muted-foreground uppercase tracking-wide">Global Name</h3>
                    <Button variant="ghost" size="sm">
                      <Edit className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <p className="text-sm font-medium text-foreground">Start Date</p>
                      <p className="text-sm text-muted-foreground">
                        {format(new Date(employee.hire_date), "MM/dd/yy")}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">Last Name</p>
                      <p className="text-sm text-muted-foreground">{lastName || "N/A"}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">Name Style</p>
                      <p className="text-sm text-muted-foreground">United States</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">First Name</p>
                      <p className="text-sm text-muted-foreground">{firstName || "N/A"}</p>
                    </div>
                  </div>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* Demographic Info Section */}
          <AccordionItem value="demographic" className="bg-card rounded-lg border">
            <AccordionTrigger className="px-6 py-4 hover:no-underline">
              <div className="flex items-center justify-between w-full pr-4">
                <span className="text-xl font-semibold">Demographic Info</span>
                <Button variant="outline" size="sm" className="mr-2">
                  <span className="text-sm">+ Add</span>
                </Button>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-6 pb-6">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div></div>
                  <Button variant="ghost" size="sm">
                    <Edit className="h-4 w-4" />
                  </Button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <p className="text-sm font-medium text-foreground">Country</p>
                    <p className="text-sm text-muted-foreground">United Arab Emirates</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">Start Date</p>
                    <p className="text-sm text-muted-foreground">
                      {format(new Date(employee.hire_date), "MM/dd/yy")}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">Department</p>
                    <p className="text-sm text-muted-foreground">{employee.department}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">Position</p>
                    <p className="text-sm text-muted-foreground">{employee.position}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">Employee ID</p>
                    <p className="text-sm text-muted-foreground">{employee.employee_id}</p>
                  </div>
                  {employee.staff_id && (
                    <div>
                      <p className="text-sm font-medium text-foreground">Staff ID</p>
                      <p className="text-sm text-muted-foreground">{employee.staff_id}</p>
                    </div>
                  )}
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* Contact Information Section */}
          <AccordionItem value="contact" className="bg-card rounded-lg border">
            <AccordionTrigger className="px-6 py-4 hover:no-underline">
              <span className="text-xl font-semibold">Contact Information</span>
            </AccordionTrigger>
            <AccordionContent className="px-6 pb-6">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div></div>
                  <Button variant="ghost" size="sm">
                    <Edit className="h-4 w-4" />
                  </Button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <p className="text-sm font-medium text-foreground">Email</p>
                    <p className="text-sm text-muted-foreground">{employee.email}</p>
                  </div>
                  {employee.phone && (
                    <div>
                      <p className="text-sm font-medium text-foreground">Phone</p>
                      <p className="text-sm text-muted-foreground">{employee.phone}</p>
                    </div>
                  )}
                  {employee.division && (
                    <div>
                      <p className="text-sm font-medium text-foreground">Division</p>
                      <p className="text-sm text-muted-foreground">{employee.division}</p>
                    </div>
                  )}
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>
    </div>
  );
}
