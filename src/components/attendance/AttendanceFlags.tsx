import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { format } from "date-fns";
import { AlertTriangle, Plus } from "lucide-react";

export default function AttendanceFlags() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [employee, setEmployee] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [reason, setReason] = useState("");

  const { data: people } = useQuery({
    queryKey: ["flag-employees"],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("user_id, full_name, employee_id")
        .eq("is_active", true)
        .order("full_name");
      return data || [];
    },
  });

  const { data: flags } = useQuery({
    queryKey: ["attendance-flags"],
    queryFn: async () => {
      const { data } = await supabase
        .from("attendance_flags")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      return data || [];
    },
  });

  const nameOf = (userId: string) => (people || []).find((p) => p.user_id === userId)?.full_name || "Unknown";

  const create = useMutation({
    mutationFn: async () => {
      if (!employee) throw new Error("Pick the employee");
      if (!start || !end) throw new Error("Pick the period");
      if (end < start) throw new Error("End date must be on or after the start date");
      if (!reason.trim()) throw new Error("Add a reason so the employee knows what to fix");
      const { error } = await supabase.from("attendance_flags").insert({
        user_id: employee,
        start_date: start,
        end_date: end,
        reason: reason.trim(),
        created_by: user!.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Period flagged — the employee has been notified");
      setOpen(false);
      setEmployee("");
      setStart("");
      setEnd("");
      setReason("");
      queryClient.invalidateQueries({ queryKey: ["attendance-flags"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const closeFlag = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("attendance_flags")
        .update({ status: "resolved", resolved_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Flag closed");
      queryClient.invalidateQueries({ queryKey: ["attendance-flags"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5" /> Flagged attendance periods
        </CardTitle>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="h-4 w-4 mr-2" /> Flag a period</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Flag incorrect attendance</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Employee</Label>
                <Select value={employee} onValueChange={setEmployee}>
                  <SelectTrigger><SelectValue placeholder="Choose an employee" /></SelectTrigger>
                  <SelectContent>
                    {(people || []).map((p) => (
                      <SelectItem key={p.user_id} value={p.user_id}>{p.full_name} · {p.employee_id}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>From</Label>
                  <Input type="date" value={start} onChange={(e) => setStart(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>To</Label>
                  <Input type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>What is wrong?</Label>
                <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. missing check-outs for the whole week" />
              </div>
              <Button className="w-full" disabled={create.isPending} onClick={() => create.mutate()}>
                Flag and notify employee
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Employee</TableHead>
              <TableHead>Period</TableHead>
              <TableHead>Reason</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(flags || []).map((f) => (
              <TableRow key={f.id}>
                <TableCell className="font-medium">{nameOf(f.user_id)}</TableCell>
                <TableCell className="whitespace-nowrap">
                  {format(new Date(f.start_date), "MMM d")} – {format(new Date(f.end_date), "MMM d, yyyy")}
                </TableCell>
                <TableCell className="max-w-[240px] truncate">{f.reason}</TableCell>
                <TableCell>
                  <Badge variant={f.status === "resolved" ? "success" : "warning"}>{f.status}</Badge>
                </TableCell>
                <TableCell className="text-right">
                  {f.status === "open" ? (
                    <Button size="sm" variant="outline" disabled={closeFlag.isPending} onClick={() => closeFlag.mutate(f.id)}>
                      Mark resolved
                    </Button>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {(flags || []).length === 0 && (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Nothing flagged</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
