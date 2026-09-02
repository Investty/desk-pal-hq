import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { format } from "date-fns";
import { CheckSquare, Check, X } from "lucide-react";

type Stage = "manager" | "hr";

export default function Approvals() {
  const { user, isAdmin } = useAuth();
  const queryClient = useQueryClient();

  const { data: requests } = useQuery({
    queryKey: ["pending-approvals"],
    queryFn: async () => {
      const { data } = await supabase
        .from("leave_requests")
        .select("*, profiles!leave_requests_user_id_fkey(full_name, employee_id)")
        .eq("status", "pending")
        .order("created_at", { ascending: false });
      return data || [];
    },
  });

  const decide = useMutation({
    mutationFn: async ({ id, stage, decision }: { id: string; stage: Stage; decision: "approved" | "rejected" }) => {
      const now = new Date().toISOString();
      type Patch = Partial<import("@/integrations/supabase/types").Database["public"]["Tables"]["leave_requests"]["Update"]>;
      const patch: Patch =
        stage === "manager"
          ? { manager_status: decision, manager_reviewed_by: user!.id, manager_reviewed_at: now }
          : { hr_status: decision, hr_reviewed_by: user!.id, hr_reviewed_at: now };

      if (decision === "rejected") {
        patch.status = "rejected";
        patch.approved_by = user!.id;
        patch.reviewed_at = now;
      } else if (stage === "hr") {
        patch.status = "approved";
        patch.approved_by = user!.id;
        patch.reviewed_at = now;
      }

      const { error } = await supabase.from("leave_requests").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Decision recorded");
      queryClient.invalidateQueries({ queryKey: ["pending-approvals"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const managerQueue = (requests || []).filter((r) => r.manager_status === "pending");
  const hrQueue = (requests || []).filter((r) => r.manager_status === "approved" && r.hr_status === "pending");

  const renderTable = (rows: typeof managerQueue, stage: Stage, emptyText: string) => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Employee</TableHead>
          <TableHead>Type</TableHead>
          <TableHead>From</TableHead>
          <TableHead>To</TableHead>
          <TableHead>Reason</TableHead>
          {stage === "hr" && <TableHead>Manager</TableHead>}
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((req) => {
          const profile = (req as unknown as { profiles?: { full_name?: string; employee_id?: string } }).profiles;
          return (
            <TableRow key={req.id}>
              <TableCell>
                <p className="font-medium">{profile?.full_name || "Unknown"}</p>
                <p className="text-xs text-muted-foreground">{profile?.employee_id}</p>
              </TableCell>
              <TableCell className="capitalize">{req.leave_type}</TableCell>
              <TableCell>{format(new Date(req.start_date), "MMM d, yyyy")}</TableCell>
              <TableCell>{format(new Date(req.end_date), "MMM d, yyyy")}</TableCell>
              <TableCell className="max-w-[200px] truncate">{req.reason || "—"}</TableCell>
              {stage === "hr" && <TableCell><Badge>Approved</Badge></TableCell>}
              <TableCell className="text-right">
                <div className="flex items-center gap-2 justify-end">
                  <Button size="sm" onClick={() => decide.mutate({ id: req.id, stage, decision: "approved" })} disabled={decide.isPending}>
                    <Check className="h-4 w-4 mr-1" /> Approve
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => decide.mutate({ id: req.id, stage, decision: "rejected" })} disabled={decide.isPending}>
                    <X className="h-4 w-4 mr-1" /> Reject
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          );
        })}
        {rows.length === 0 && (
          <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">{emptyText}</TableCell></TableRow>
        )}
      </TableBody>
    </Table>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><CheckSquare className="h-6 w-6" /> Approvals</h1>
        <p className="text-muted-foreground">Leave requests move through the reporting manager, then HR</p>
      </div>

      <Card>
        <CardHeader><CardTitle>Stage 1 — Reporting Manager</CardTitle></CardHeader>
        <CardContent>{renderTable(managerQueue, "manager", "No requests awaiting manager review")}</CardContent>
      </Card>

      {isAdmin && (
        <Card>
          <CardHeader><CardTitle>Stage 2 — HR</CardTitle></CardHeader>
          <CardContent>{renderTable(hrQueue, "hr", "No requests awaiting HR review")}</CardContent>
        </Card>
      )}
    </div>
  );
}
