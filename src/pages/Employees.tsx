import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Search, Users, UserMinus, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface EmployeeRow {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  employee_id: string;
  is_active: boolean;
  status: string;
  removed_at: string | null;
  removal_reason: string | null;
  last_working_day: string | null;
  departments?: { name: string } | null;
}

export default function Employees() {
  const [search, setSearch] = useState("");
  const [removing, setRemoving] = useState<EmployeeRow | null>(null);
  const [reason, setReason] = useState("");
  const [lastDay, setLastDay] = useState(format(new Date(), "yyyy-MM-dd"));
  const { isHR, company } = useAuth();
  const queryClient = useQueryClient();

  const { data: employees, isLoading } = useQuery({
    queryKey: ["employees"],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("*, departments:department_id(name)")
        .order("full_name");
      return (data || []) as unknown as EmployeeRow[];
    },
  });

  const removeEmployee = useMutation({
    mutationFn: async (p: { userId: string; reason: string; lastDay: string }) => {
      const { error } = await supabase.rpc("remove_employee", {
        _user_id: p.userId, _reason: p.reason || null, _last_working_day: p.lastDay || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Employee removed from the company");
      setRemoving(null); setReason("");
      queryClient.invalidateQueries({ queryKey: ["employees"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const restoreEmployee = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase.rpc("restore_employee", { _user_id: userId, _role: "employee" });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Employee restored");
      queryClient.invalidateQueries({ queryKey: ["employees"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const match = (e: EmployeeRow) =>
    e.full_name.toLowerCase().includes(search.toLowerCase()) ||
    e.email.toLowerCase().includes(search.toLowerCase()) ||
    e.employee_id.toLowerCase().includes(search.toLowerCase());

  const active = (employees ?? []).filter((e) => e.status !== "removed" && match(e));
  const former = (employees ?? []).filter((e) => e.status === "removed" && match(e));

  const initialsOf = (name: string) => name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Employees</h1>
        <p className="text-muted-foreground">
          Manage your team members{company ? ` · ${active.length} of ${company.seat_limit} seats used` : ""}
        </p>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search employees..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <Tabs defaultValue="active">
        <TabsList>
          <TabsTrigger value="active">Current ({active.length})</TabsTrigger>
          <TabsTrigger value="former">Former ({former.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="mt-4">
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (<Card key={i} className="animate-pulse"><CardContent className="h-32" /></Card>))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {active.map((emp) => (
                <Card key={emp.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="pt-6">
                    <div className="flex items-start gap-4">
                      <Avatar className="h-12 w-12">
                        <AvatarFallback className="bg-primary/10 text-primary font-semibold">{initialsOf(emp.full_name)}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold truncate">{emp.full_name}</h3>
                        <p className="text-sm text-muted-foreground truncate">{emp.email}</p>
                        <div className="flex items-center gap-2 mt-2 flex-wrap">
                          <Badge variant="secondary" className="text-xs">{emp.employee_id}</Badge>
                          {emp.departments?.name && <Badge variant="outline" className="text-xs">{emp.departments.name}</Badge>}
                        </div>
                        {isHR && (
                          <Button size="sm" variant="outline" className="mt-3" onClick={() => { setRemoving(emp); setReason(""); }}>
                            <UserMinus className="h-4 w-4 mr-1" /> Remove
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
              {active.length === 0 && (
                <div className="col-span-full text-center py-12 text-muted-foreground">
                  <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No employees found</p>
                </div>
              )}
            </div>
          )}
        </TabsContent>

        <TabsContent value="former" className="mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {former.map((emp) => (
              <Card key={emp.id}>
                <CardContent className="pt-6">
                  <div className="flex items-start gap-4">
                    <Avatar className="h-12 w-12">
                      <AvatarFallback className="bg-muted text-muted-foreground font-semibold">{initialsOf(emp.full_name)}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold truncate">{emp.full_name}</h3>
                      <p className="text-sm text-muted-foreground truncate">{emp.email}</p>
                      <p className="text-xs text-muted-foreground mt-2">
                        Left on {emp.last_working_day ? format(new Date(emp.last_working_day), "dd MMM yyyy") : "—"}
                      </p>
                      {emp.removal_reason && <p className="text-xs text-muted-foreground">Reason: {emp.removal_reason}</p>}
                      {isHR && (
                        <Button size="sm" variant="outline" className="mt-3" onClick={() => restoreEmployee.mutate(emp.user_id)}>
                          <UserPlus className="h-4 w-4 mr-1" /> Add back
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
            {former.length === 0 && (
              <div className="col-span-full text-center py-12 text-muted-foreground">
                <p>No former employees</p>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={!!removing} onOpenChange={(o) => !o && setRemoving(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove {removing?.full_name}</DialogTitle>
            <DialogDescription>
              They lose access to this company right away. Their attendance, leave and payslip history is kept, and you can add them back later.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Last working day</Label>
              <Input type="date" value={lastDay} onChange={(e) => setLastDay(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Reason</Label>
              <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Resignation, end of contract, ..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRemoving(null)}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={removeEmployee.isPending}
              onClick={() => removing && removeEmployee.mutate({ userId: removing.user_id, reason, lastDay })}
            >
              Remove from company
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
