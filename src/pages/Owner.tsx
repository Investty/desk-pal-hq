import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { toast } from "@/components/ui/sonner";
import { Building2, Search, Users, ShieldAlert, LayoutGrid, LogOut, Eye, Trash2, Download } from "lucide-react";
import { Link } from "react-router-dom";
import { FEATURES } from "@/lib/features";
import RevenueTab from "@/components/owner/RevenueTab";
import PlansTab from "@/components/owner/PlansTab";
import BroadcastsTab from "@/components/owner/BroadcastsTab";
import { format, differenceInCalendarDays } from "date-fns";


const STATUSES = ["trial", "active", "past_due", "suspended"] as const;
const STATUS_LABEL: Record<string, string> = {
  trial: "Trial", active: "Active", past_due: "Past due", suspended: "Suspended",
};

interface OwnerCompany {
  id: string;
  name: string;
  plan: string;
  status: string;
  seat_limit: number;
  trial_ends_at: string | null;
  notes: string | null;
  created_at: string;
  active_people: number;
  removed_people: number;
  admins: number;
  features: Record<string, boolean>;
  storage_mb_limit: number;
  monthly_notification_limit: number;
  soft_warn_pct: number;
  storage_used_mb: number;
  notifications_this_month: number;
}

interface UsageRow {
  company_id: string; company_name: string; people: number; attendance_rows: number;
  leave_rows: number; payslip_rows: number; document_rows: number; storage_mb: number; rows_last_30d: number;
}

interface AuditRow {
  id: string; action: string; company_id: string | null; company_name: string | null;
  actor_email: string | null; details: Record<string, unknown>; created_at: string;
}

export default function Owner() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { signOut, memberships, refresh } = useAuth();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [planFilter, setPlanFilter] = useState("all");
  const [editing, setEditing] = useState<OwnerCompany | null>(null);
  const [deleting, setDeleting] = useState<OwnerCompany | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [support, setSupport] = useState<OwnerCompany | null>(null);
  const [supportMinutes, setSupportMinutes] = useState("30");
  const [supportReason, setSupportReason] = useState("");
  const [form, setForm] = useState({
    name: "", plan: "free", status: "active", seat_limit: 25, trial_ends_at: "", notes: "",
    storage_mb_limit: 1024, monthly_notification_limit: 5000, soft_warn_pct: 90,
    billing_interval: "monthly", custom_price: "" as string,
  });

  const { data: stats } = useQuery({
    queryKey: ["owner-stats"],
    queryFn: async () => {
      const { data } = await supabase.rpc("owner_stats");
      return (data ?? {}) as Record<string, number>;
    },
  });

  const { data: planOptions } = useQuery({
    queryKey: ["owner-plans"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("owner_list_plans");
      if (error) throw error;
      return (data ?? []) as unknown as { key: string; name: string; is_active: boolean }[];
    },
  });

  const { data: billing } = useQuery({
    queryKey: ["owner-company-billing"],
    queryFn: async () => {
      const { data, error } = await supabase.from("companies").select("id, billing_interval, custom_price");
      if (error) throw error;
      return data ?? [];
    },
  });


  const { data: companies, isLoading } = useQuery({
    queryKey: ["owner-companies"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("owner_list_companies");
      if (error) throw error;
      return (data ?? []) as unknown as OwnerCompany[];
    },
  });

  const { data: usage } = useQuery({
    queryKey: ["owner-usage"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("owner_usage");
      if (error) throw error;
      return (data ?? []) as unknown as UsageRow[];
    },
  });

  const { data: auditLog } = useQuery({
    queryKey: ["owner-audit"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("owner_audit_log", { _company_id: null, _limit: 300 });
      if (error) throw error;
      return (data ?? []) as unknown as AuditRow[];
    },
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["owner-companies"] });
    queryClient.invalidateQueries({ queryKey: ["owner-stats"] });
    queryClient.invalidateQueries({ queryKey: ["owner-audit"] });
    queryClient.invalidateQueries({ queryKey: ["owner-usage"] });
  };

  const updateCompany = useMutation({
    mutationFn: async (payload: { id: string; name?: string; plan?: string; status?: string; trial_ends_at?: string | null; notes?: string }) => {
      const { error } = await supabase.rpc("owner_update_company", {
        _company_id: payload.id,
        _name: payload.name ?? null,
        _plan: payload.plan ?? null,
        _status: payload.status ?? null,
        _seat_limit: null,
        _trial_ends_at: payload.trial_ends_at ? payload.trial_ends_at : null,
        _notes: payload.notes ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Company updated"); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const setLimits = useMutation({
    mutationFn: async (p: { id: string; seat_limit: number; storage_mb_limit: number; monthly_notification_limit: number; soft_warn_pct: number }) => {
      const { error } = await supabase.rpc("owner_set_limits", {
        _company_id: p.id, _seat_limit: p.seat_limit, _storage_mb_limit: p.storage_mb_limit,
        _monthly_notification_limit: p.monthly_notification_limit, _soft_warn_pct: p.soft_warn_pct,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Limits saved"); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteCompany = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc("owner_delete_company", { _company_id: id });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Company deleted");
      setDeleting(null); setDeleteConfirm(""); invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const startSupport = useMutation({
    mutationFn: async (p: { id: string; minutes: number; reason: string }) => {
      const { error } = await supabase.rpc("owner_start_support", {
        _company_id: p.id, _minutes: p.minutes, _reason: p.reason || null,
      });
      if (error) throw error;
    },
    onSuccess: async () => {
      setSupport(null); setSupportReason("");
      await refresh();
      navigate("/");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const setFeature = useMutation({
    mutationFn: async (p: { companyId: string; key: string; enabled: boolean }) => {
      const { error } = await supabase.rpc("owner_set_feature", {
        _company_id: p.companyId, _feature_key: p.key, _is_enabled: p.enabled,
      });
      if (error) throw error;
    },
    onSuccess: () => invalidate(),
    onError: (e: Error) => toast.error(e.message),
  });

  const setBilling = useMutation({
    mutationFn: async (p: { id: string; billing_interval: string; custom_price: number | null }) => {
      const { error } = await supabase.rpc("owner_set_billing", {
        _company_id: p.id, _billing_interval: p.billing_interval, _custom_price: p.custom_price,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["owner-company-billing"] });
      queryClient.invalidateQueries({ queryKey: ["owner-revenue"] });
      queryClient.invalidateQueries({ queryKey: ["owner-revenue-by-company"] });
      queryClient.invalidateQueries({ queryKey: ["owner-plans"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = useMemo(
    () => (companies ?? []).filter((c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) &&
      (statusFilter === "all" || c.status === statusFilter) &&
      (planFilter === "all" || c.plan === planFilter)),
    [companies, search, statusFilter, planFilter],
  );

  const openEdit = (c: OwnerCompany) => {
    const b = (billing ?? []).find((x) => x.id === c.id);
    setEditing(c);
    setForm({
      name: c.name, plan: c.plan, status: c.status, seat_limit: c.seat_limit,
      trial_ends_at: c.trial_ends_at ?? "", notes: c.notes ?? "",
      storage_mb_limit: c.storage_mb_limit, monthly_notification_limit: c.monthly_notification_limit,
      soft_warn_pct: c.soft_warn_pct,
      billing_interval: b?.billing_interval ?? "monthly",
      custom_price: b?.custom_price != null ? String(b.custom_price) : "",
    });
  };


  const exportAudit = () => {
    const rows = auditLog ?? [];
    const csv = [
      ["When", "Who", "Action", "Company", "Details"].join(","),
      ...rows.map((r) => [
        format(new Date(r.created_at), "yyyy-MM-dd HH:mm"),
        r.actor_email ?? "",
        r.action,
        r.company_name ?? "",
        JSON.stringify(r.details ?? {}).replace(/"/g, "'"),
      ].map((v) => `"${v}"`).join(",")),
    ].join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url; a.download = `platform-audit-${format(new Date(), "yyyy-MM-dd")}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const trialInfo = (c: OwnerCompany) => {
    if (c.status !== "trial" || !c.trial_ends_at) return null;
    const days = differenceInCalendarDays(new Date(c.trial_ends_at), new Date());
    return days < 0 ? "Trial expired" : `${days} day(s) left`;
  };

  return (
    <div className="min-h-screen bg-muted/20">
      <header className="border-b bg-background">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center gap-3">
          <ShieldAlert className="h-5 w-5 text-primary" />
          <div className="flex-1">
            <h1 className="font-bold leading-tight">Product Owner Console</h1>
            <p className="text-xs text-muted-foreground">All companies on the platform</p>
          </div>
          {memberships.length > 0 && (
            <Button variant="outline" size="sm" asChild><Link to="/">Back to my company</Link></Button>
          )}
          <Button variant="ghost" size="sm" onClick={signOut}><LogOut className="h-4 w-4" /></Button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-6 space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Companies", value: stats?.companies ?? 0, icon: Building2 },
            { label: "Active companies", value: stats?.active_companies ?? 0, icon: LayoutGrid },
            { label: "Not active", value: stats?.suspended_companies ?? 0, icon: ShieldAlert },
            { label: "People", value: stats?.people ?? 0, icon: Users },
          ].map((s) => (
            <Card key={s.label}>
              <CardContent className="pt-6 flex items-center gap-3">
                <s.icon className="h-8 w-8 text-primary/70" />
                <div>
                  <p className="text-2xl font-bold">{s.value}</p>
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Tabs defaultValue="companies">
          <TabsList>
            <TabsTrigger value="companies">Companies</TabsTrigger>
            <TabsTrigger value="revenue">Revenue</TabsTrigger>
            <TabsTrigger value="plans">Plans</TabsTrigger>
            <TabsTrigger value="broadcasts">Messages</TabsTrigger>
            <TabsTrigger value="usage">Usage &amp; storage</TabsTrigger>
            <TabsTrigger value="audit">Action log</TabsTrigger>
          </TabsList>

          <TabsContent value="revenue" className="mt-4"><RevenueTab /></TabsContent>
          <TabsContent value="plans" className="mt-4"><PlansTab /></TabsContent>
          <TabsContent value="broadcasts" className="mt-4"><BroadcastsTab /></TabsContent>


          <TabsContent value="companies" className="mt-4">
            <Card>
              <CardHeader className="flex-row flex-wrap items-center justify-between gap-3 space-y-0">
                <div>
                  <CardTitle>Companies</CardTitle>
                  <CardDescription>Manage lifecycle, plans, limits and features</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All statuses</SelectItem>
                      {STATUSES.map((s) => <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Select value={planFilter} onValueChange={setPlanFilter}>
                    <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All plans</SelectItem>
                      {(planOptions ?? []).map((p) => <SelectItem key={p.key} value={p.key}>{p.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <div className="relative w-52">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input className="pl-9" placeholder="Search companies" value={search} onChange={(e) => setSearch(e.target.value)} />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <p className="text-muted-foreground py-8 text-center">Loading...</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Company</TableHead>
                        <TableHead>Plan</TableHead>
                        <TableHead>Seats</TableHead>
                        <TableHead>Storage</TableHead>
                        <TableHead>Alerts</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtered.map((c) => {
                        const trial = trialInfo(c);
                        return (
                          <TableRow key={c.id} className={trial === "Trial expired" ? "bg-destructive/5" : undefined}>
                            <TableCell>
                              <p className="font-medium">{c.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {c.admins} admin(s) · {c.removed_people} former · since {format(new Date(c.created_at), "dd MMM yyyy")}
                              </p>
                            </TableCell>
                            <TableCell className="capitalize">{c.plan}</TableCell>
                            <TableCell>{c.active_people} / {c.seat_limit}</TableCell>
                            <TableCell>{Number(c.storage_used_mb).toFixed(1)} / {c.storage_mb_limit} MB</TableCell>
                            <TableCell>{c.notifications_this_month} / {c.monthly_notification_limit}</TableCell>
                            <TableCell>
                              <Badge variant={c.status === "active" ? "success" : c.status === "trial" ? "warning" : "danger"}>
                                {STATUS_LABEL[c.status] ?? c.status}
                              </Badge>
                              {trial && <p className="text-xs text-muted-foreground mt-1">{trial}</p>}
                            </TableCell>
                            <TableCell className="text-right space-x-2 whitespace-nowrap">
                              <Button size="sm" variant="outline" onClick={() => openEdit(c)}>Manage</Button>
                              <Button size="sm" variant="secondary" onClick={() => { setSupport(c); setSupportMinutes("30"); }}>
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => { setDeleting(c); setDeleteConfirm(""); }}>
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                      {filtered.length === 0 && (
                        <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No companies found</TableCell></TableRow>
                      )}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="usage" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Usage &amp; storage per company</CardTitle>
                <CardDescription>Records held and files stored, heaviest first</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Company</TableHead>
                      <TableHead>People</TableHead>
                      <TableHead>Attendance</TableHead>
                      <TableHead>Leave</TableHead>
                      <TableHead>Payslips</TableHead>
                      <TableHead>Documents</TableHead>
                      <TableHead>Storage</TableHead>
                      <TableHead>New in 30 days</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {[...(usage ?? [])].sort((a, b) => Number(b.storage_mb) - Number(a.storage_mb) || b.attendance_rows - a.attendance_rows).map((u) => (
                      <TableRow key={u.company_id}>
                        <TableCell className="font-medium">{u.company_name}</TableCell>
                        <TableCell>{u.people}</TableCell>
                        <TableCell>{u.attendance_rows}</TableCell>
                        <TableCell>{u.leave_rows}</TableCell>
                        <TableCell>{u.payslip_rows}</TableCell>
                        <TableCell>{u.document_rows}</TableCell>
                        <TableCell>{Number(u.storage_mb).toFixed(2)} MB</TableCell>
                        <TableCell>{u.rows_last_30d}</TableCell>
                      </TableRow>
                    ))}
                    {(usage ?? []).length === 0 && (
                      <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">No data yet</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="audit" className="mt-4">
            <Card>
              <CardHeader className="flex-row items-center justify-between space-y-0">
                <div>
                  <CardTitle>Action log</CardTitle>
                  <CardDescription>Every product-owner action across the platform</CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={exportAudit}><Download className="h-4 w-4 mr-2" /> Export CSV</Button>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>When</TableHead>
                      <TableHead>Who</TableHead>
                      <TableHead>Action</TableHead>
                      <TableHead>Company</TableHead>
                      <TableHead>Details</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(auditLog ?? []).map((l) => (
                      <TableRow key={l.id}>
                        <TableCell className="whitespace-nowrap text-sm">{format(new Date(l.created_at), "dd MMM yyyy HH:mm")}</TableCell>
                        <TableCell className="text-sm">{l.actor_email ?? "—"}</TableCell>
                        <TableCell><Badge variant="outline">{l.action.replace(/_/g, " ")}</Badge></TableCell>
                        <TableCell>{l.company_name ?? "—"}</TableCell>
                        <TableCell className="max-w-[320px] truncate text-xs text-muted-foreground">
                          {JSON.stringify(l.details ?? {})}
                        </TableCell>
                      </TableRow>
                    ))}
                    {(auditLog ?? []).length === 0 && (
                      <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No actions recorded yet</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      {/* Manage company */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing?.name}</DialogTitle></DialogHeader>
          {editing && (
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Company name</Label>
                  <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Plan</Label>
                  <Select value={form.plan} onValueChange={(v) => setForm({ ...form, plan: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(planOptions ?? []).map((p) => (
                        <SelectItem key={p.key} value={p.key}>{p.name}{p.is_active ? "" : " (hidden)"}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {STATUSES.map((s) => <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Trial ends on</Label>
                  <Input type="date" value={form.trial_ends_at} onChange={(e) => setForm({ ...form, trial_ends_at: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Billing cycle</Label>
                  <Select value={form.billing_interval} onValueChange={(v) => setForm({ ...form, billing_interval: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="monthly">Monthly</SelectItem>
                      <SelectItem value="annual">Yearly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Agreed price (optional)</Label>
                  <Input
                    type="number"
                    min={0}
                    placeholder="Leave blank to use plan price"
                    value={form.custom_price}
                    onChange={(e) => setForm({ ...form, custom_price: e.target.value })}
                  />
                </div>
              </div>


              <div className="space-y-3 rounded-md border p-4">
                <Label>Limits</Label>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Employee seats</Label>
                    <Input type="number" min={1} value={form.seat_limit} onChange={(e) => setForm({ ...form, seat_limit: Number(e.target.value) })} />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Document storage (MB)</Label>
                    <Input type="number" min={1} value={form.storage_mb_limit} onChange={(e) => setForm({ ...form, storage_mb_limit: Number(e.target.value) })} />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Notifications per month</Label>
                    <Input type="number" min={1} value={form.monthly_notification_limit} onChange={(e) => setForm({ ...form, monthly_notification_limit: Number(e.target.value) })} />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Warn at (% of limit)</Label>
                    <Input type="number" min={1} max={100} value={form.soft_warn_pct} onChange={(e) => setForm({ ...form, soft_warn_pct: Number(e.target.value) })} />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Currently using {editing.active_people} seats, {Number(editing.storage_used_mb).toFixed(1)} MB and {editing.notifications_this_month} notifications this month.
                </p>
              </div>

              <div className="space-y-2">
                <Label>Internal notes</Label>
                <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Billing or account notes" />
              </div>

              <div className="space-y-3">
                <Label>Features</Label>
                <div className="grid sm:grid-cols-2 gap-3">
                  {FEATURES.map((f) => {
                    const enabled = editing.features?.[f.key] !== false;
                    return (
                      <div key={f.key} className="flex items-start justify-between gap-3 rounded-md border p-3">
                        <div>
                          <p className="text-sm font-medium">{f.label}</p>
                          <p className="text-xs text-muted-foreground">{f.description}</p>
                        </div>
                        <Switch
                          checked={enabled}
                          onCheckedChange={(v) => {
                            setEditing({ ...editing, features: { ...(editing.features ?? {}), [f.key]: v } });
                            setFeature.mutate({ companyId: editing.id, key: f.key, enabled: v });
                          }}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Close</Button>
            <Button
              onClick={async () => {
                if (!editing) return;
                await updateCompany.mutateAsync({
                  id: editing.id, name: form.name, plan: form.plan, status: form.status,
                  trial_ends_at: form.trial_ends_at || null, notes: form.notes,
                });
                await setLimits.mutateAsync({
                  id: editing.id, seat_limit: form.seat_limit, storage_mb_limit: form.storage_mb_limit,
                  monthly_notification_limit: form.monthly_notification_limit, soft_warn_pct: form.soft_warn_pct,
                });
                await setBilling.mutateAsync({
                  id: editing.id,
                  billing_interval: form.billing_interval,
                  custom_price: form.custom_price === "" ? null : Number(form.custom_price),
                });
                setEditing(null);

              }}
            >
              Save changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Support mode */}
      <Dialog open={!!support} onOpenChange={(o) => !o && setSupport(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Enter support mode</DialogTitle>
            <DialogDescription>
              You will view {support?.name} exactly as their team sees it. Nothing can be changed, the session ends automatically, and it is recorded in the action log.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Session length</Label>
              <Select value={supportMinutes} onValueChange={setSupportMinutes}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["15", "30", "60", "120"].map((m) => <SelectItem key={m} value={m}>{m} minutes</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Reason (recorded)</Label>
              <Input value={supportReason} onChange={(e) => setSupportReason(e.target.value)} placeholder="e.g. Payroll ticket #124" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSupport(null)}>Cancel</Button>
            <Button
              disabled={startSupport.isPending}
              onClick={() => support && startSupport.mutate({ id: support.id, minutes: Number(supportMinutes), reason: supportReason })}
            >
              Start session
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete company */}
      <Dialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {deleting?.name}?</DialogTitle>
            <DialogDescription>
              This permanently removes the company and all of its people, attendance, leave, payroll and documents. This cannot be undone.
              Type the company name to confirm.
            </DialogDescription>
          </DialogHeader>
          <Input value={deleteConfirm} onChange={(e) => setDeleteConfirm(e.target.value)} placeholder={deleting?.name} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleting(null)}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={deleteConfirm.trim() !== deleting?.name || deleteCompany.isPending}
              onClick={() => deleting && deleteCompany.mutate(deleting.id)}
            >
              Delete permanently
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
