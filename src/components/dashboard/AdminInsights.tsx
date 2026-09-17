import { leaveLabel } from "@/lib/leave";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "react-router-dom";
import { format, subDays } from "date-fns";
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { computeSalary } from "@/lib/salary";

const PALETTE = ["hsl(var(--primary))", "hsl(var(--success))", "hsl(var(--warning))", "hsl(var(--info))", "hsl(var(--destructive))"];

function ChartCard({ title, to, linkLabel, children }: { title: string; to: string; linkLabel: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-base">{title}</CardTitle>
        <Link to={to} className="text-xs text-primary hover:underline">{linkLabel}</Link>
      </CardHeader>
      <CardContent className="h-64">{children}</CardContent>
    </Card>
  );
}

export default function AdminInsights() {
  const since = format(subDays(new Date(), 13), "yyyy-MM-dd");

  const { data } = useQuery({
    queryKey: ["admin-insights", since],
    queryFn: async () => {
      const [profiles, departments, attendance, leaves, salaries] = await Promise.all([
        supabase.from("profiles").select("id, department_id, is_active"),
        supabase.from("departments").select("id, name"),
        supabase.from("attendance").select("date, status").gte("date", since),
        supabase.from("leave_requests").select("leave_type, status, start_date, end_date, leave_policies:policy_id(label)"),
        supabase.from("salary_structures").select("basic, da, hra, special_allowance, pf_rate, professional_tax, tds"),
      ]);

      const deptName = new Map((departments.data || []).map((d) => [d.id, d.name]));
      const headcount = Object.entries(
        (profiles.data || []).filter((p) => p.is_active).reduce<Record<string, number>>((acc, p) => {
          const name = (p.department_id && deptName.get(p.department_id)) || "Unassigned";
          acc[name] = (acc[name] || 0) + 1;
          return acc;
        }, {})
      ).map(([name, value]) => ({ name, value }));

      const byDate: Record<string, { date: string; present: number; late: number; absent: number }> = {};
      for (let i = 13; i >= 0; i--) {
        const d = format(subDays(new Date(), i), "yyyy-MM-dd");
        byDate[d] = { date: format(new Date(d), "MMM d"), present: 0, late: 0, absent: 0 };
      }
      (attendance.data || []).forEach((a) => {
        const row = byDate[a.date];
        if (row && (a.status === "present" || a.status === "late" || a.status === "absent")) row[a.status] += 1;
      });

      const leaveByType = Object.entries(
        (leaves.data || []).filter((l) => l.status === "approved").reduce<Record<string, number>>((acc, l) => {
          const days = Math.max(1, (new Date(l.end_date).getTime() - new Date(l.start_date).getTime()) / 86400000 + 1);
          const key = leaveLabel(l);
          acc[key] = (acc[key] || 0) + days;
          return acc;
        }, {})
      ).map(([name, value]) => ({ name, value }));

      const totals = (salaries.data || []).reduce(
        (acc, s) => {
          const c = computeSalary(s);
          acc.gross += c.gross;
          acc.deductions += c.deductions;
          acc.net += c.net;
          return acc;
        },
        { gross: 0, deductions: 0, net: 0 }
      );
      const salaryData = [
        { name: "Gross", amount: Math.round(totals.gross) },
        { name: "Deductions", amount: Math.round(totals.deductions) },
        { name: "Net payout", amount: Math.round(totals.net) },
      ];

      return { headcount, attendance: Object.values(byDate), leaveByType, salaryData };
    },
  });

  if (!data) return null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <ChartCard title="Headcount by department" to="/employees" linkLabel="View employees">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data.headcount}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis dataKey="name" fontSize={12} />
            <YAxis allowDecimals={false} fontSize={12} />
            <Tooltip />
            <Bar dataKey="value" name="Employees" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Attendance — last 14 days" to="/attendance-reports" linkLabel="Attendance reports">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data.attendance}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis dataKey="date" fontSize={12} />
            <YAxis allowDecimals={false} fontSize={12} />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="present" stroke="hsl(var(--success))" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="late" stroke="hsl(var(--warning))" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="absent" stroke="hsl(var(--destructive))" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Approved leave days by type" to="/leave" linkLabel="Leave">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data.leaveByType} dataKey="value" nameKey="name" outerRadius={90} label>
              {data.leaveByType.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Monthly salary cost" to="/salary" linkLabel="Salary entry">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data.salaryData}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis dataKey="name" fontSize={12} />
            <YAxis fontSize={12} />
            <Tooltip formatter={(v: number) => `₹${v.toLocaleString("en-IN")}`} />
            <Bar dataKey="amount" name="Amount" fill="hsl(var(--info))" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  );
}
