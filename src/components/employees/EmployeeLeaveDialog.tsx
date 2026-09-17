import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { RotateCcw } from "lucide-react";

interface Props {
  employee: { user_id: string; full_name: string } | null;
  onOpenChange: (open: boolean) => void;
}

interface Draft {
  enabled: boolean;
  custom: boolean;
  days: number;
}

export default function EmployeeLeaveDialog({ employee, onOpenChange }: Props) {
  const queryClient = useQueryClient();
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [note, setNote] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["employee-leave-config", employee?.user_id],
    enabled: !!employee?.user_id,
    queryFn: async () => {
      const [policies, settings, balances, requests] = await Promise.all([
        supabase.from("leave_policies").select("*").order("label"),
        supabase.from("employee_leave_settings").select("*").eq("user_id", employee!.user_id),
        supabase.from("leave_balances").select("*").eq("user_id", employee!.user_id),
        supabase
          .from("leave_requests")
          .select("policy_id, status, start_date, end_date, day_portion")
          .eq("user_id", employee!.user_id)
          .eq("status", "pending"),
      ]);
      if (policies.error) throw policies.error;
      return {
        policies: policies.data || [],
        settings: settings.data || [],
        balances: balances.data || [],
        pending: requests.data || [],
      };
    },
  });

  useEffect(() => {
    if (!data) return;
    const next: Record<string, Draft> = {};
    for (const p of data.policies) {
      const s = data.settings.find((x) => x.policy_id === p.id);
      next[p.id] = {
        enabled: s ? s.is_enabled : p.applies_to === "all",
        custom: s?.entitlement_override != null,
        days: Number(s?.entitlement_override ?? p.default_days),
      };
    }
    setDrafts(next);
  }, [data]);

  const save = useMutation({
    mutationFn: async (policyId: string) => {
      const d = drafts[policyId];
      const { error } = await supabase.rpc("hr_set_employee_leave", {
        _user_id: employee!.user_id,
        _policy_id: policyId,
        _is_enabled: d.enabled,
        _entitlement: d.custom ? d.days : null,
        _note: note.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Leave configuration saved");
      queryClient.invalidateQueries({ queryKey: ["employee-leave-config"] });
      queryClient.invalidateQueries({ queryKey: ["leave-balances"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const pendingDays = (policyId: string) =>
    (data?.pending || [])
      .filter((r) => r.policy_id === policyId)
      .reduce((sum, r) => {
        if (r.day_portion !== "full_day") return sum + 0.5;
        return sum + Math.round((new Date(r.end_date).getTime() - new Date(r.start_date).getTime()) / 86400000) + 1;
      }, 0);

  const patch = (id: string, values: Partial<Draft>) =>
    setDrafts((d) => ({ ...d, [id]: { ...d[id], ...values } }));

  return (
    <Dialog open={!!employee} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Leave configuration — {employee?.full_name}</DialogTitle>
          <DialogDescription>
            Turn leave types on or off for this person and give them their own number of days. Leave the days on the
            company default and they follow future policy changes automatically.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Reason / note (saved in audit history)</Label>
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Agreed at joining" />
          </div>

          <div className="max-h-[50vh] overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Leave type</TableHead>
                  <TableHead className="w-24">Enabled</TableHead>
                  <TableHead className="w-48">Entitlement</TableHead>
                  <TableHead className="w-20">Used</TableHead>
                  <TableHead className="w-20">Pending</TableHead>
                  <TableHead className="w-24">Available</TableHead>
                  <TableHead className="w-24" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data?.policies || []).map((p) => {
                  const d = drafts[p.id];
                  const bal = data?.balances.find((b) => b.policy_id === p.id);
                  if (!d) return null;
                  return (
                    <TableRow key={p.id}>
                      <TableCell>
                        <p className="font-medium">{p.label}</p>
                        <p className="text-xs text-muted-foreground">
                          Company default {p.default_days} days
                          {!p.is_enabled && " · type switched off"}
                        </p>
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={d.enabled}
                          disabled={!p.is_enabled}
                          onCheckedChange={(v) => patch(p.id, { enabled: v })}
                        />
                      </TableCell>
                      <TableCell>
                        {d.custom ? (
                          <div className="flex items-center gap-2">
                            <Input
                              type="number"
                              min={0}
                              className="w-20"
                              value={d.days}
                              onChange={(e) => patch(p.id, { days: Number(e.target.value) })}
                            />
                            <Button
                              size="icon"
                              variant="ghost"
                              title="Use company default"
                              onClick={() => patch(p.id, { custom: false, days: Number(p.default_days) })}
                            >
                              <RotateCcw className="h-4 w-4" />
                            </Button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <Badge variant="outline">Company default · {p.default_days}</Badge>
                            <Button size="sm" variant="ghost" onClick={() => patch(p.id, { custom: true })}>
                              Customise
                            </Button>
                          </div>
                        )}
                      </TableCell>
                      <TableCell>{bal?.used_days ?? 0}</TableCell>
                      <TableCell>{pendingDays(p.id)}</TableCell>
                      <TableCell>{bal ? `${bal.remaining_days}/${bal.total_days}` : "—"}</TableCell>
                      <TableCell>
                        <Button size="sm" variant="outline" disabled={save.isPending} onClick={() => save.mutate(p.id)}>
                          Save
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {!isLoading && (data?.policies || []).length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                      No leave types set up for this company yet
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
