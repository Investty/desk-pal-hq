import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { format, startOfYear, subDays } from "date-fns";
import {
  ArrowRight, BriefcaseBusiness, CalendarCheck, CircleDollarSign, PieChart as PieIcon,
  TrendingUp, Users,
} from "lucide-react";
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { computeSalary, formatINR } from "@/lib/salary";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const CHART_COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--secondary))",
  "hsl(var(--success))",
  "hsl(var(--warning))",
  "hsl(var(--info))",
  "hsl(var(--destructive))",
];

type Period = "30" | "90" | "ytd";

function EmptyChart({ message }: { message: string }) {
  return (
    <div className="flex h-full min-h-56 flex-col items-center justify-center gap-2 text-center text-muted-foreground">
      <PieIcon className="h-8 w-8 opacity-40" />
      <p className="text-sm font-medium">{message}</p>
      <p className="max-w-xs text-xs">Records will appear here when they are available for the selected filters.</p>
    </div>
  );
}

function ChartCard({ title, subtitle, to, linkLabel, children }: {
  title: string;
  subtitle: string;
  to: string;
  linkLabel: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="min-w-0">
      <CardHeader className="flex flex-row items-start justify-between gap-4 pb-2">
        <div className="min-w-0">
          <CardTitle className="text-base">{title}</CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>
        </div>
        <Button asChild variant="link" size="sm" className="h-auto shrink-0 p-0">
          <Link to={to}>{linkLabel}<ArrowRight /></Link>
        </Button>
      </CardHeader>
      <CardContent className="h-80 pt-3">{children}</CardContent>
    </Card>
  );
}

function MetricCard({ label, value, detail, icon: Icon, accent }: {
  label: string;
  value: string;
  detail: string;
  icon: React.ElementType;
  accent: "primary" | "secondary" | "success" | "info";
}) {
  const accents = {
    primary: "bg-primary-50 text-primary border-primary-200",
    secondary: "bg-secondary-50 text-secondary border-secondary-200",
    success: "bg-success-light text-success-foreground border-success/20",
    info: "bg-info-light text-info-foreground border-info/20",
  };
  return (
    <Card>
      <CardContent className="flex items-start justify-between gap-4 p-5">
        <div className="min-w-0">
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
          <p className="mt-2 text-2xl font-bold text-foreground">{value}</p>
          <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
        </div>
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border ${accents[accent]}`}>
          <Icon className="h-5 w-5" />
        </div>
      </CardContent>
    </Card>
  );
}

export default function Reports() {
  const [period, setPeriod] = useState<Period>("30");
  const [department, setDepartment] = useState("all");
  const today = new Date();
  const since = period === "ytd"
    ? format(startOfYear(today), "yyyy-MM-dd")
    : format(subDays(today, Number(period) - 1), "yyyy-MM-dd");

  const { data, isLoading, isError } = useQuery({
    queryKey: ["reports-analytics", since],
    queryFn: async () => {
      const [profiles, departments, attendance, leaves, salaries] = await Promise.all([
        supabase.from("profiles").select("user_id, department_id, joining_date, is_active, status"),
        supabase.from("departments").select("id, name").order("name"),
        supabase.from("attendance").select("user_id, date, status, working_hours").gte("date", since),
        supabase.from("leave_requests").select("user_id, leave_type, status, start_date, end_date, day_portion").gte("end_date", since),
        supabase.from("salary_structures").select("user_id, basic, da, hra, special_allowance, pf_rate, professional_tax, tds"),
      ]);
      const error = profiles.error || departments.error || attendance.error || leaves.error || salaries.error;
      if (error) throw error;
      return {
        profiles: profiles.data || [],
        departments: departments.data || [],
        attendance: attendance.data || [],
        leaves: leaves.data || [],
        salaries: salaries.data || [],
      };
    },
  });

  const analytics = useMemo(() => {
    const departments = data?.departments || [];
    const profiles = data?.profiles || [];
    const selectedProfiles = profiles.filter((profile) => department === "all" || profile.department_id === department);
    const selectedUsers = new Set(selectedProfiles.map((profile) => profile.user_id));
    const activeProfiles = selectedProfiles.filter((profile) => profile.is_active && profile.status === "active");
    const departmentNames = new Map(departments.map((item) => [item.id, item.name]));

    const headcountMap = activeProfiles.reduce<Record<string, { id: string; name: string; employees: number }>>((acc, profile) => {
      const id = profile.department_id || "unassigned";
      const name = profile.department_id ? departmentNames.get(profile.department_id) || "Unassigned" : "Unassigned";
      acc[id] = acc[id] || { id, name, employees: 0 };
      acc[id].employees += 1;
      return acc;
    }, {});
    const headcount = Object.values(headcountMap).sort((a, b) => b.employees - a.employees);

    const selectedAttendance = (data?.attendance || []).filter((row) => selectedUsers.has(row.user_id));
    const attendanceMap: Record<string, { date: string; present: number; late: number; absent: number }> = {};
    selectedAttendance.forEach((row) => {
      attendanceMap[row.date] = attendanceMap[row.date] || { date: row.date, present: 0, late: 0, absent: 0 };
      if (row.status === "present" || row.status === "late" || row.status === "absent") attendanceMap[row.date][row.status] += 1;
    });
    const attendanceTrend = Object.values(attendanceMap).sort((a, b) => a.date.localeCompare(b.date));
    const attended = selectedAttendance.filter((row) => row.status === "present" || row.status === "late").length;
    const attendanceRate = selectedAttendance.length ? (attended / selectedAttendance.length) * 100 : 0;

    const selectedLeaves = (data?.leaves || []).filter((row) => selectedUsers.has(row.user_id) && row.status === "approved");
    const leaveMap = selectedLeaves.reduce<Record<string, number>>((acc, row) => {
      const calendarDays = Math.max(1, Math.round((new Date(row.end_date).getTime() - new Date(row.start_date).getTime()) / 86400000) + 1);
      const days = row.day_portion === "full_day" ? calendarDays : 0.5;
      acc[row.leave_type] = (acc[row.leave_type] || 0) + days;
      return acc;
    }, {});
    const leaveDistribution = Object.entries(leaveMap).map(([name, value]) => ({
      name: name.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase()),
      value,
    })).sort((a, b) => b.value - a.value);
    const approvedLeaveDays = leaveDistribution.reduce((sum, item) => sum + item.value, 0);

    const salaryRows = (data?.salaries || []).filter((row) => selectedUsers.has(row.user_id));
    const payroll = salaryRows.reduce((totals, row) => {
      const computed = computeSalary(row);
      totals.gross += computed.gross;
      totals.deductions += computed.deductions;
      totals.net += computed.net;
      return totals;
    }, { gross: 0, deductions: 0, net: 0 });
    const payrollData = [
      { name: "Gross", amount: Math.round(payroll.gross) },
      { name: "Deductions", amount: Math.round(payroll.deductions) },
      { name: "Net payout", amount: Math.round(payroll.net) },
    ];

    return { activeProfiles, headcount, attendanceTrend, selectedAttendance, attendanceRate, leaveDistribution, approvedLeaveDays, salaryRows, payroll, payrollData };
  }, [data, department]);

  const periodLabel = period === "ytd" ? "Year to date" : `Last ${period} days`;

  if (isLoading) {
    return <div className="space-y-6"><Skeleton className="h-20 w-full" /><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[0, 1, 2, 3].map((item) => <Skeleton key={item} className="h-32" />)}</div><div className="grid gap-6 lg:grid-cols-2"><Skeleton className="h-96" /><Skeleton className="h-96" /></div></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="flex items-center gap-2"><PieIcon className="h-7 w-7 text-primary" />Reports & Analytics</h1>
          <p className="mt-1 text-muted-foreground">Workforce, attendance, leave, and payroll signals in one view</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:w-[28rem]">
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">Reporting period</label>
            <Select value={period} onValueChange={(value) => setPeriod(value as Period)}>
              <SelectTrigger aria-label="Reporting period"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="30">Last 30 days</SelectItem><SelectItem value="90">Last 90 days</SelectItem><SelectItem value="ytd">Year to date</SelectItem></SelectContent>
            </Select>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">Department</label>
            <Select value={department} onValueChange={setDepartment}>
              <SelectTrigger aria-label="Department"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="all">All departments</SelectItem>{data?.departments.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {isError && <div className="rounded-lg border border-destructive/20 bg-danger-light p-4 text-sm text-destructive">Some reporting data could not be loaded. Try refreshing the page.</div>}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Active headcount" value={analytics.activeProfiles.length.toLocaleString()} detail={department === "all" ? "Across all departments" : "In selected department"} icon={Users} accent="primary" />
        <MetricCard label="Attendance rate" value={`${analytics.attendanceRate.toFixed(1)}%`} detail={`${analytics.selectedAttendance.length.toLocaleString()} attendance records · ${periodLabel}`} icon={CalendarCheck} accent="success" />
        <MetricCard label="Approved leave" value={`${analytics.approvedLeaveDays.toLocaleString()} days`} detail={`Approved requests · ${periodLabel}`} icon={TrendingUp} accent="secondary" />
        <MetricCard label="Monthly net payroll" value={formatINR(analytics.payroll.net)} detail={`${analytics.salaryRows.length.toLocaleString()} salary structures`} icon={CircleDollarSign} accent="info" />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <ChartCard title="Headcount by department" subtitle="Active employees in the current workforce" to="/employees" linkLabel="View people">
          {analytics.headcount.length === 0 ? <EmptyChart message="No active employees found" /> : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analytics.headcount} layout="vertical" margin={{ left: 8, right: 18 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} className="stroke-border" />
                <XAxis type="number" allowDecimals={false} fontSize={12} />
                <YAxis type="category" dataKey="name" width={105} fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip formatter={(value: number) => [value, "Employees"]} cursor={{ fill: "hsl(var(--muted))" }} />
                <Bar dataKey="employees" name="Employees" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Approved leave by type" subtitle={`Days approved · ${periodLabel}`} to="/leave" linkLabel="View leave">
          {analytics.leaveDistribution.length === 0 ? <EmptyChart message="No approved leave in this period" /> : (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={analytics.leaveDistribution} dataKey="value" nameKey="name" innerRadius={55} outerRadius={88} paddingAngle={2}>
                  {analytics.leaveDistribution.map((item, index) => <Cell key={item.name} fill={CHART_COLORS[index % CHART_COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(value: number) => [`${value} days`, "Approved"]} />
                <Legend verticalAlign="bottom" iconType="circle" wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Attendance trend" subtitle={`Daily status movement · ${periodLabel}`} to={`/attendance-reports?from=${since}`} linkLabel="View report">
          {analytics.attendanceTrend.length === 0 ? <EmptyChart message="No attendance records in this period" /> : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={analytics.attendanceTrend} margin={{ left: -16, right: 12 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="date" fontSize={11} minTickGap={28} tickFormatter={(value) => format(new Date(`${value}T00:00:00`), "MMM d")} />
                <YAxis allowDecimals={false} fontSize={12} />
                <Tooltip labelFormatter={(value) => format(new Date(`${value}T00:00:00`), "MMM d, yyyy")} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="present" name="Present" stroke="hsl(var(--success))" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                <Line type="monotone" dataKey="late" name="Late" stroke="hsl(var(--warning))" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                <Line type="monotone" dataKey="absent" name="Absent" stroke="hsl(var(--destructive))" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Monthly payroll composition" subtitle="Estimated from current salary structures" to="/payroll" linkLabel="View payroll">
          {analytics.salaryRows.length === 0 ? <EmptyChart message="No salary structures available" /> : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analytics.payrollData} margin={{ left: 8, right: 12 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border" />
                <XAxis dataKey="name" fontSize={12} />
                <YAxis fontSize={11} tickFormatter={(value) => `₹${Math.round(Number(value) / 1000)}k`} />
                <Tooltip formatter={(value: number) => [formatINR(value), "Amount"]} cursor={{ fill: "hsl(var(--muted))" }} />
                <Bar dataKey="amount" name="Amount" radius={[4, 4, 0, 0]}>
                  {analytics.payrollData.map((item, index) => <Cell key={item.name} fill={["hsl(var(--primary))", "hsl(var(--warning))", "hsl(var(--info))"][index]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>

      <Card>
        <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-secondary-200 bg-secondary-50 text-secondary"><BriefcaseBusiness className="h-5 w-5" /></div>
            <div><p className="font-semibold">Need the underlying records?</p><p className="text-sm text-muted-foreground">Open detailed attendance reports or payroll records for review and export.</p></div>
          </div>
          <div className="flex flex-wrap gap-2"><Button asChild variant="outline" size="sm"><Link to="/attendance-reports">Attendance details</Link></Button><Button asChild size="sm"><Link to="/payroll">Payroll details</Link></Button></div>
        </CardContent>
      </Card>
    </div>
  );
}