import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface RevenueRow {
  company_id: string;
  company_name: string;
  plan: string;
  status: string;
  billing_interval: string;
  mrr: number;
  active_seats: number;
  seat_limit: number;
}

export const money = (n: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(Number(n || 0));

export default function RevenueTab() {
  const { data: metrics } = useQuery({
    queryKey: ["owner-revenue"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("owner_revenue");
      if (error) throw error;
      return (data ?? {}) as Record<string, number>;
    },
  });

  const { data: rows } = useQuery({
    queryKey: ["owner-revenue-by-company"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("owner_revenue_by_company");
      if (error) throw error;
      return (data ?? []) as unknown as RevenueRow[];
    },
  });

  const cards = [
    { label: "Monthly recurring revenue", value: money(metrics?.mrr ?? 0), hint: `${metrics?.paying_companies ?? 0} paying companies` },
    { label: "Annual recurring revenue", value: money(metrics?.arr ?? 0), hint: "MRR x 12" },
    { label: "Average revenue per company", value: money(metrics?.arpu ?? 0), hint: `${metrics?.active_companies ?? 0} active companies` },
    { label: "Churn (last 30 days)", value: `${metrics?.churn_rate ?? 0}%`, hint: `${metrics?.churned_30d ?? 0} companies suspended` },
    { label: "Active paid seats", value: String(metrics?.active_seats ?? 0), hint: "Employees counted across all companies" },
    { label: "Revenue per seat", value: money(metrics?.revenue_per_seat ?? 0), hint: "MRR divided by active seats" },
    { label: "On trial", value: String(metrics?.trial_companies ?? 0), hint: "Not billing yet" },
    { label: "Past due", value: String(metrics?.past_due_companies ?? 0), hint: "Payment pending" },
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <Card key={c.label}>
            <CardContent className="pt-6">
              <p className="text-2xl font-bold">{c.value}</p>
              <p className="text-sm font-medium mt-1">{c.label}</p>
              <p className="text-xs text-muted-foreground">{c.hint}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Revenue by company</CardTitle>
          <CardDescription>Based on the plan prices you set, plus any agreed custom price</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Company</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Billing</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Seats in use</TableHead>
                <TableHead className="text-right">Monthly value</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(rows ?? []).map((r) => (
                <TableRow key={r.company_id}>
                  <TableCell className="font-medium">{r.company_name}</TableCell>
                  <TableCell className="capitalize">{r.plan}</TableCell>
                  <TableCell className="capitalize">{r.billing_interval}</TableCell>
                  <TableCell>
                    <Badge variant={r.status === "active" ? "success" : r.status === "trial" ? "warning" : "danger"}>
                      {r.status.replace("_", " ")}
                    </Badge>
                  </TableCell>
                  <TableCell>{r.active_seats} / {r.seat_limit}</TableCell>
                  <TableCell className="text-right">{money(r.mrr)}</TableCell>
                </TableRow>
              ))}
              {(rows ?? []).length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No companies yet</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
