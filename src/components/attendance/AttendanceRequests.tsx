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
import { AlertTriangle, ClipboardCheck, Plus, X } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";

type RequestType = Database["public"]["Enums"]["attendance_request_type"];

const toStamp = (date: string, time: string) => (date && time ? new Date(`${date}T${time}`).toISOString() : null);

export default function AttendanceRequests() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<RequestType>("regularization");
  const [date, setDate] = useState("");
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [reason, setReason] = useState("");
  const [flagId, setFlagId] = useState<string | null>(null);

  const { data: flags } = useQuery({
    queryKey: ["my-attendance-flags"],
    queryFn: async () => {
      const { data } = await supabase
        .from("attendance_flags")
        .select("*")
        .eq("user_id", user!.id)
        .eq("status", "open")
        .order("start_date", { ascending: false });
      return data || [];
    },
  });

  const { data: requests } = useQuery({
    queryKey: ["my-attendance-requests"],
    queryFn: async () => {
      const { data } = await supabase
        .from("attendance_requests")
        .select("*")
        .eq("user_id", user!.id)
        .order("date", { ascending: false })
        .limit(30);
      return data || [];
    },
  });

  const submit = useMutation({
    mutationFn: async () => {
      if (!date) throw new Error("Please pick the date");
      if (!reason.trim()) throw new Error("Please add a reason");
      if (!checkIn && !checkOut) throw new Error("Add at least a check-in or check-out time");
      const { error } = await supabase.from("attendance_requests").insert({
        user_id: user!.id,
        date,
        request_type: type,
        requested_check_in: toStamp(date, checkIn),
        requested_check_out: toStamp(date, checkOut),
        reason: reason.trim(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Request sent to your reporting manager");
      setOpen(false);
      setDate("");
      setCheckIn("");
      setCheckOut("");
      setReason("");
      setType("regularization");
      queryClient.invalidateQueries({ queryKey: ["my-attendance-requests"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const withdraw = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("attendance_requests")
        .update({ status: "cancelled" })
        .eq("id", id)
        .eq("user_id", user!.id)
        .eq("status", "pending");
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Request withdrawn");
      queryClient.invalidateQueries({ queryKey: ["my-attendance-requests"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const statusVariant = (s: string) =>
    s === "approved" ? ("default" as const) : s === "rejected" ? ("destructive" as const) : s === "cancelled" ? ("outline" as const) : ("secondary" as const);

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2">
          <ClipboardCheck className="h-5 w-5" /> Corrections & early leave
        </CardTitle>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="h-4 w-4 mr-2" /> Raise request</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Attendance request</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>What do you need?</Label>
                <Select value={type} onValueChange={(v) => setType(v as RequestType)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="regularization">Fix a missed or wrong check-in/check-out</SelectItem>
                    <SelectItem value="early_leave">Leaving early on this day</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Date</Label>
                <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Check-in time</Label>
                  <Input type="time" value={checkIn} onChange={(e) => setCheckIn(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>{type === "early_leave" ? "Leaving at" : "Check-out time"}</Label>
                  <Input type="time" value={checkOut} onChange={(e) => setCheckOut(e.target.value)} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Reason</Label>
                <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. forgot to check out, system was down" />
              </div>
              <Button className="w-full" disabled={submit.isPending} onClick={() => submit.mutate()}>
                Send for approval
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Request</TableHead>
              <TableHead>Check In</TableHead>
              <TableHead>Check Out</TableHead>
              <TableHead>Reason</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Note</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(requests || []).map((r) => (
              <TableRow key={r.id}>
                <TableCell>{format(new Date(r.date), "MMM d, yyyy")}</TableCell>
                <TableCell>{r.request_type === "early_leave" ? "Early leave" : "Correction"}</TableCell>
                <TableCell>{r.requested_check_in ? format(new Date(r.requested_check_in), "hh:mm a") : "—"}</TableCell>
                <TableCell>{r.requested_check_out ? format(new Date(r.requested_check_out), "hh:mm a") : "—"}</TableCell>
                <TableCell className="max-w-[200px] truncate">{r.reason}</TableCell>
                <TableCell><Badge variant={statusVariant(r.status)}>{r.status}</Badge></TableCell>
                <TableCell className="max-w-[160px] truncate text-xs text-muted-foreground">{r.review_comment || "—"}</TableCell>
                <TableCell className="text-right">
                  {r.status === "pending" ? (
                    <Button size="sm" variant="outline" disabled={withdraw.isPending} onClick={() => withdraw.mutate(r.id)}>
                      <X className="h-3.5 w-3.5 mr-1" /> Withdraw
                    </Button>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {(requests || []).length === 0 && (
              <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">No requests yet</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
