import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "@/components/ui/sonner";
import { Settings2, RefreshCw, Plus } from "lucide-react";
import { format } from "date-fns";
import { slugify } from "@/lib/leave";

export default function LeaveTypes() {
  const queryClient = useQueryClient();
  const { company } = useAuth();
  const [drafts, setDrafts] = useState<Record<string, number>>({});
  const [capDrafts, setCapDrafts] = useState<Record<string, number>>({});

  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [days, setDays] = useState(12);
  const [carry, setCarry] = useState(false);
  const [carryMax, setCarryMax] = useState(0);
  const [appliesTo, setAppliesTo] = useState<"all" | "selected">("all");
  const [selected, setSelected] = useState<string[]>([]);

  const { data: policies } = useQuery({
    queryKey: ["leave-policies", company?.id],
    enabled: !!company?.id,
    queryFn: async () => {
      const { data, error } = await supabase.from("leave_policies").select("*").order("label");
      if (error) throw error;
      return data || [];
    },
  });

  const { data: people } = useQuery({
    queryKey: ["leave-type-people", company?.id],
    enabled: !!company?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("user_id, full_name, employee_id")
        .eq("status", "active")
        .order("full_name");
      return data || [];
    },
  });

  const enabledCount = policies?.filter((p) => p.is_enabled).length ?? 0;
  const lastRun = policies?.find((p) => p.last_carry_forward_at)?.last_carry_forward_at;

  const update = useMutation({
    mutationFn: async ({ id, values }: {
      id: string;
      values: { default_days?: number; is_enabled?: boolean; label?: string; carry_forward_enabled?: boolean; carry_forward_max?: number };
    }) => {
      const { error } = await supabase.from("leave_policies").update(values).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Leave type updated");
      queryClient.invalidateQueries({ queryKey: ["leave-policies"] });
      queryClient.invalidateQueries({ queryKey: ["leave-balances"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const create = useMutation({
    mutationFn: async () => {
      const companyId = company?.id;
      if (!companyId) throw new Error("Company is still loading — please try again");
      const label = name.trim();
      if (label.length < 2 || label.length > 40) throw new Error("Leave type name must be 2–40 characters");
      if (appliesTo === "selected" && selected.length === 0) throw new Error("Pick at least one employee");
      const { data, error } = await supabase
        .from("leave_policies")
        .insert({
          company_id: companyId,
          label,
          code: slugify(label) || `type_${Date.now()}`,
          default_days: days,
          is_enabled: true,
          applies_to: appliesTo,
          carry_forward_enabled: carry,
          carry_forward_max: carry ? carryMax : 0,
        })
        .select("id")
        .single();
      if (error) throw error;

      if (appliesTo === "selected") {
        for (const userId of selected) {
          const { error: e } = await supabase.rpc("hr_set_employee_leave", {
            _user_id: userId,
            _policy_id: data.id,
            _is_enabled: true,
            _entitlement: null,
            _note: `Added with new leave type ${label}`,
          });
          if (e) throw e;
        }
      }
    },
    onSuccess: () => {
      toast.success("Leave type created");
      setOpen(false);
      setName(""); setDays(12); setCarry(false); setCarryMax(0); setAppliesTo("all"); setSelected([]);
      queryClient.invalidateQueries({ queryKey: ["leave-policies"] });
      queryClient.invalidateQueries({ queryKey: ["leave-balances"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const carryForward = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("run_leave_carry_forward");
      if (error) throw error;
      return data as number;
    },
    onSuccess: (n) => {
      toast.success(`Year-end run complete — ${n} balance${n === 1 ? "" : "s"} carried forward`);
      queryClient.invalidateQueries({ queryKey: ["leave-policies"] });
      queryClient.invalidateQueries({ queryKey: ["leave-balances"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2"><Settings2 className="h-6 w-6" /> Leave Types</h1>
          <p className="text-muted-foreground">
            Your company's own leave types — who can apply, default days and carry-forward rules
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-2" /> Add leave type</Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" disabled={carryForward.isPending}>
                <RefreshCw className="h-4 w-4 mr-2" /> Run year-end carry forward
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Start the new leave year?</AlertDialogTitle>
                <AlertDialogDescription>
                  For leave types with carry forward on, unused days (up to the cap) are added to the new year's allowance.
                  All other leave types are reset to each person's entitlement. Compensatory off balances are left untouched.
                  This cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={() => carryForward.mutate()}>Run now</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {lastRun && (
        <p className="text-xs text-muted-foreground">Last year-end run: {format(new Date(lastRun), "MMM d, yyyy h:mm a")}</p>
      )}

      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Display Name</TableHead>
                <TableHead className="w-40">Applies to</TableHead>
                <TableHead className="w-32">Default Days</TableHead>
                <TableHead className="w-28">Active</TableHead>
                <TableHead className="w-32">Carry forward</TableHead>
                <TableHead className="w-32">Max carried</TableHead>
                <TableHead className="w-24" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {policies?.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>
                    <Input
                      defaultValue={p.label}
                      maxLength={40}
                      onBlur={(e) => e.target.value !== p.label && update.mutate({ id: p.id, values: { label: e.target.value } })}
                    />
                  </TableCell>
                  <TableCell>
                    <Badge variant={p.applies_to === "all" ? "outline" : "department"}>
                      {p.applies_to === "all" ? "All employees" : "Selected employees"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      min={0}
                      defaultValue={p.default_days}
                      onChange={(e) => setDrafts((d) => ({ ...d, [p.id]: Number(e.target.value) }))}
                    />
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={p.is_enabled}
                      onCheckedChange={(v) => {
                        if (!v && p.is_enabled && enabledCount <= 1) {
                          toast.error("At least one leave type must stay enabled");
                          return;
                        }
                        update.mutate({ id: p.id, values: { is_enabled: v } });
                      }}
                    />
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={p.carry_forward_enabled}
                      disabled={p.code === "compensatory"}
                      onCheckedChange={(v) => update.mutate({ id: p.id, values: { carry_forward_enabled: v } })}
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      min={0}
                      disabled={!p.carry_forward_enabled}
                      defaultValue={p.carry_forward_max}
                      onChange={(e) => setCapDrafts((d) => ({ ...d, [p.id]: Number(e.target.value) }))}
                    />
                  </TableCell>
                  <TableCell>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={
                        (drafts[p.id] === undefined || drafts[p.id] === p.default_days) &&
                        (capDrafts[p.id] === undefined || capDrafts[p.id] === p.carry_forward_max)
                      }
                      onClick={() =>
                        update.mutate({
                          id: p.id,
                          values: {
                            ...(drafts[p.id] !== undefined ? { default_days: drafts[p.id] } : {}),
                            ...(capDrafts[p.id] !== undefined ? { carry_forward_max: capDrafts[p.id] } : {}),
                          },
                        })
                      }
                    >
                      Save
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <p className="text-xs text-muted-foreground">
        Changing the default days updates everyone still on the company default. People with their own number keep it —
        set those on Employees → the person → Leave. Switching a type off stops new requests but keeps all history.
      </p>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>New leave type</DialogTitle>
            <DialogDescription>Only your company sees this leave type.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input value={name} maxLength={40} onChange={(e) => setName(e.target.value)} placeholder="e.g. Study Leave" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Default days per year</Label>
                <Input type="number" min={0} value={days} onChange={(e) => setDays(Number(e.target.value))} />
              </div>
              <div className="space-y-2">
                <Label>Max days carried forward</Label>
                <Input type="number" min={0} disabled={!carry} value={carryMax} onChange={(e) => setCarryMax(Number(e.target.value))} />
              </div>
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <Label className="text-sm">Allow carry forward at year end</Label>
              <Switch checked={carry} onCheckedChange={setCarry} />
            </div>

            <div className="space-y-2">
              <Label>Applies to</Label>
              <div className="flex gap-2">
                <Button type="button" variant={appliesTo === "all" ? "default" : "outline"} size="sm" onClick={() => setAppliesTo("all")}>
                  All employees
                </Button>
                <Button type="button" variant={appliesTo === "selected" ? "default" : "outline"} size="sm" onClick={() => setAppliesTo("selected")}>
                  Selected employees
                </Button>
              </div>
              {appliesTo === "selected" && (
                <div className="max-h-52 overflow-auto rounded-lg border p-3 space-y-2">
                  {(people || []).map((p) => (
                    <label key={p.user_id} className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={selected.includes(p.user_id)}
                        onCheckedChange={(v) =>
                          setSelected((s) => (v ? [...s, p.user_id] : s.filter((x) => x !== p.user_id)))
                        }
                      />
                      {p.full_name} <span className="text-xs text-muted-foreground">{p.employee_id}</span>
                    </label>
                  ))}
                  {(people || []).length === 0 && <p className="text-sm text-muted-foreground">No employees yet</p>}
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button disabled={create.isPending} onClick={() => create.mutate()}>Create leave type</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
