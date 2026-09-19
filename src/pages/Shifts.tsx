import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "@/components/ui/sonner";
import { format, addMonths, subMonths } from "date-fns";
import { Clock, Plus, Trash2, Copy } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

type Shift = {
  id: string;
  name: string;
  start_time: string;
  end_time: string;
  break_minutes: number;
  grace_minutes: number;
  is_default: boolean;
  is_active: boolean;
};

const monthKey = (d: Date) => format(d, "yyyy-MM-01");
const hhmm = (t: string) => (t || "").slice(0, 5);

export default function Shifts() {
  const { company } = useAuth();
  const qc = useQueryClient();
  const [month, setMonth] = useState(() => new Date());
  const [editing, setEditing] = useState<Partial<Shift> | null>(null);

  const period = monthKey(month);
  const prevPeriod = monthKey(subMonths(month, 1));

  const { data: shifts } = useQuery({
    queryKey: ["shifts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("shifts").select("*").order("start_time");
      if (error) throw error;
      return (data || []) as Shift[];
    },
  });

  const { data: people } = useQuery({
    queryKey: ["shift-people"],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("user_id, full_name, employee_id, designation")
        .eq("status", "active")
        .order("full_name");
      return data || [];
    },
  });

  const { data: roster } = useQuery({
    queryKey: ["roster", period],
    queryFn: async () => {
      const { data } = await supabase.from("employee_shifts").select("user_id, shift_id").eq("period_month", period);
      return new Map((data || []).map((r) => [r.user_id, r.shift_id]));
    },
  });

  const saveShift = useMutation({
    mutationFn: async (s: Partial<Shift>) => {
      if (!s.name?.trim()) throw new Error("Please give the shift a name");
      const payload = {
        name: s.name.trim().slice(0, 40),
        start_time: s.start_time || "09:30",
        end_time: s.end_time || "18:30",
        break_minutes: Number(s.break_minutes ?? 60),
        grace_minutes: Number(s.grace_minutes ?? 15),
        is_active: s.is_active ?? true,
      };
      if (s.id) {
        const { error } = await supabase.from("shifts").update(payload).eq("id", s.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("shifts").insert({ ...payload, company_id: company!.id });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Shift saved");
      setEditing(null);
      qc.invalidateQueries({ queryKey: ["shifts"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const makeDefault = useMutation({
    mutationFn: async (id: string) => {
      const { error: e1 } = await supabase.from("shifts").update({ is_default: false }).eq("is_default", true);
      if (e1) throw e1;
      const { error } = await supabase.from("shifts").update({ is_default: true, is_active: true }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Default shift updated");
      qc.invalidateQueries({ queryKey: ["shifts"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeShift = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("shifts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Shift removed");
      qc.invalidateQueries({ queryKey: ["shifts"] });
      qc.invalidateQueries({ queryKey: ["roster"] });
    },
    onError: (e: Error) => toast.error("This shift is in use for a month — clear it from the roster first"),
  });

  const assign = useMutation({
    mutationFn: async ({ userId, shiftId }: { userId: string; shiftId: string }) => {
      if (shiftId === "none") {
        const { error } = await supabase
          .from("employee_shifts")
          .delete()
          .eq("user_id", userId)
          .eq("period_month", period);
        if (error) throw error;
        return;
      }
      const { error } = await supabase
        .from("employee_shifts")
        .upsert(
          { company_id: company!.id, user_id: userId, period_month: period, shift_id: shiftId },
          { onConflict: "company_id,user_id,period_month" },
        );
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["roster", period] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const applyToAll = useMutation({
    mutationFn: async (shiftId: string) => {
      const rows = (people || []).map((p) => ({
        company_id: company!.id,
        user_id: p.user_id,
        period_month: period,
        shift_id: shiftId,
      }));
      if (!rows.length) return;
      const { error } = await supabase.from("employee_shifts").upsert(rows, { onConflict: "company_id,user_id,period_month" });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Shift applied to everyone for this month");
      qc.invalidateQueries({ queryKey: ["roster", period] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const copyPrev = useMutation({
    mutationFn: async () => {
      const { data } = await supabase.from("employee_shifts").select("user_id, shift_id").eq("period_month", prevPeriod);
      if (!data?.length) throw new Error("Nothing set for the previous month");
      const { error } = await supabase.from("employee_shifts").upsert(
        data.map((r) => ({ company_id: company!.id, user_id: r.user_id, period_month: period, shift_id: r.shift_id })),
        { onConflict: "company_id,user_id,period_month" },
      );
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Copied last month's shifts");
      qc.invalidateQueries({ queryKey: ["roster", period] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const defaultShift = (shifts || []).find((s) => s.is_default);

  return (
    <div className="space-y-6">
      <h1>Shifts &amp; working hours</h1>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="flex items-center gap-2"><Clock className="h-5 w-5" /> Shift timings</CardTitle>
          <Button size="sm" onClick={() => setEditing({ start_time: "09:30", end_time: "18:30", break_minutes: 60, grace_minutes: 15, is_active: true })}>
            <Plus className="h-4 w-4 mr-2" /> Add shift
          </Button>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Shift</TableHead>
                <TableHead>Timing</TableHead>
                <TableHead>Break</TableHead>
                <TableHead>Late after</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(shifts || []).map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">
                    {s.name} {s.is_default && <Badge variant="info" className="ml-2">Default</Badge>}
                  </TableCell>
                  <TableCell>{hhmm(s.start_time)} – {hhmm(s.end_time)}</TableCell>
                  <TableCell>{s.break_minutes} min</TableCell>
                  <TableCell>{s.grace_minutes} min grace</TableCell>
                  <TableCell><Badge variant={s.is_active ? "success" : "outline"}>{s.is_active ? "Active" : "Inactive"}</Badge></TableCell>
                  <TableCell className="text-right space-x-2">
                    <Button size="sm" variant="outline" onClick={() => setEditing(s)}>Edit</Button>
                    {!s.is_default && (
                      <>
                        <Button size="sm" variant="ghost" onClick={() => makeDefault.mutate(s.id)}>Make default</Button>
                        <Button size="sm" variant="ghost" onClick={() => removeShift.mutate(s.id)}><Trash2 className="h-4 w-4" /></Button>
                      </>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {(shifts || []).length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No shifts yet</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Monthly roster — {format(month, "MMMM yyyy")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setMonth(subMonths(month, 1))}>Previous month</Button>
            <Button variant="outline" size="sm" onClick={() => setMonth(addMonths(month, 1))}>Next month</Button>
            <Button variant="ghost" size="sm" onClick={() => copyPrev.mutate()} disabled={copyPrev.isPending}>
              <Copy className="h-4 w-4 mr-2" /> Copy last month
            </Button>
            <div className="flex items-center gap-2 ml-auto">
              <span className="text-sm text-muted-foreground">Apply to everyone</span>
              <Select onValueChange={(v) => applyToAll.mutate(v)}>
                <SelectTrigger className="w-44"><SelectValue placeholder="Pick a shift" /></SelectTrigger>
                <SelectContent>
                  {(shifts || []).filter((s) => s.is_active).map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            Anyone left on “Company default” follows {defaultShift ? `${defaultShift.name} (${hhmm(defaultShift.start_time)} – ${hhmm(defaultShift.end_time)})` : "the default shift"}.
          </p>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Designation</TableHead>
                <TableHead className="w-64">Shift this month</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(people || []).map((p) => (
                <TableRow key={p.user_id}>
                  <TableCell>
                    <p className="font-medium">{p.full_name}</p>
                    <p className="text-xs text-muted-foreground">{p.employee_id}</p>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{p.designation || "—"}</TableCell>
                  <TableCell>
                    <Select
                      value={roster?.get(p.user_id) || "none"}
                      onValueChange={(v) => assign.mutate({ userId: p.user_id, shiftId: v })}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Company default</SelectItem>
                        {(shifts || []).filter((s) => s.is_active).map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.name} ({hhmm(s.start_time)} – {hhmm(s.end_time)})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                </TableRow>
              ))}
              {(people || []).length === 0 && (
                <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-8">No employees yet</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!editing} onOpenChange={(o) => { if (!o) setEditing(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing?.id ? "Edit shift" : "New shift"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input maxLength={40} value={editing?.name || ""} onChange={(e) => setEditing({ ...editing, name: e.target.value })} placeholder="e.g. Night shift" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Starts at</Label>
                <Input type="time" value={hhmm(editing?.start_time || "09:30")} onChange={(e) => setEditing({ ...editing, start_time: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Ends at</Label>
                <Input type="time" value={hhmm(editing?.end_time || "18:30")} onChange={(e) => setEditing({ ...editing, end_time: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Break (minutes)</Label>
                <Input type="number" min={0} max={240} value={editing?.break_minutes ?? 60} onChange={(e) => setEditing({ ...editing, break_minutes: Number(e.target.value) })} />
              </div>
              <div className="space-y-2">
                <Label>Grace before late (minutes)</Label>
                <Input type="number" min={0} max={120} value={editing?.grace_minutes ?? 15} onChange={(e) => setEditing({ ...editing, grace_minutes: Number(e.target.value) })} />
              </div>
            </div>
            <div className="flex items-center justify-between rounded-md border border-border p-3">
              <div>
                <p className="font-medium text-sm">Active</p>
                <p className="text-xs text-muted-foreground">Inactive shifts cannot be assigned</p>
              </div>
              <Switch checked={editing?.is_active ?? true} onCheckedChange={(v) => setEditing({ ...editing, is_active: v })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            <Button disabled={saveShift.isPending} onClick={() => editing && saveShift.mutate(editing)}>Save shift</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
