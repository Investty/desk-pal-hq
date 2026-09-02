import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Settings2 } from "lucide-react";

export default function LeaveTypes() {
  const queryClient = useQueryClient();
  const [drafts, setDrafts] = useState<Record<string, number>>({});

  const { data: policies } = useQuery({
    queryKey: ["leave-policies"],
    queryFn: async () => {
      const { data, error } = await supabase.from("leave_policies").select("*").order("label");
      if (error) throw error;
      return data || [];
    },
  });

  const update = useMutation({
    mutationFn: async ({ id, values }: { id: string; values: { default_days?: number; is_enabled?: boolean; label?: string } }) => {
      const { error } = await supabase.from("leave_policies").update(values).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Leave policy updated");
      queryClient.invalidateQueries({ queryKey: ["leave-policies"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><Settings2 className="h-6 w-6" /> Leave Types</h1>
        <p className="text-muted-foreground">Set which leave types employees can apply for and the default annual days</p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Leave Type</TableHead>
                <TableHead>Display Name</TableHead>
                <TableHead className="w-40">Default Days</TableHead>
                <TableHead className="w-32">Enabled</TableHead>
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
                      onCheckedChange={(v) => update.mutate({ id: p.id, values: { is_enabled: v } })}
                    />
                  </TableCell>
                  <TableCell>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={drafts[p.id] === undefined || drafts[p.id] === p.default_days}
                      onClick={() => update.mutate({ id: p.id, values: { default_days: drafts[p.id] } })}
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
      <p className="text-xs text-muted-foreground">Default days apply to newly created employees. Existing balances are unchanged.</p>
    </div>
  );
}
