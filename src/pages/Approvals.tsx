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

export default function Approvals() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: requests, isLoading } = useQuery({
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

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "approved" | "rejected" }) => {
      const { error } = await supabase.from("leave_requests").update({
        status,
        approved_by: user!.id,
        reviewed_at: new Date().toISOString(),
      }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, { status }) => {
      toast.success(`Leave request ${status}!`);
      queryClient.invalidateQueries({ queryKey: ["pending-approvals"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><CheckSquare className="h-6 w-6" /> Approvals</h1>
        <p className="text-muted-foreground">Review and manage leave requests</p>
      </div>

      <Card>
        <CardHeader><CardTitle>Pending Requests</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>From</TableHead>
                <TableHead>To</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Applied</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {requests?.map((req) => {
                const profile = (req as any).profiles;
                return (
                  <TableRow key={req.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{profile?.full_name || "Unknown"}</p>
                        <p className="text-xs text-muted-foreground">{profile?.employee_id}</p>
                      </div>
                    </TableCell>
                    <TableCell className="capitalize">{req.leave_type}</TableCell>
                    <TableCell>{format(new Date(req.start_date), "MMM d, yyyy")}</TableCell>
                    <TableCell>{format(new Date(req.end_date), "MMM d, yyyy")}</TableCell>
                    <TableCell className="max-w-[200px] truncate">{req.reason || "—"}</TableCell>
                    <TableCell>{format(new Date(req.created_at), "MMM d")}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center gap-2 justify-end">
                        <Button size="sm" onClick={() => updateStatus.mutate({ id: req.id, status: "approved" })} disabled={updateStatus.isPending}>
                          <Check className="h-4 w-4 mr-1" /> Approve
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => updateStatus.mutate({ id: req.id, status: "rejected" })} disabled={updateStatus.isPending}>
                          <X className="h-4 w-4 mr-1" /> Reject
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
              {requests?.length === 0 && (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No pending requests</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
