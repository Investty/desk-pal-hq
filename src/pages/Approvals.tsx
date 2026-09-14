import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { format } from "date-fns";
import { CheckSquare, Check, X } from "lucide-react";
import AttendanceApprovals from "@/components/attendance/AttendanceApprovals";
import AttendanceFlags from "@/components/attendance/AttendanceFlags";
import { Input } from "@/components/ui/input";
import { ListPager } from "@/components/ui/list-pager";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const PAGE_SIZE = 20;
const LEAVE_TYPES = ["sick", "casual", "paid", "compensatory", "bereavement", "maternity", "paternity"];

type Stage = "manager" | "hr";
type RevokeAction = "cancelled" | "rejected";

type WithProfile<T> = T & { profiles?: { full_name: string; employee_id: string } };

async function attachProfiles<T extends { user_id: string }>(rows: T[]): Promise<WithProfile<T>[]> {
  if (!rows.length) return rows as WithProfile<T>[];
  const { data } = await supabase
    .from("profiles")
    .select("user_id, full_name, employee_id")
    .in("user_id", [...new Set(rows.map((r) => r.user_id))]);
  const byUser = new Map((data || []).map((p) => [p.user_id, p]));
  return rows.map((r) => ({ ...r, profiles: byUser.get(r.user_id) })) as WithProfile<T>[];
}

export default function Approvals() {
  const { user, isAdmin, isManager, hasFeature } = useAuth();
  const queryClient = useQueryClient();
  const [noteTarget, setNoteTarget] = useState<{ id: string; action: RevokeAction } | null>(null);
  const [note, setNote] = useState("");
  const [apType, setApType] = useState("all");
  const [apFrom, setApFrom] = useState("");
  const [apTo, setApTo] = useState("");
  const [apPage, setApPage] = useState(0);


  const { data: requests } = useQuery({
    queryKey: ["pending-approvals"],
    queryFn: async () => {
      const { data } = await supabase
        .from("leave_requests")
        .select("*")
        .eq("status", "pending")
        .order("created_at", { ascending: false });
      return await attachProfiles(data || []);
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

  const { data: approvedPage } = useQuery({
    queryKey: ["approved-leaves", apType, apFrom, apTo, apPage],
    queryFn: async () => {
      let q = supabase
        .from("leave_requests")
        .select("*", { count: "exact" })
        .eq("status", "approved")
        .order("start_date", { ascending: false });
      if (apType !== "all") q = q.eq("leave_type", apType as "sick");
      if (apFrom) q = q.gte("start_date", apFrom);
      if (apTo) q = q.lte("end_date", apTo);
      const { data, count } = await q.range(apPage * PAGE_SIZE, apPage * PAGE_SIZE + PAGE_SIZE - 1);
      return { rows: await attachProfiles(data || []), count: count || 0 };
    },
  });
  const approved = approvedPage?.rows;

  const revoke = useMutation({
    mutationFn: async ({ id, action, comment }: { id: string; action: RevokeAction; comment: string }) => {
      const now = new Date().toISOString();
      const who = isAdmin ? "HR" : "your reporting manager";
      const text = comment.trim() || (action === "cancelled" ? `Cancelled by ${who}` : `Rejected by ${who} after approval`);
      type Patch = Partial<import("@/integrations/supabase/types").Database["public"]["Tables"]["leave_requests"]["Update"]>;
      const patch: Patch = {
        status: action,
        approved_by: user!.id,
        reviewed_at: now,
      };
      if (isAdmin) {
        patch.hr_status = action;
        patch.hr_reviewed_by = user!.id;
        patch.hr_reviewed_at = now;
        patch.hr_comment = text;
      } else {
        patch.manager_status = action;
        patch.manager_reviewed_by = user!.id;
        patch.manager_reviewed_at = now;
        patch.manager_comment = text;
      }
      const { error } = await supabase.from("leave_requests").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      toast.success(v.action === "cancelled" ? "Leave cancelled and days returned" : "Leave rejected and days returned");
      setNoteTarget(null);
      setNote("");
      queryClient.invalidateQueries({ queryKey: ["approved-leaves"] });
      queryClient.invalidateQueries({ queryKey: ["cancelled-leaves"] });
      queryClient.invalidateQueries({ queryKey: ["pending-approvals"] });
      queryClient.invalidateQueries({ queryKey: ["leave-requests"] });
      queryClient.invalidateQueries({ queryKey: ["leave-balances"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });


  const [canPage, setCanPage] = useState(0);
  const { data: cancelledPage } = useQuery({
    queryKey: ["cancelled-leaves", canPage],
    queryFn: async () => {
      const { data, count } = await supabase
        .from("leave_requests")
        .select("*", { count: "exact" })
        .eq("status", "cancelled")
        .order("updated_at", { ascending: false })
        .range(canPage * PAGE_SIZE, canPage * PAGE_SIZE + PAGE_SIZE - 1);
      return { rows: await attachProfiles(data || []), count: count || 0 };
    },
  });
  const cancelled = cancelledPage?.rows;

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
          <TableHead>Duration</TableHead>
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
              <TableCell className="whitespace-nowrap text-xs">
                {req.day_portion === "full_day"
                  ? `Full day · ${Math.round((new Date(req.end_date).getTime() - new Date(req.start_date).getTime()) / 86400000) + 1}d`
                  : `${req.day_portion === "first_half" ? "First half" : "Second half"} · 0.5d`}
              </TableCell>
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
          <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">{emptyText}</TableCell></TableRow>
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

      <AttendanceApprovals />

      {isAdmin && hasFeature("attendance_regularization") && <AttendanceFlags />}

      {isAdmin && (
        <Card>
          <CardHeader><CardTitle>Stage 2 — HR</CardTitle></CardHeader>
          <CardContent>{renderTable(hrQueue, "hr", "No requests awaiting HR review")}</CardContent>
        </Card>
      )}

      {(isAdmin || isManager) && (
        <Card>
          <CardHeader><CardTitle>Approved leaves — cancel or reject</CardTitle></CardHeader>

          <CardContent>
            <div className="flex flex-wrap items-end gap-3 mb-4">
              <Select value={apType} onValueChange={(v) => { setApPage(0); setApType(v); }}>
                <SelectTrigger className="w-44"><SelectValue placeholder="All leave types" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All leave types</SelectItem>
                  {LEAVE_TYPES.map((t) => (<SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>))}
                </SelectContent>
              </Select>
              <div>
                <Label className="text-xs">From</Label>
                <Input type="date" value={apFrom} onChange={(e) => { setApPage(0); setApFrom(e.target.value); }} />
              </div>
              <div>
                <Label className="text-xs">To</Label>
                <Input type="date" value={apTo} onChange={(e) => { setApPage(0); setApTo(e.target.value); }} />
              </div>
              {(apType !== "all" || apFrom || apTo) && (
                <Button variant="ghost" size="sm" onClick={() => { setApType("all"); setApFrom(""); setApTo(""); setApPage(0); }}>Clear</Button>
              )}
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>From</TableHead>
                  <TableHead>To</TableHead>
                  <TableHead>Days</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(approved || []).map((req) => {
                  const profile = (req as unknown as { profiles?: { full_name?: string; employee_id?: string } }).profiles;
                  const days = Math.round((new Date(req.end_date).getTime() - new Date(req.start_date).getTime()) / 86400000) + 1;
                  const started = req.start_date < new Date().toISOString().slice(0, 10);
                  return (
                    <TableRow key={req.id}>
                      <TableCell>
                        <p className="font-medium">{profile?.full_name || "Unknown"}</p>
                        <p className="text-xs text-muted-foreground">{profile?.employee_id}</p>
                      </TableCell>
                      <TableCell className="capitalize">{req.leave_type}</TableCell>
                      <TableCell>{format(new Date(req.start_date), "MMM d, yyyy")}</TableCell>
                      <TableCell>{format(new Date(req.end_date), "MMM d, yyyy")}</TableCell>
                      <TableCell>{days}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center gap-2 justify-end">
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={revoke.isPending || started}
                            title={started ? "This leave has already started" : undefined}
                            onClick={() => { setNote(""); setNoteTarget({ id: req.id, action: "cancelled" }); }}
                          >
                            <X className="h-4 w-4 mr-1" /> Cancel
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            disabled={revoke.isPending}
                            onClick={() => { setNote(""); setNoteTarget({ id: req.id, action: "rejected" }); }}

                          >
                            <X className="h-4 w-4 mr-1" /> Reject
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {(approved || []).length === 0 && (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No approved leaves</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
            <ListPager page={apPage} pageSize={PAGE_SIZE} total={approvedPage?.count ?? 0} onPage={setApPage} />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle>Cancelled by employees</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>From</TableHead>
                <TableHead>To</TableHead>
                <TableHead>Manager</TableHead>
                <TableHead>HR</TableHead>
                <TableHead>Days returned</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(cancelled || []).map((req) => {
                const profile = (req as unknown as { profiles?: { full_name?: string; employee_id?: string } }).profiles;
                const days = Math.round((new Date(req.end_date).getTime() - new Date(req.start_date).getTime()) / 86400000) + 1;
                return (
                  <TableRow key={req.id}>
                    <TableCell>
                      <p className="font-medium">{profile?.full_name || "Unknown"}</p>
                      <p className="text-xs text-muted-foreground">{profile?.employee_id}</p>
                    </TableCell>
                    <TableCell className="capitalize">{req.leave_type}</TableCell>
                    <TableCell>{format(new Date(req.start_date), "MMM d, yyyy")}</TableCell>
                    <TableCell>{format(new Date(req.end_date), "MMM d, yyyy")}</TableCell>
                    <TableCell><Badge variant="outline">{req.manager_status}</Badge></TableCell>
                    <TableCell><Badge variant="outline">{req.hr_status}</Badge></TableCell>
                    <TableCell>{days}</TableCell>
                  </TableRow>
                );
              })}
              {(cancelled || []).length === 0 && (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No cancelled requests</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
          <ListPager page={canPage} pageSize={PAGE_SIZE} total={cancelledPage?.count ?? 0} onPage={setCanPage} />
        </CardContent>
      </Card>

      <Dialog open={!!noteTarget} onOpenChange={(o) => { if (!o) setNoteTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{noteTarget?.action === "cancelled" ? "Cancel this leave" : "Reject this leave"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Note for the employee</Label>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Explain why, e.g. project deadline moved"
            />
            <p className="text-xs text-muted-foreground">The employee gets a notification with this note, and the days go back to their balance.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNoteTarget(null)}>Back</Button>
            <Button
              disabled={revoke.isPending}
              onClick={() => noteTarget && revoke.mutate({ ...noteTarget, comment: note })}
            >
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>

  );
}
