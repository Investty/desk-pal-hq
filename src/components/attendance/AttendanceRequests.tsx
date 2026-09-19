import { useEffect, useState } from "react";
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
import { toast } from "@/components/ui/sonner";
import { format } from "date-fns";
import { AlertTriangle, ClipboardCheck, Plus, X } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";

type RequestType = Database["public"]["Enums"]["attendance_request_type"];

const toStamp = (date: string, time: string) => (date && time ? new Date(`${date}T${time}`).toISOString() : null);
const MIN_REASON = 10;

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

  const { data: rules } = useQuery({
    queryKey: ["attendance-rules"],
    queryFn: async () => {
      const { data } = await supabase.from("attendance_rules").select("*").maybeSingle();
      return data;
    },
  });

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

  const monthStart = date ? `${date.slice(0, 7)}-01` : null;
  const { data: usage } = useQuery({
    enabled: !!monthStart,
    queryKey: ["attendance-request-usage", monthStart],
    queryFn: async () => {
      const end = new Date(new Date(monthStart!).getFullYear(), new Date(monthStart!).getMonth() + 1, 0);
      const { data } = await supabase
        .from("attendance_requests")
        .select("request_type, status")
        .eq("user_id", user!.id)
        .gte("date", monthStart!)
        .lte("date", format(end, "yyyy-MM-dd"));
      const rows = (data || []).filter((r) => r.status === "pending" || r.status === "approved");
      return {
        regularization: rows.filter((r) => r.request_type === "regularization").length,
        early_leave: rows.filter((r) => r.request_type === "early_leave").length,
      };
    },
  });

  const { data: shift } = useQuery({
    enabled: !!date,
    queryKey: ["shift-for", date],
    queryFn: async () => {
      const { data } = await supabase.rpc("shift_for", { _user: user!.id, _date: date });
      const row = Array.isArray(data) ? data[0] : data;
      return row as { name: string; start_time: string; end_time: string } | null;
    },
  });

  const earlyEnabled = rules?.early_leave_enabled ?? true;
  const regEnabled = rules?.regularization_enabled ?? true;
  const cap = type === "early_leave" ? rules?.early_leave_max_per_month ?? null : rules?.regularization_max_per_month ?? null;
  const used = usage ? usage[type] : 0;

  useEffect(() => {
    if (!earlyEnabled && type === "early_leave") setType("regularization");
    if (!regEnabled && type === "regularization" && earlyEnabled) setType("early_leave");
  }, [earlyEnabled, regEnabled, type]);

  const submit = useMutation({
    mutationFn: async () => {
      if (!date) throw new Error("Please pick the date");
      if (reason.trim().length < MIN_REASON) throw new Error(`Please write a reason of at least ${MIN_REASON} characters`);
      if (!checkIn && !checkOut) throw new Error("Add at least a check-in or check-out time");
      if (type === "early_leave" && shift?.end_time && checkOut && rules?.early_leave_max_hours) {
        const end = new Date(`${date}T${shift.end_time.slice(0, 5)}`);
        const out = new Date(`${date}T${checkOut}`);
        const hoursEarly = (end.getTime() - out.getTime()) / 3_600_000;
        if (hoursEarly > Number(rules.early_leave_max_hours)) {
          throw new Error(`You can leave at most ${rules.early_leave_max_hours} hours early (shift ends at ${shift.end_time.slice(0, 5)})`);
        }
      }
      const { error } = await supabase.from("attendance_requests").insert({
        user_id: user!.id,
        date,
        request_type: type,
        requested_check_in: toStamp(date, checkIn),
        requested_check_out: toStamp(date, checkOut),
        reason: reason.trim(),
        flag_id: flagId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Request sent for approval");
      setOpen(false);
      setDate("");
      setCheckIn("");
      setCheckOut("");
      setReason("");
      setType(regEnabled ? "regularization" : "early_leave");
      setFlagId(null);
      queryClient.invalidateQueries({ queryKey: ["my-attendance-requests"] });
      queryClient.invalidateQueries({ queryKey: ["my-attendance-flags"] });
      queryClient.invalidateQueries({ queryKey: ["attendance-request-usage"] });
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
      queryClient.invalidateQueries({ queryKey: ["attendance-request-usage"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const statusVariant = (s: string) =>
    s === "approved" ? ("success" as const) : s === "rejected" ? ("danger" as const) : s === "cancelled" ? ("outline" as const) : ("warning" as const);

  const bothOff = !earlyEnabled && !regEnabled;
  const reasonTooShort = reason.trim().length > 0 && reason.trim().length < MIN_REASON;

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2">
          <ClipboardCheck className="h-5 w-5" /> Corrections & early leave
        </CardTitle>
        {!bothOff && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" onClick={() => setFlagId(null)}><Plus className="h-4 w-4 mr-2" /> Raise request</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Attendance request</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>What do you need?</Label>
                  <Select value={type} onValueChange={(v) => setType(v as RequestType)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {regEnabled && <SelectItem value="regularization">Fix a missed or wrong check-in/check-out</SelectItem>}
                      {earlyEnabled && <SelectItem value="early_leave">Leaving early on this day</SelectItem>}
                    </SelectContent>
                  </Select>
                  {cap !== null && (
                    <p className="text-xs text-muted-foreground">
                      {date
                        ? `Used ${used} of ${cap} allowed for ${format(new Date(date), "MMMM yyyy")}.`
                        : `Your company allows ${cap} of these per month.`}
                      {type === "regularization" && rules?.regularization_backdate_days
                        ? ` Dates up to ${rules.regularization_backdate_days} days old can be corrected.`
                        : ""}
                      {type === "early_leave" && rules?.early_leave_max_hours
                        ? ` Up to ${rules.early_leave_max_hours} hours early per request.`
                        : ""}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Date</Label>
                  <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                  {shift && (
                    <p className="text-xs text-muted-foreground">
                      Your shift that day: {shift.name} ({shift.start_time.slice(0, 5)} – {shift.end_time.slice(0, 5)})
                    </p>
                  )}
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
                  <Label>Reason <span className="text-destructive">*</span></Label>
                  <Textarea
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    maxLength={500}
                    placeholder="e.g. forgot to check out after the client call"
                  />
                  <p className={`text-xs ${reasonTooShort ? "text-destructive" : "text-muted-foreground"}`}>
                    Required — at least {MIN_REASON} characters ({reason.trim().length}/{MIN_REASON}).
                  </p>
                </div>
                <Button
                  className="w-full"
                  disabled={submit.isPending || !date || reason.trim().length < MIN_REASON}
                  onClick={() => submit.mutate()}
                >
                  Send for approval
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {bothOff && (
          <p className="text-sm text-muted-foreground">
            Your company has turned off corrections and early leave. Please speak to HR for any attendance fix.
          </p>
        )}
        {(flags || []).map((f) => (
          <div key={f.id} className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 flex items-start justify-between gap-4">
            <div className="flex gap-3">
              <AlertTriangle className="h-5 w-5 text-destructive shrink-0" />
              <div>
                <p className="font-medium">
                  HR flagged your attendance: {format(new Date(f.start_date), "MMM d")} – {format(new Date(f.end_date), "MMM d, yyyy")}
                </p>
                <p className="text-sm text-muted-foreground">{f.reason}</p>
              </div>
            </div>
            {regEnabled && (
              <Button
                size="sm"
                onClick={() => {
                  setFlagId(f.id);
                  setType("regularization");
                  setDate(f.start_date);
                  setCheckIn("");
                  setCheckOut("");
                  setReason("");
                  setOpen(true);
                }}
              >
                Apply correction
              </Button>
            )}
          </div>
        ))}
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
