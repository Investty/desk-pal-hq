import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Clock, CalendarDays, AlertCircle, CalendarOff, Megaphone } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import Highlights from "@/components/dashboard/Highlights";
import OnLeaveToday from "@/components/dashboard/OnLeaveToday";
import YesterdayAttendance from "@/components/dashboard/YesterdayAttendance";
import { Link } from "react-router-dom";

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

  const { data: upcomingHolidays } = useQuery({
    queryKey: ["dashboard-holidays", today],
    queryFn: async () => {
      const { data } = await supabase.from("holidays").select("*").gte("date", today).order("date").limit(4);
      return data || [];
    },
  });

  const { data: latestAnnouncements } = useQuery({
    queryKey: ["dashboard-announcements"],
    queryFn: async () => {
      const { data } = await supabase.from("announcements").select("*").order("created_at", { ascending: false }).limit(3);
      return data || [];
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <OnLeaveToday />
        <YesterdayAttendance />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base flex items-center gap-2"><CalendarOff className="h-4 w-4" /> Upcoming Holidays</CardTitle>
            <Link to="/holidays" className="text-xs text-primary hover:underline">View all</Link>
          </CardHeader>
          <CardContent className="space-y-3">
            {upcomingHolidays?.map((h) => (
              <div key={h.id} className="flex items-center justify-between text-sm">
                <span>{h.name}</span>
                <span className="text-muted-foreground">{format(new Date(h.date), "EEE, MMM d")}</span>
              </div>
            ))}
            {upcomingHolidays?.length === 0 && <p className="text-sm text-muted-foreground">No upcoming holidays</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base flex items-center gap-2"><Megaphone className="h-4 w-4" /> Announcements</CardTitle>
            <Link to="/announcements" className="text-xs text-primary hover:underline">View all</Link>
          </CardHeader>
          <CardContent className="space-y-3">
            {latestAnnouncements?.map((a) => (
              <div key={a.id} className="text-sm">
                <p className="font-medium">{a.title}</p>
                <p className="text-muted-foreground line-clamp-1">{a.body}</p>
              </div>
            ))}
            {latestAnnouncements?.length === 0 && <p className="text-sm text-muted-foreground">No announcements yet</p>}
          </CardContent>
        </Card>
      </div>

      <Highlights />
    </div>
  );
}
