import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart as PieIcon } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, LineChart, Line,
} from "recharts";
import { format, subDays } from "date-fns";

const COLORS = ["hsl(221, 83%, 53%)", "hsl(142, 71%, 45%)", "hsl(38, 92%, 50%)", "hsl(0, 72%, 51%)", "hsl(262, 60%, 55%)", "hsl(190, 80%, 42%)"];

export default function Reports() {
  const { data } = useQuery({
    queryKey: ["reports-analytics"],
    queryFn: async () => {
      const since = format(subDays(new Date(), 30), "yyyy-MM-dd");
      const [profiles, departments, attendance, leaves] = await Promise.all([
        supabase.from("profiles").select("id, department_id, joining_date, is_active"),
        supabase.from("departments").select("id, name"),
        supabase.from("attendance").select("date, status").gte("date", since),
        supabase.from("leave_requests").select("leave_type, status"),
      ]);

      const deptName = (id: string | null) => departments.data?.find((d) => d.id === id)?.name || "Unassigned";
      const headcountMap: Record<string, number> = {};
      (profiles.data || []).filter((p) => p.is_active).forEach((p) => {
        const n = deptName(p.department_id);
        headcountMap[n] = (headcountMap[n] || 0) + 1;
      });
      const headcount = Object.entries(headcountMap).map(([name, count]) => ({ name, count }));

      const attMap: Record<string, { date: string; present: number; late: number; absent: number }> = {};
      (attendance.data || []).forEach((a) => {
        attMap[a.date] = attMap[a.date] || { date: a.date, present: 0, late: 0, absent: 0 };
        attMap[a.date][a.status as "present" | "late" | "absent"]++;
      });
      const attendanceTrend = Object.values(attMap).sort((a, b) => a.date.localeCompare(b.date));

      const leaveMap: Record<string, number> = {};
      (leaves.data || []).forEach((l) => {
        leaveMap[l.leave_type] = (leaveMap[l.leave_type] || 0) + 1;
      });
      const leaveDist = Object.entries(leaveMap).map(([name, value]) => ({ name, value }));

      const active = (profiles.data || []).filter((p) => p.is_active).length;
      const inactive = (profiles.data || []).length - active;

      return { headcount, attendanceTrend, leaveDist, active, inactive, totalLeaves: leaves.data?.length || 0 };
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><PieIcon className="h-6 w-6" /> Reports & Analytics</h1>
        <p className="text-muted-foreground">Workforce insights across the organization</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Active Employees</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{data?.active ?? 0}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Inactive / Exited</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{data?.inactive ?? 0}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Total Leave Requests</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{data?.totalLeaves ?? 0}</div></CardContent></Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="text-base">Headcount by Department</CardTitle></CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data?.headcount || []}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="name" fontSize={12} />
                <YAxis allowDecimals={false} fontSize={12} />
                <Tooltip />
                <Bar dataKey="count" fill={COLORS[0]} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Leave Requests by Type</CardTitle></CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={data?.leaveDist || []} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label>
                  {(data?.leaveDist || []).map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader><CardTitle className="text-base">Attendance Trend (Last 30 Days)</CardTitle></CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data?.attendanceTrend || []}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="date" fontSize={11} tickFormatter={(d) => format(new Date(d), "MMM d")} />
                <YAxis allowDecimals={false} fontSize={12} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="present" stroke={COLORS[1]} strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="late" stroke={COLORS[2]} strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="absent" stroke={COLORS[3]} strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
