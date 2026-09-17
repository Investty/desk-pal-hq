import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Settings2, RefreshCw } from "lucide-react";
import { format } from "date-fns";

export default function LeaveTypes() {
  const queryClient = useQueryClient();
  const [drafts, setDrafts] = useState<Record<string, number>>({});
  const [capDrafts, setCapDrafts] = useState<Record<string, number>>({});

  const { data: policies } = useQuery({
    queryKey: ["leave-policies"],
    queryFn: async () => {
      const { data, error } = await supabase.from("leave_policies").select("*").order("label");
      if (error) throw error;
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
      toast.success("Leave policy updated");
      queryClient.invalidateQueries({ queryKey: ["leave-policies"] });
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
          <p className="text-muted-foreground">Set which leave types employees can apply for, default annual days and carry-forward rules</p>
        </div>
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
                All other leave types are reset to their default days. Compensatory off balances are left untouched.
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

      {lastRun && (
        <p className="text-xs text-muted-foreground">Last year-end run: {format(new Date(lastRun), "MMM d, yyyy h:mm a")}</p>
      )}

      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Leave Type</TableHead>
                <TableHead>Display Name</TableHead>
                <TableHead className="w-32">Default Days</TableHead>
                <TableHead className="w-28">Enabled</TableHead>
                <TableHead className="w-32">Carry forward</TableHead>
                <TableHead className="w-32">Max carried</TableHead>
                <TableHead className="w-24" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {policies?.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="capitalize font-medium">{p.leave_type}</TableCell>
                  <TableCell>
                    <Input
                      defaultValue={p.label}
                      maxLength={40}
                      onBlur={(e) => e.target.value !== p.label && update.mutate({ id: p.id, values: { label: e.target.value } })}
                    />
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
                      disabled={p.leave_type === "compensatory"}
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
        Default days apply to newly created employees. Existing balances change only when you run the year-end carry forward.
      </p>
    </div>
  );
}
