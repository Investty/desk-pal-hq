import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { format, differenceInMinutes } from "date-fns";
import { Clock, LogIn, LogOut } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default function Attendance() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const today = format(new Date(), "yyyy-MM-dd");

  const { data: todayRecord } = useQuery({
    queryKey: ["attendance-today", today],
    queryFn: async () => {
      const { data } = await supabase.from("attendance").select("*").eq("date", today).maybeSingle();
      return data;
    },
  });

  const { data: history } = useQuery({
    queryKey: ["attendance-history"],
    queryFn: async () => {
      const { data } = await supabase.from("attendance").select("*").order("date", { ascending: false }).limit(30);
      return data || [];
    },
  });

  const checkIn = useMutation({
    mutationFn: async () => {
      const now = new Date();
      const isLate = now.getHours() >= 10;
      const { error } = await supabase.from("attendance").insert({
        user_id: user!.id,
        date: today,
        check_in: now.toISOString(),
        status: isLate ? "late" : "present",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Checked in successfully!");
      queryClient.invalidateQueries({ queryKey: ["attendance"] });
      queryClient.invalidateQueries({ queryKey: ["attendance-today"] });
      queryClient.invalidateQueries({ queryKey: ["my-today-attendance"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const checkOut = useMutation({
    mutationFn: async () => {
      if (!todayRecord) throw new Error("No check-in found");
      const now = new Date();
      const checkInTime = new Date(todayRecord.check_in!);
      const mins = differenceInMinutes(now, checkInTime);
      const hours = Math.round((mins / 60) * 100) / 100;
      const { error } = await supabase.from("attendance").update({
        check_out: now.toISOString(),
        working_hours: hours,
      }).eq("id", todayRecord.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Checked out successfully!");
      queryClient.invalidateQueries({ queryKey: ["attendance"] });
      queryClient.invalidateQueries({ queryKey: ["attendance-today"] });
      queryClient.invalidateQueries({ queryKey: ["my-today-attendance"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const statusColor = (s: string) => {
    if (s === "present") return "default";
    if (s === "late") return "secondary";
    return "destructive";
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Attendance</h1>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Clock className="h-5 w-5" /> Today — {format(new Date(), "MMMM d, yyyy")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 flex-wrap">
            {!todayRecord ? (
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

      <Card>
        <CardHeader><CardTitle>History</CardTitle></CardHeader>
        <CardContent>
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
              {history?.map((rec) => (
                <TableRow key={rec.id}>
                  <TableCell>{format(new Date(rec.date), "MMM d, yyyy")}</TableCell>
                  <TableCell>{rec.check_in ? format(new Date(rec.check_in), "hh:mm a") : "—"}</TableCell>
                  <TableCell>{rec.check_out ? format(new Date(rec.check_out), "hh:mm a") : "—"}</TableCell>
                  <TableCell>{rec.working_hours || "—"}</TableCell>
                  <TableCell><Badge variant={statusColor(rec.status)}>{rec.status}</Badge></TableCell>
                </TableRow>
              ))}
              {history?.length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No attendance records yet</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
