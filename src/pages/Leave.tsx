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
import { CalendarDays, Plus } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import type { Database } from "@/integrations/supabase/types";

type LeaveType = Database["public"]["Enums"]["leave_type"];

export default function Leave() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [leaveType, setLeaveType] = useState<LeaveType>("casual");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");
  const [isPublic, setIsPublic] = useState(true);

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
      if (!startDate || !endDate) throw new Error("Please select dates");
      if (new Date(startDate) > new Date(endDate)) throw new Error("End date must be after start date");
      if (new Date(startDate) < new Date(format(new Date(), "yyyy-MM-dd"))) throw new Error("Cannot apply for past dates");

      const { error } = await supabase.from("leave_requests").insert({
        user_id: user!.id,
        leave_type: leaveType,
        start_date: startDate,
        end_date: endDate,
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
      queryClient.invalidateQueries({ queryKey: ["leave-requests"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const statusVariant = (s: string) => {
    if (s === "approved") return "default" as const;
    if (s === "rejected") return "destructive" as const;
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
                    <SelectItem value="sick">Sick Leave</SelectItem>
                    <SelectItem value="casual">Casual Leave</SelectItem>
                    <SelectItem value="paid">Paid Leave</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Start Date</Label>
                  <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>End Date</Label>
                  <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Reason</Label>
                <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Optional reason..." />
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
                <TableHead>Status</TableHead>
                <TableHead>Applied</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {requests?.map((req) => (
                <TableRow key={req.id}>
                  <TableCell className="capitalize">{req.leave_type}</TableCell>
                  <TableCell>{format(new Date(req.start_date), "MMM d, yyyy")}</TableCell>
                  <TableCell>{format(new Date(req.end_date), "MMM d, yyyy")}</TableCell>
                  <TableCell className="max-w-[200px] truncate">{req.reason || "—"}</TableCell>
                  <TableCell><Badge variant={statusVariant(req.status)}>{req.status}</Badge></TableCell>
                  <TableCell>{format(new Date(req.created_at), "MMM d")}</TableCell>
                </TableRow>
              ))}
              {requests?.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No leave requests</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
