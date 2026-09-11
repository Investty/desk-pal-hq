import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Building2, Search, Users, ShieldAlert, LayoutGrid, LogOut } from "lucide-react";
import { Link } from "react-router-dom";
import { FEATURES, PLANS } from "@/lib/features";
import { format } from "date-fns";

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
}

export default function Owner() {
  const queryClient = useQueryClient();
  const { signOut, memberships } = useAuth();
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<OwnerCompany | null>(null);
  const [form, setForm] = useState({ name: "", plan: "free", status: "active", seat_limit: 25, trial_ends_at: "", notes: "" });

  const { data: stats } = useQuery({
    queryKey: ["owner-stats"],
    queryFn: async () => {
      const { data } = await supabase.rpc("owner_stats");
      return (data ?? {}) as Record<string, number>;
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

  const updateCompany = useMutation({
    mutationFn: async (payload: { id: string; name?: string; plan?: string; status?: string; seat_limit?: number; trial_ends_at?: string | null; notes?: string }) => {
      const { error } = await supabase.rpc("owner_update_company", {
        _company_id: payload.id,
        _name: payload.name ?? null,
        _plan: payload.plan ?? null,
        _status: payload.status ?? null,
        _seat_limit: payload.seat_limit ?? null,
        _trial_ends_at: payload.trial_ends_at ? payload.trial_ends_at : null,
        _notes: payload.notes ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Company updated");
      queryClient.invalidateQueries({ queryKey: ["owner-companies"] });
      queryClient.invalidateQueries({ queryKey: ["owner-stats"] });
      setEditing(null);
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
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["owner-companies"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = useMemo(
    () => (companies ?? []).filter((c) => c.name.toLowerCase().includes(search.toLowerCase())),
    [companies, search],
  );

  const openEdit = (c: OwnerCompany) => {
    setEditing(c);
    setForm({
      name: c.name, plan: c.plan, status: c.status, seat_limit: c.seat_limit,
      trial_ends_at: c.trial_ends_at ?? "", notes: c.notes ?? "",
    });
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
            { label: "Suspended", value: stats?.suspended_companies ?? 0, icon: ShieldAlert },
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

        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle>Companies</CardTitle>
              <CardDescription>Manage plans, seats, status and features</CardDescription>
            </div>
            <div className="relative w-56">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input className="pl-9" placeholder="Search companies" value={search} onChange={(e) => setSearch(e.target.value)} />
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
                    <TableHead>People</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell>
                        <p className="font-medium">{c.name}</p>
                        <p className="text-xs text-muted-foreground">{c.admins} admin(s) · {c.removed_people} former</p>
                      </TableCell>
                      <TableCell className="capitalize">{c.plan}</TableCell>
                      <TableCell>{c.active_people} / {c.seat_limit}</TableCell>
                      <TableCell>
                        <Badge variant={c.status === "active" ? "default" : "destructive"} className="capitalize">{c.status}</Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{format(new Date(c.created_at), "dd MMM yyyy")}</TableCell>
                      <TableCell className="text-right space-x-2">
                        <Button size="sm" variant="outline" onClick={() => openEdit(c)}>Manage</Button>
                        <Button
                          size="sm"
                          variant={c.status === "active" ? "destructive" : "default"}
                          onClick={() => updateCompany.mutate({ id: c.id, status: c.status === "active" ? "suspended" : "active" })}
                        >
                          {c.status === "active" ? "Suspend" : "Reactivate"}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {filtered.length === 0 && (
                    <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No companies found</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </main>

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
                      {PLANS.map((p) => <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Seat limit</Label>
                  <Input type="number" min={1} value={form.seat_limit} onChange={(e) => setForm({ ...form, seat_limit: Number(e.target.value) })} />
                </div>
                <div className="space-y-2">
                  <Label>Trial ends on</Label>
                  <Input type="date" value={form.trial_ends_at} onChange={(e) => setForm({ ...form, trial_ends_at: e.target.value })} />
                </div>
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
              onClick={() => editing && updateCompany.mutate({
                id: editing.id, name: form.name, plan: form.plan, seat_limit: form.seat_limit,
                trial_ends_at: form.trial_ends_at || null, notes: form.notes,
              })}
            >
              Save changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
