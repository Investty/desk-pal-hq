import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { ShieldAlert } from "lucide-react";

export default function Suspended() {
  const { company, signOut, memberships, switchCompany } = useAuth();
  const others = memberships.filter((m) => m.company_id !== company?.id && m.company_status !== "suspended" && m.company_status !== "past_due");
  const pastDue = company?.status === "past_due";

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-destructive" />
            <CardTitle>{company?.name} is {pastDue ? "past due" : "suspended"}</CardTitle>
          </div>
          <CardDescription>
            {pastDue
              ? "Access is paused because of an unpaid balance. Settle the account to restore access."
              : "Access to this workspace is paused. Please contact support to reactivate the account."}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-2">
          {others.map((m) => (
            <Button key={m.company_id} variant="outline" className="w-full" onClick={() => switchCompany(m.company_id)}>
              Switch to {m.company_name}
            </Button>
          ))}
          <Button variant="ghost" className="w-full" onClick={signOut}>Sign out</Button>
        </CardContent>
      </Card>
    </div>
  );
}
