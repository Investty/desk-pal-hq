import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/components/ui/sonner";
import { format } from "date-fns";
import { Check, ClipboardCheck, X } from "lucide-react";

type Decision = "approved" | "rejected";

export default function AttendanceApprovals() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [target, setTarget] = useState<{ id: string; decision: Decision } | null>(null);
  const [note, setNote] = useState("");

  const { data: rows } = useQuery({
    queryKey: ["pending-attendance-requests"],
    queryFn: async () => {
      const { data } = await supabase
        .from("attendance_requests")
        .select("*")
        .eq("status", "pending")
        .order("date", { ascending: false });
      const list = data || [];
      if (!list.length) return [];
      const { data: people } = await supabase
        .from("profiles")
        .select("user_id, full_name, employee_id")
        .in("user_id", [...new Set(list.map((r) => r.user_id))]);
      const byUser = new Map((people || []).map((p) => [p.user_id, p]));
      return list.map((r) => ({ ...r, profiles: byUser.get(r.user_id) }));
    },
  });

  const decide = useMutation({
    mutationFn: async ({ id, decision, comment }: { id: string; decision: Decision; comment: string }) => {
      const { error } = await supabase
        .from("attendance_requests")
        .update({
          status: decision,
          reviewed_by: user!.id,
          reviewed_at: new Date().toISOString(),
          review_comment: comment.trim() || null,
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      toast.success(v.decision === "approved" ? "Approved — attendance updated" : "Request rejected");
      setTarget(null);
      setNote("");
      queryClient.invalidateQueries({ queryKey: ["pending-attendance-requests"] });
      queryClient.invalidateQueries({ queryKey: ["attendance"] });
      queryClient.invalidateQueries({ queryKey: ["team-attendance"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ClipboardCheck className="h-5 w-5" /> Attendance corrections & early leave
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Employee</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Request</TableHead>
              <TableHead>Check In</TableHead>
              <TableHead>Check Out</TableHead>
              <TableHead>Reason</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(rows || []).map((r) => {
              const p = (r as unknown as { profiles?: { full_name?: string; employee_id?: string } }).profiles;
              return (
                <TableRow key={r.id}>
                  <TableCell>
                    <p className="font-medium">{p?.full_name || "Unknown"}</p>
                    <p className="text-xs text-muted-foreground">{p?.employee_id}</p>
                  </TableCell>
                  <TableCell>{format(new Date(r.date), "MMM d, yyyy")}</TableCell>
                  <TableCell>{r.request_type === "early_leave" ? "Early leave" : "Correction"}</TableCell>
                  <TableCell>{r.requested_check_in ? format(new Date(r.requested_check_in), "hh:mm a") : "—"}</TableCell>
                  <TableCell>{r.requested_check_out ? format(new Date(r.requested_check_out), "hh:mm a") : "—"}</TableCell>
                  <TableCell className="max-w-[200px] truncate">{r.reason}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center gap-2 justify-end">
                      <Button size="sm" disabled={decide.isPending} onClick={() => { setNote(""); setTarget({ id: r.id, decision: "approved" }); }}>
                        <Check className="h-4 w-4 mr-1" /> Approve
                      </Button>
                      <Button size="sm" variant="outline" disabled={decide.isPending} onClick={() => { setNote(""); setTarget({ id: r.id, decision: "rejected" }); }}>
                        <X className="h-4 w-4 mr-1" /> Reject
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
            {(rows || []).length === 0 && (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No pending requests</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>

      <Dialog open={!!target} onOpenChange={(o) => { if (!o) setTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{target?.decision === "approved" ? "Approve this request" : "Reject this request"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label>
              Note for the employee {target?.decision === "rejected" ? <span className="text-destructive">*</span> : "(optional)"}
            </Label>
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add a short note" maxLength={500} />
            <p className="text-xs text-muted-foreground">
              {target?.decision === "approved"
                ? "Approving updates their attendance for that day and notifies them."
                : "Required — tell the employee why this was rejected."}
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTarget(null)}>Back</Button>
            <Button
              disabled={decide.isPending || (target?.decision === "rejected" && note.trim().length < 5)}
              onClick={() => target && decide.mutate({ ...target, comment: note })}
            >
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
