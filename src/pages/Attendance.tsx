import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ListPager } from "@/components/ui/list-pager";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/sonner";
import { format } from "date-fns";
import { Clock, LogIn, LogOut } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import AttendanceRequests from "@/components/attendance/AttendanceRequests";
import AttendanceCalendar from "@/components/attendance/AttendanceCalendar";

export default function Attendance() {
  const { user, hasFeature } = useAuth();
  const queryClient = useQueryClient();
  const today = format(new Date(), "yyyy-MM-dd");

  const { data: myShift } = useQuery({
    queryKey: ["shift-for-today", user?.id, today],
    enabled: !!user?.id,
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await supabase.rpc("shift_for", { _user: user.id, _date: today });
      const row = (Array.isArray(data) ? data[0] : data) as
        | { name: string | null; start_time: string | null; end_time: string | null; grace_minutes: number | null }
        | null;
      // The RPC returns an all-null row when the company has no shift configured.
      if (!row || !row.name || !row.start_time || !row.end_time) return null;
      return row as { name: string; start_time: string; end_time: string; grace_minutes: number };
    },
  });

  const { data: todayRecord } = useQuery({
    queryKey: ["attendance-today", user?.id, today],
    enabled: !!user?.id,
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await supabase
        .from("attendance")
        .select("*")
        .eq("user_id", user.id)
        .eq("date", today)
        .maybeSingle();
      return data;
    },
  });

  const { data: todayLeave } = useQuery({
    queryKey: ["attendance-today-leave", user?.id, today],
    enabled: !!user?.id,
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await supabase
        .from("leave_requests")
        .select("day_portion, leave_type, leave_policies(label)")
        .eq("user_id", user.id)
        .eq("status", "approved")
        .lte("start_date", today)
        .gte("end_date", today)
        .maybeSingle();
      return data;
    },
  });

  const onFullDayLeave = !!todayLeave && todayLeave.day_portion === "full_day";
  const leaveLabel =
    (todayLeave as { leave_policies?: { label: string } | null } | null)?.leave_policies?.label ||
    todayLeave?.leave_type?.replace(/_/g, " ") ||
    "Leave";

  const PAGE_SIZE = 25;
  const [page, setPage] = useState(0);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const { data: history } = useQuery({
    queryKey: ["attendance-history", user?.id, page, from, to],
    enabled: !!user?.id,
    queryFn: async () => {
      if (!user?.id) return { rows: [], count: 0 };
      let q = supabase
        .from("attendance")
        .select("*", { count: "exact" })
        .eq("user_id", user.id)
        .order("date", { ascending: false });
      if (from) q = q.gte("date", from);
      if (to) q = q.lte("date", to);
      const { data, count } = await q.range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);
      return { rows: data || [], count: count || 0 };
    },
  });

  const checkIn = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("clock_in");
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Checked in successfully!");
      queryClient.invalidateQueries({ queryKey: ["attendance"] });
      queryClient.invalidateQueries({ queryKey: ["attendance-today"] });
      queryClient.invalidateQueries({ queryKey: ["attendance-calendar"] });
      queryClient.invalidateQueries({ queryKey: ["my-today-attendance"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const checkOut = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("clock_out");
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Checked out successfully!");
      queryClient.invalidateQueries({ queryKey: ["attendance"] });
      queryClient.invalidateQueries({ queryKey: ["attendance-today"] });
      queryClient.invalidateQueries({ queryKey: ["attendance-calendar"] });
      queryClient.invalidateQueries({ queryKey: ["my-today-attendance"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const statusColor = (s: string) => {
    if (s === "present") return "success" as const;
    if (s === "late") return "warning" as const;
    if (s === "on_leave") return "info" as const;
    return "danger" as const;
  };

  return (
    <div className="space-y-6">
      <h1>Attendance</h1>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Clock className="h-5 w-5" /> Today — {format(new Date(), "MMMM d, yyyy")}</CardTitle>
          {myShift && (
            <p className="text-sm text-muted-foreground">
              Your shift: {myShift.name} ({myShift.start_time.slice(0, 5)} – {myShift.end_time.slice(0, 5)}) · marked late after {myShift.grace_minutes} min grace
            </p>
          )}
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 flex-wrap">
            {!todayRecord?.check_in ? (
              <Button onClick={() => checkIn.mutate()} disabled={checkIn.isPending}>
                <LogIn className="h-4 w-4 mr-2" /> Check In
              </Button>
            ) : !todayRecord.check_out ? (
              <div className="flex items-center gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Checked in at</p>
                  <p className="font-semibold">{format(new Date(todayRecord.check_in!), "hh:mm a")}</p>
                </div>
                <Button onClick={() => checkOut.mutate()} disabled={checkOut.isPending} variant="outline">
                  <LogOut className="h-4 w-4 mr-2" /> Check Out
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-6">
                <div>
                  <p className="text-sm text-muted-foreground">Check In</p>
                  <p className="font-semibold">{format(new Date(todayRecord.check_in!), "hh:mm a")}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Check Out</p>
                  <p className="font-semibold">{format(new Date(todayRecord.check_out!), "hh:mm a")}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Working Hours</p>
                  <p className="font-semibold">{todayRecord.working_hours}h</p>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <AttendanceCalendar />

      {hasFeature("attendance_regularization") && <AttendanceRequests />}

      <Card>
        <CardHeader><CardTitle>History</CardTitle></CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-3 mb-4">
            <div className="space-y-1">
              <Label className="text-xs">From</Label>
              <Input type="date" value={from} onChange={(e) => { setPage(0); setFrom(e.target.value); }} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">To</Label>
              <Input type="date" value={to} onChange={(e) => { setPage(0); setTo(e.target.value); }} />
            </div>
            {(from || to) && (
              <Button variant="ghost" size="sm" onClick={() => { setFrom(""); setTo(""); setPage(0); }}>Clear</Button>
            )}
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Check In</TableHead>
                <TableHead>Check Out</TableHead>
                <TableHead>Hours</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {history?.rows.map((rec) => (
                <TableRow key={rec.id}>
                  <TableCell>{format(new Date(rec.date), "MMM d, yyyy")}</TableCell>
                  <TableCell>{rec.check_in ? format(new Date(rec.check_in), "hh:mm a") : "—"}</TableCell>
                  <TableCell>{rec.check_out ? format(new Date(rec.check_out), "hh:mm a") : "—"}</TableCell>
                  <TableCell>{rec.working_hours || "—"}</TableCell>
                  <TableCell><Badge variant={statusColor(rec.status)}>{rec.status}</Badge></TableCell>
                </TableRow>
              ))}
              {history?.rows.length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No attendance records yet</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
          <ListPager page={page} pageSize={PAGE_SIZE} total={history?.count ?? 0} onPage={setPage} />
        </CardContent>
      </Card>
    </div>
  );
}
