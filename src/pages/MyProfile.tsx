import { UserCircle } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import PersonalDetails from "@/components/profile/PersonalDetails";
import EmploymentDetails from "@/components/profile/EmploymentDetails";
import Documents from "@/pages/Documents";
import Onboarding from "@/pages/Onboarding";
import Payroll from "@/pages/Payroll";
import Performance from "@/pages/Performance";

export default function MyProfile() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><UserCircle className="h-6 w-6" /> My Profile</h1>
        <p className="text-muted-foreground">Your personal, employment and workplace information</p>
      </div>

      <Tabs defaultValue="personal" className="space-y-6">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="personal">Personal</TabsTrigger>
          <TabsTrigger value="employment">Employment &amp; Position</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="onboarding">Onboarding</TabsTrigger>
          <TabsTrigger value="payroll">Payroll</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
        </TabsList>

        <TabsContent value="personal"><PersonalDetails /></TabsContent>
        <TabsContent value="employment"><EmploymentDetails /></TabsContent>
        <TabsContent value="documents"><Documents /></TabsContent>
        <TabsContent value="onboarding"><Onboarding /></TabsContent>
        <TabsContent value="payroll"><Payroll /></TabsContent>
        <TabsContent value="performance"><Performance /></TabsContent>
      </Tabs>
    </div>
  );
}
