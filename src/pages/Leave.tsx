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
import { CalendarDays, Plus, X } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import type { Database } from "@/integrations/supabase/types";

type LeaveType = Database["public"]["Enums"]["leave_type"];
type DayPortion = Database["public"]["Enums"]["day_portion"];

const portionLabel: Record<DayPortion, string> = {
  full_day: "Full day",
  first_half: "First half",
  second_half: "Second half",
};

const requestDays = (start: string, end: string, portion: DayPortion) =>
  portion === "full_day"
    ? Math.round((new Date(end).getTime() - new Date(start).getTime()) / 86400000) + 1
    : 0.5;

export default function Leave() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [leaveType, setLeaveType] = useState<LeaveType>("casual");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [dayPortion, setDayPortion] = useState<DayPortion>("full_day");

  const { data: policies } = useQuery({
    queryKey: ["leave-policies-enabled"],
    queryFn: async () => {
      const { data } = await supabase.from("leave_policies").select("*").eq("is_enabled", true).order("label");
      return data || [];
    },
  });

  const { data: balances } = useQuery({
    queryKey: ["leave-balances"],
    queryFn: async () => {
      const { data } = await supabase.from("leave_balances").select("*");
      return data || [];
    },
  });

  const { data: requests } = useQuery({
    queryKey: ["leave-requests"],
    queryFn: async () => {
      const { data } = await supabase.from("leave_requests").select("*").order("created_at", { ascending: false });
      return data || [];
    },
  });

  const apply = useMutation({
    mutationFn: async () => {
      const half = dayPortion !== "full_day";
      const finalEnd = half ? startDate : endDate;
      if (!startDate || !finalEnd) throw new Error("Please select dates");
      if (new Date(startDate) > new Date(finalEnd)) throw new Error("End date must be after start date");
      if (new Date(startDate) < new Date(format(new Date(), "yyyy-MM-dd"))) throw new Error("Cannot apply for past dates");

      const { error } = await supabase.from("leave_requests").insert({
        user_id: user!.id,
        leave_type: leaveType,
        start_date: startDate,
        end_date: finalEnd,
        day_portion: dayPortion,
        reason: reason || null,
        is_public: isPublic,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Leave request submitted!");
      setOpen(false);
      setStartDate("");
      setEndDate("");
      setReason("");
      setIsPublic(true);
      setDayPortion("full_day");
      queryClient.invalidateQueries({ queryKey: ["leave-requests"] });
      queryClient.invalidateQueries({ queryKey: ["leave-balances"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const cancel = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("leave_requests")
        .update({ status: "cancelled" })
        .eq("id", id)
        .eq("user_id", user!.id)
        .in("status", ["pending", "approved"]);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Leave request cancelled");
      queryClient.invalidateQueries({ queryKey: ["leave-requests"] });
      queryClient.invalidateQueries({ queryKey: ["leave-balances"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const statusVariant = (s: string) => {
    if (s === "approved") return "default" as const;
    if (s === "rejected") return "destructive" as const;
    if (s === "cancelled") return "outline" as const;
    return "secondary" as const;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Leave Management</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" /> Apply Leave</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Apply for Leave</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Leave Type</Label>
                <Select value={leaveType} onValueChange={(v) => setLeaveType(v as LeaveType)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {policies?.map((p) => (
                      <SelectItem key={p.id} value={p.leave_type}>{p.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Duration</Label>
                <Select value={dayPortion} onValueChange={(v) => setDayPortion(v as DayPortion)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="full_day">Full day(s)</SelectItem>
                    <SelectItem value="first_half">Half day — first half (morning off)</SelectItem>
                    <SelectItem value="second_half">Half day — second half (early leave)</SelectItem>
                  </SelectContent>
                </Select>
                {dayPortion !== "full_day" && (
                  <p className="text-xs text-muted-foreground">Half day counts as 0.5 day and applies to a single date.</p>
                )}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{dayPortion === "full_day" ? "Start Date" : "Date"}</Label>
                  <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                </div>
                {dayPortion === "full_day" && (
                  <div className="space-y-2">
                    <Label>End Date</Label>
                    <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <Label>Reason</Label>
                <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Optional reason..." />
              </div>
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div className="pr-4">
                  <Label className="text-sm">Show on "On Leave Today"</Label>
                  <p className="text-xs text-muted-foreground">Let colleagues see you're away on these dates</p>
                </div>
                <Switch checked={isPublic} onCheckedChange={setIsPublic} />
              </div>
              <Button onClick={() => apply.mutate()} disabled={apply.isPending} className="w-full">
                Submit Request
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {balances?.map((b) => (
          <Card key={b.id}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground capitalize flex items-center gap-2">
                <CalendarDays className="h-4 w-4" /> {b.leave_type} Leave
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{b.remaining_days}<span className="text-sm font-normal text-muted-foreground">/{b.total_days}</span></div>
              <p className="text-xs text-muted-foreground">{b.used_days} days used</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader><CardTitle>My Requests</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>From</TableHead>
                <TableHead>To</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Manager</TableHead>
                <TableHead>HR</TableHead>
                <TableHead>Overall</TableHead>
                <TableHead>Note</TableHead>
                <TableHead>Applied</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {requests?.map((req) => (
                <TableRow key={req.id}>
                  <TableCell className="capitalize">{req.leave_type}</TableCell>
                  <TableCell>{format(new Date(req.start_date), "MMM d, yyyy")}</TableCell>
                  <TableCell>{format(new Date(req.end_date), "MMM d, yyyy")}</TableCell>
                  <TableCell className="max-w-[200px] truncate">{req.reason || "—"}</TableCell>
                  <TableCell><Badge variant={statusVariant(req.manager_status)}>{req.manager_status}</Badge></TableCell>
                  <TableCell><Badge variant={statusVariant(req.hr_status)}>{req.hr_status}</Badge></TableCell>
                  <TableCell><Badge variant={statusVariant(req.status)}>{req.status}</Badge></TableCell>
                  <TableCell className="max-w-[180px] truncate text-xs text-muted-foreground">{req.hr_comment || req.manager_comment || "—"}</TableCell>
                  <TableCell>{format(new Date(req.created_at), "MMM d")}</TableCell>
                  <TableCell className="text-right">
                    {(req.status === "pending" || req.status === "approved") &&
                    req.user_id === user?.id &&
                    req.start_date >= format(new Date(), "yyyy-MM-dd") ? (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={cancel.isPending}
                        onClick={() => cancel.mutate(req.id)}
                      >
                        <X className="h-3.5 w-3.5 mr-1" /> Cancel
                      </Button>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {requests?.length === 0 && (
                <TableRow><TableCell colSpan={10} className="text-center text-muted-foreground py-8">No leave requests</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
