import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Clock, CalendarDays, CheckSquare, TrendingUp, AlertCircle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

function StatCard({ title, value, icon: Icon, description, variant = "default" }: {
  title: string; value: string | number; icon: React.ElementType; description?: string;
  variant?: "default" | "success" | "warning" | "info";
}) {
  const colors = {
    default: "text-primary",
    success: "text-success",
    warning: "text-warning",
    info: "text-info",
  };
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className={`h-5 w-5 ${colors[variant]}`} />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {description && <p className="text-xs text-muted-foreground mt-1">{description}</p>}
      </CardContent>
    </Card>
  );
}

export default function Dashboard() {
  const { isAdmin, isManager, profile } = useAuth();
  const today = format(new Date(), "yyyy-MM-dd");

  const { data: stats } = useQuery({
    queryKey: ["dashboard-stats", isAdmin],
    queryFn: async () => {
      if (isAdmin || isManager) {
        const [employees, todayAttendance, pendingLeaves] = await Promise.all([
          supabase.from("profiles").select("id", { count: "exact", head: true }).eq("is_active", true),
          supabase.from("attendance").select("id", { count: "exact", head: true }).eq("date", today),
          supabase.from("leave_requests").select("id", { count: "exact", head: true }).eq("status", "pending"),
        ]);
        return {
          totalEmployees: employees.count || 0,
          todayAttendance: todayAttendance.count || 0,
          pendingLeaves: pendingLeaves.count || 0,
        };
      }
      return null;
    },
    enabled: isAdmin || isManager,
  });

  const { data: myLeaveBalances } = useQuery({
    queryKey: ["my-leave-balances"],
    queryFn: async () => {
      const { data } = await supabase.from("leave_balances").select("*");
      return data || [];
    },
  });

  const { data: myTodayAttendance } = useQuery({
    queryKey: ["my-today-attendance", today],
    queryFn: async () => {
      const { data } = await supabase.from("attendance").select("*").eq("date", today).maybeSingle();
      return data;
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Welcome back, {profile?.full_name?.split(" ")[0]}</h1>
        <p className="text-muted-foreground">{format(new Date(), "EEEE, MMMM d, yyyy")}</p>
      </div>

      {(isAdmin || isManager) && stats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <StatCard title="Total Employees" value={stats.totalEmployees} icon={Users} variant="info" />
          <StatCard title="Today's Attendance" value={stats.todayAttendance} icon={Clock} variant="success" />
          <StatCard title="Pending Approvals" value={stats.pendingLeaves} icon={AlertCircle} variant="warning" />
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard
          title="Today's Status"
          value={myTodayAttendance?.check_in ? (myTodayAttendance.check_out ? "Completed" : "Checked In") : "Not Checked In"}
          icon={Clock}
          description={myTodayAttendance?.check_in ? `Since ${format(new Date(myTodayAttendance.check_in), "hh:mm a")}` : "Mark your attendance"}
          variant={myTodayAttendance?.check_in ? "success" : "default"}
        />
        {myLeaveBalances?.map((bal) => (
          <StatCard
            key={bal.id}
            title={`${bal.leave_type.charAt(0).toUpperCase() + bal.leave_type.slice(1)} Leave`}
            value={`${bal.remaining_days}/${bal.total_days}`}
            icon={CalendarDays}
            description="Days remaining"
          />
        ))}
      </div>
    </div>
  );
}
