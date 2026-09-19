import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/components/ui/sonner";
import { format } from "date-fns";
import { Gift, Plus, Trash2 } from "lucide-react";

type Person = { user_id: string; full_name: string; employee_id: string };

export default function CompOffGrants({ people }: { people: Person[] }) {
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [employee, setEmployee] = useState("");
  const [days, setDays] = useState("1");
  const [workedOn, setWorkedOn] = useState("");
  const [reason, setReason] = useState("");

  const { data: grants } = useQuery({
    queryKey: ["comp-off-grants"],
    queryFn: async () => {
      const { data } = await supabase
        .from("comp_off_grants")
        .select("*")
        .order("worked_on", { ascending: false })
        .limit(100);
      return data || [];
    },
  });

  const nameOf = (userId: string) => people.find((p) => p.user_id === userId)?.full_name || "Employee";

  const reset = () => {
    setEmployee("");
    setDays("1");
    setWorkedOn("");
    setReason("");
  };

  const grant = useMutation({
    mutationFn: async () => {
      const value = Number(days);
      if (!employee) throw new Error("Pick the employee");
      if (!workedOn) throw new Error("Pick the date they worked");
      if (!Number.isFinite(value) || value <= 0) throw new Error("Enter how many days to credit");
      if (!reason.trim()) throw new Error("Add a short note about the overtime");
      const { error } = await supabase.from("comp_off_grants").insert({
        user_id: employee,
        days: value,
        worked_on: workedOn,
        reason: reason.trim(),
        granted_by: user!.id,
        company_id: profile!.company_id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Comp-off credited to the employee");
      setOpen(false);
      reset();
      queryClient.invalidateQueries({ queryKey: ["comp-off-grants"] });
      queryClient.invalidateQueries({ queryKey: ["leave-balances"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("comp_off_grants").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Comp-off credit removed");
      queryClient.invalidateQueries({ queryKey: ["comp-off-grants"] });
      queryClient.invalidateQueries({ queryKey: ["leave-balances"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2">
          <Gift className="h-5 w-5" /> Comp-off credits for overtime
        </CardTitle>
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="h-4 w-4 mr-2" /> Add comp-off</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Credit comp-off days</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Employee</Label>
                <Select value={employee} onValueChange={setEmployee}>
                  <SelectTrigger><SelectValue placeholder="Choose an employee" /></SelectTrigger>
                  <SelectContent>
                    {people.map((p) => (
                      <SelectItem key={p.user_id} value={p.user_id}>{p.full_name} · {p.employee_id}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Days</Label>
                  <Input type="number" min="0.5" step="0.5" value={days} onChange={(e) => setDays(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Worked on</Label>
                  <Input type="date" value={workedOn} onChange={(e) => setWorkedOn(e.target.value)} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Why</Label>
                <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. worked the full Saturday for the release" />
              </div>
              <Button className="w-full" disabled={grant.isPending} onClick={() => grant.mutate()}>
                Credit comp-off
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
              <TableHead>Worked on</TableHead>
              <TableHead>Days</TableHead>
              <TableHead>Reason</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(grants || []).map((g) => (
              <TableRow key={g.id}>
                <TableCell className="font-medium">{nameOf(g.user_id)}</TableCell>
                <TableCell>{format(new Date(g.worked_on), "MMM d, yyyy")}</TableCell>
                <TableCell>{g.days}</TableCell>
                <TableCell className="max-w-[240px] truncate">{g.reason}</TableCell>
                <TableCell className="text-right">
                  <Button size="sm" variant="outline" disabled={remove.isPending} onClick={() => remove.mutate(g.id)}>
                    <Trash2 className="h-4 w-4 mr-1" /> Remove
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {(grants || []).length === 0 && (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No comp-off credited yet</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
