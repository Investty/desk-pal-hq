import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Building2, LogOut } from "lucide-react";

export default function JoinCompany() {
  const { memberships, switchCompany, refresh, signOut } = useAuth();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  const join = async () => {
    if (!code.trim()) return;
    setBusy(true);
    const { error } = await supabase.rpc("redeem_invite", { _code: code.trim() });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("You have joined the company");
    setCode("");
    await refresh();
    navigate("/");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            <CardTitle>Join a company</CardTitle>
          </div>
          <CardDescription>
            Enter the invite code your HR team shared with you. You can belong to more than one company.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="code">Invite code</Label>
            <Input id="code" value={code} placeholder="ABC123" onChange={(e) => setCode(e.target.value.toUpperCase())} />
          </div>
          <Button className="w-full" onClick={join} disabled={busy}>
            {busy ? "Joining..." : "Join company"}
          </Button>

          {memberships.length > 0 && (
            <div className="space-y-2 pt-2 border-t">
              <p className="text-sm text-muted-foreground">Your companies</p>
              {memberships.map((m) => (
                <button
                  key={m.company_id}
                  onClick={async () => { await switchCompany(m.company_id); navigate("/"); }}
                  className="w-full flex items-center justify-between rounded-md border px-3 py-2 text-sm hover:bg-accent"
                >
                  <span>{m.company_name}</span>
                  <Badge variant="secondary" className="uppercase text-xs">{m.role === "hr" ? "HR" : m.role}</Badge>
                </button>
              ))}
            </div>
          )}

          <Button variant="ghost" className="w-full" onClick={signOut}>
            <LogOut className="h-4 w-4 mr-2" /> Sign out
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
