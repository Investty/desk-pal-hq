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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ListPager } from "@/components/ui/list-pager";
import { Search, Users, UserMinus, UserPlus, Download, CalendarDays, Building2 } from "lucide-react";
import EmployeeLeaveDialog from "@/components/employees/EmployeeLeaveDialog";
import { downloadCsv } from "@/lib/csv";
import { toast } from "@/components/ui/sonner";
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
  department_id: string | null;
  departments?: { name: string } | null;
}

const PAGE_SIZE = 12;

export default function Employees() {
  const [tab, setTab] = useState<"active" | "former">("active");
  const [search, setSearch] = useState("");
  const [department, setDepartment] = useState("all");
  const [page, setPage] = useState(0);
  const [removing, setRemoving] = useState<EmployeeRow | null>(null);
  const [leaveFor, setLeaveFor] = useState<{ user_id: string; full_name: string } | null>(null);
  const [editingDept, setEditingDept] = useState<EmployeeRow | null>(null);
  const [deptChoice, setDeptChoice] = useState("none");
  const [reason, setReason] = useState("");
  const [lastDay, setLastDay] = useState(format(new Date(), "yyyy-MM-dd"));
  const { isHR, company } = useAuth();
  const queryClient = useQueryClient();

  const { data: departments } = useQuery({
    queryKey: ["departments-list"],
    queryFn: async () => {
      const { data } = await supabase.from("departments").select("id, name").order("name");
      return data || [];
    },
  });

  const { data, isLoading } = useQuery({
    queryKey: ["employees", tab, search, department, page],
    queryFn: async () => {
      let q = supabase
        .from("profiles")
        .select("*, departments:department_id(name)", { count: "exact" })
        .order("full_name");
      q = tab === "former" ? q.eq("status", "removed") : q.neq("status", "removed");
      if (department !== "all") q = q.eq("department_id", department);
      const term = search.trim();
      if (term) q = q.or(`full_name.ilike.%${term}%,email.ilike.%${term}%,employee_id.ilike.%${term}%`);
      const { data: rows, count } = await q.range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);
      return { rows: (rows || []) as unknown as EmployeeRow[], count: count || 0 };
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

  const updateDepartment = useMutation({
    mutationFn: async (p: { profileId: string; departmentId: string | null }) => {
      const { error } = await supabase
        .from("profiles")
        .update({ department_id: p.departmentId })
        .eq("id", p.profileId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Department updated");
      setEditingDept(null);
      queryClient.invalidateQueries({ queryKey: ["employees"] });
      queryClient.invalidateQueries({ queryKey: ["department-member-counts"] });
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

  const rows = data?.rows ?? [];
  const total = data?.count ?? 0;

  const initialsOf = (name: string) => name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();

  const switchTab = (v: string) => { setTab(v as "active" | "former"); setPage(0); };

  const exportList = async () => {
    let q = supabase
      .from("profiles")
      .select("employee_id, full_name, email, joining_date, designation, status, last_working_day, departments:department_id(name)")
      .order("full_name");
    q = tab === "former" ? q.eq("status", "removed") : q.neq("status", "removed");
    if (department !== "all") q = q.eq("department_id", department);
    const term = search.trim();
    if (term) q = q.or(`full_name.ilike.%${term}%,email.ilike.%${term}%,employee_id.ilike.%${term}%`);
    const { data: all, error } = await q.limit(2000);
    if (error || !all?.length) return toast.error(error ? error.message : "Nothing to export");
    downloadCsv(
      `employees-${tab}-${format(new Date(), "yyyy-MM-dd")}.csv`,
      ["Employee ID", "Name", "Email", "Department", "Designation", "Joining date", "Status", "Last working day"],
      all.map((e) => {
        const row = e as unknown as { employee_id: string; full_name: string; email: string; designation: string | null; joining_date: string; status: string; last_working_day: string | null; departments?: { name: string } | null };
        return [row.employee_id, row.full_name, row.email, row.departments?.name ?? "", row.designation ?? "", row.joining_date, row.status, row.last_working_day ?? ""];
      }),
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Employees</h1>
        <p className="text-muted-foreground">
          Manage your team members{company ? ` · ${company.seat_limit} seats in your plan` : ""}
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search name, email or ID..."
            className="pl-9"
            value={search}
            onChange={(e) => { setPage(0); setSearch(e.target.value); }}
          />
        </div>
        <Select value={department} onValueChange={(v) => { setPage(0); setDepartment(v); }}>
          <SelectTrigger className="w-52"><SelectValue placeholder="All departments" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All departments</SelectItem>
            {(departments || []).map((d) => (
              <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {(search || department !== "all") && (
          <Button variant="ghost" size="sm" onClick={() => { setSearch(""); setDepartment("all"); setPage(0); }}>Clear</Button>
        )}
        <Button variant="outline" size="sm" onClick={exportList}><Download className="h-4 w-4 mr-2" /> Export CSV</Button>
      </div>

      <Tabs value={tab} onValueChange={switchTab}>
        <TabsList>
          <TabsTrigger value="active">Current</TabsTrigger>
          <TabsTrigger value="former">Former</TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="mt-4">
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (<Card key={i} className="animate-pulse"><CardContent className="h-32" /></Card>))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {rows.map((emp) => (
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
                          <Badge className="text-xs">{emp.employee_id}</Badge>
                          {emp.departments?.name && <Badge variant="department" className="text-xs">{emp.departments.name}</Badge>}
                        </div>
                        {isHR && (
                          <div className="flex flex-wrap gap-2 mt-3">
                            <Button size="sm" variant="outline" onClick={() => setLeaveFor({ user_id: emp.user_id, full_name: emp.full_name })}>
                              <CalendarDays className="h-4 w-4 mr-1" /> Leave
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => { setRemoving(emp); setReason(""); }}>
                              <UserMinus className="h-4 w-4 mr-1" /> Remove
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
              {rows.length === 0 && (
                <div className="col-span-full text-center py-12 text-muted-foreground">
                  <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No employees found</p>
                </div>
              )}
            </div>
          )}
          <ListPager page={page} pageSize={PAGE_SIZE} total={total} onPage={setPage} />
        </TabsContent>

        <TabsContent value="former" className="mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {rows.map((emp) => (
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
            {rows.length === 0 && (
              <div className="col-span-full text-center py-12 text-muted-foreground">
                <p>No former employees</p>
              </div>
            )}
          </div>
          <ListPager page={page} pageSize={PAGE_SIZE} total={total} onPage={setPage} />
        </TabsContent>
      </Tabs>

      <EmployeeLeaveDialog employee={leaveFor} onOpenChange={(o) => !o && setLeaveFor(null)} />

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
