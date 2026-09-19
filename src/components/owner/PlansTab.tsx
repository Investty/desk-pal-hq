import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/components/ui/sonner";
import { Plus } from "lucide-react";
import { money } from "./RevenueTab";

interface PlanRow {
  id: string; key: string; name: string; description: string | null;
  monthly_price: number; annual_price: number; currency: string;
  included_seats: number; is_active: boolean; sort_order: number;
  companies: number; mrr: number;
}

const empty = {
  id: null as string | null, key: "", name: "", description: "",
  monthly_price: 0, annual_price: 0, currency: "INR",
  included_seats: 25, is_active: true, sort_order: 10,
};

export default function PlansTab() {
  const qc = useQueryClient();
  const [form, setForm] = useState<typeof empty | null>(null);

  const { data: plans } = useQuery({
    queryKey: ["owner-plans"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("owner_list_plans");
      if (error) throw error;
      return (data ?? []) as unknown as PlanRow[];
    },
  });

  const save = useMutation({
    mutationFn: async (p: typeof empty) => {
      const { error } = await supabase.rpc("owner_upsert_plan", {
        _id: p.id, _key: p.key, _name: p.name, _description: p.description,
        _monthly_price: p.monthly_price, _annual_price: p.annual_price, _currency: p.currency,
        _included_seats: p.included_seats, _is_active: p.is_active, _sort_order: p.sort_order,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Plan saved");
      setForm(null);
      qc.invalidateQueries({ queryKey: ["owner-plans"] });
      qc.invalidateQueries({ queryKey: ["owner-revenue"] });
      qc.invalidateQueries({ queryKey: ["owner-revenue-by-company"] });
      qc.invalidateQueries({ queryKey: ["owner-audit"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle>Plans &amp; pricing</CardTitle>
          <CardDescription>Create tiers and set monthly or yearly prices — companies pick these up instantly</CardDescription>
        </div>
        <Button size="sm" onClick={() => setForm({ ...empty })}><Plus className="h-4 w-4 mr-2" /> New plan</Button>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Plan</TableHead>
              <TableHead>Monthly</TableHead>
              <TableHead>Yearly</TableHead>
              <TableHead>Seats included</TableHead>
              <TableHead>Companies</TableHead>
              <TableHead>Monthly value</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(plans ?? []).map((p) => (
              <TableRow key={p.id}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{p.name}</span>
                    {!p.is_active && <Badge variant="outline">Hidden</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground">{p.description || p.key}</p>
                </TableCell>
                <TableCell>{money(p.monthly_price)}</TableCell>
                <TableCell>{money(p.annual_price)}</TableCell>
                <TableCell>{p.included_seats}</TableCell>
                <TableCell>{p.companies}</TableCell>
                <TableCell>{money(p.mrr)}</TableCell>
                <TableCell className="text-right">
                  <Button size="sm" variant="outline" onClick={() => setForm({
                    id: p.id, key: p.key, name: p.name, description: p.description ?? "",
                    monthly_price: Number(p.monthly_price), annual_price: Number(p.annual_price),
                    currency: p.currency, included_seats: p.included_seats,
                    is_active: p.is_active, sort_order: p.sort_order,
                  })}>Edit</Button>
                </TableCell>
              </TableRow>
            ))}
            {(plans ?? []).length === 0 && (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No plans yet</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>

      <Dialog open={!!form} onOpenChange={(o) => !o && setForm(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{form?.id ? "Edit plan" : "New plan"}</DialogTitle>
            <DialogDescription>Prices are used for the revenue figures and shown to companies on this tier.</DialogDescription>
          </DialogHeader>
          {form && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Plan name</Label>
                  <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Growth" />
                </div>
                <div className="space-y-2">
                  <Label>Short code</Label>
                  <Input value={form.key} disabled={!!form.id} onChange={(e) => setForm({ ...form, key: e.target.value })} placeholder="growth" />
                </div>
                <div className="space-y-2">
                  <Label>Price per month</Label>
                  <Input type="number" min={0} value={form.monthly_price} onChange={(e) => setForm({ ...form, monthly_price: Number(e.target.value) })} />
                </div>
                <div className="space-y-2">
                  <Label>Price per year</Label>
                  <Input type="number" min={0} value={form.annual_price} onChange={(e) => setForm({ ...form, annual_price: Number(e.target.value) })} />
                </div>
                <div className="space-y-2">
                  <Label>Seats included</Label>
                  <Input type="number" min={1} value={form.included_seats} onChange={(e) => setForm({ ...form, included_seats: Number(e.target.value) })} />
                </div>
                <div className="space-y-2">
                  <Label>Display order</Label>
                  <Input type="number" value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: Number(e.target.value) })} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </div>
              <div className="flex items-center justify-between rounded-md border p-3">
                <div>
                  <p className="text-sm font-medium">Available to sell</p>
                  <p className="text-xs text-muted-foreground">Turn off to retire the tier without touching existing companies</p>
                </div>
                <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setForm(null)}>Cancel</Button>
            <Button
              disabled={!form?.name || !form?.key || save.isPending}
              onClick={() => form && save.mutate(form)}
            >
              Save plan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
