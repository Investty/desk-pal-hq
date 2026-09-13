import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Input } from "@/components/ui/input";
import { ListPager } from "@/components/ui/list-pager";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { Users, Clock, CalendarDays, CheckSquare } from "lucide-react";
import AttendanceApprovals from "@/components/attendance/AttendanceApprovals";

const today = () => format(new Date(), "yyyy-MM-dd");

export default function Team() {
  const { profile } = useAuth();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);

  const { data: team } = useQuery({
    queryKey: ["team-members", profile?.id],
    enabled: !!profile?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, user_id, full_name, employee_id, designation, is_active")
        .eq("manager_id", profile!.id)
        .order("full_name");
      return data || [];
    },
  });

  const userIds = (team || []).map((m) => m.user_id);

  const { data: attendance } = useQuery({
    queryKey: ["team-attendance", userIds.join(",")],
    enabled: userIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from("attendance")
        .select("*")
        .eq("date", today())
        .in("user_id", userIds);
      return data || [];
    },
  });

  const { data: leaves } = useQuery({
    queryKey: ["team-leaves", userIds.join(",")],
    enabled: userIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from("leave_requests")
        .select("*")
        .in("user_id", userIds)
        .order("start_date", { ascending: false })
        .limit(100);
      return data || [];
    },
  });

  const byUser = new Map((attendance || []).map((a) => [a.user_id, a]));
  const t = today();
  const onLeaveToday = new Map(
    (leaves || [])
      .filter((l) => l.status === "approved" && l.start_date <= t && l.end_date >= t)
      .map((l) => [l.user_id, l])
  );
  const pendingLeave = (leaves || []).filter((l) => l.status === "pending" && l.manager_status === "pending");
  const upcoming = (leaves || []).filter((l) => l.status === "approved" && l.end_date >= t);

  const presentCount = (team || []).filter((m) => byUser.get(m.user_id)?.check_in).length;

  const TEAM_PAGE_SIZE = 15;
  const filteredTeam = (team || []).filter(
    (m) =>
      m.full_name.toLowerCase().includes(search.toLowerCase()) ||
      (m.employee_id || "").toLowerCase().includes(search.toLowerCase())
  );
  const pagedTeam = filteredTeam.slice(page * TEAM_PAGE_SIZE, page * TEAM_PAGE_SIZE + TEAM_PAGE_SIZE);

  const stat = (label: string, value: string | number, Icon: typeof Users) => (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
          <Icon className="h-4 w-4" /> {label}
        </CardTitle>
      </CardHeader>
      <CardContent><div className="text-2xl font-bold">{value}</div></CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Users className="h-6 w-6" /> My Team</h1>
          <p className="text-muted-foreground">Everything about your reportees in one place</p>
        </div>
        <Button asChild variant="outline"><Link to="/approvals">Open Approvals</Link></Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        {stat("Team size", team?.length ?? 0, Users)}
        {stat("Present today", presentCount, Clock)}
        {stat("On leave today", onLeaveToday.size, CalendarDays)}
        {stat("Pending approvals", pendingLeave.length, CheckSquare)}
      </div>

      <Card>
        <CardHeader><CardTitle>Today at a glance</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Designation</TableHead>
                <TableHead>Check In</TableHead>
                <TableHead>Check Out</TableHead>
                <TableHead>Hours</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(team || []).map((m) => {
                const a = byUser.get(m.user_id);
                const leave = onLeaveToday.get(m.user_id);
                return (
                  <TableRow key={m.id}>
                    <TableCell>
                      <p className="font-medium">{m.full_name}</p>
                      <p className="text-xs text-muted-foreground">{m.employee_id}</p>
                    </TableCell>
                    <TableCell>{m.designation || "—"}</TableCell>
                    <TableCell>{a?.check_in ? format(new Date(a.check_in), "hh:mm a") : "—"}</TableCell>
                    <TableCell>{a?.check_out ? format(new Date(a.check_out), "hh:mm a") : "—"}</TableCell>
                    <TableCell>{a?.working_hours ?? "—"}</TableCell>
                    <TableCell>
                      {leave ? (
                        <Badge variant="secondary" className="capitalize">
                          On {leave.leave_type} leave{leave.day_portion !== "full_day" ? " (half day)" : ""}
                        </Badge>
                      ) : a ? (
                        <Badge variant={a.status === "late" ? "secondary" : "default"}>{a.status}</Badge>
                      ) : (
                        <Badge variant="outline">Not marked</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
              {(team || []).length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Nobody reports to you yet</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Leave requests waiting on you</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>From</TableHead>
                <TableHead>To</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pendingLeave.map((l) => {
                const person = (team || []).find((m) => m.user_id === l.user_id);
                return (
                  <TableRow key={l.id}>
                    <TableCell>{person?.full_name || "—"}</TableCell>
                    <TableCell className="capitalize">{l.leave_type}</TableCell>
                    <TableCell>{format(new Date(l.start_date), "MMM d")}</TableCell>
                    <TableCell>{format(new Date(l.end_date), "MMM d")}</TableCell>
                    <TableCell>{l.day_portion === "full_day" ? "Full day" : "Half day"}</TableCell>
                    <TableCell className="text-right">
                      <Button asChild size="sm" variant="outline"><Link to="/approvals">Review</Link></Button>
                    </TableCell>
                  </TableRow>
                );
              })}
              {pendingLeave.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Nothing pending</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Upcoming & current approved leave</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>From</TableHead>
                <TableHead>To</TableHead>
                <TableHead>Duration</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {upcoming.map((l) => {
                const person = (team || []).find((m) => m.user_id === l.user_id);
                return (
                  <TableRow key={l.id}>
                    <TableCell>{person?.full_name || "—"}</TableCell>
                    <TableCell className="capitalize">{l.leave_type}</TableCell>
                    <TableCell>{format(new Date(l.start_date), "MMM d, yyyy")}</TableCell>
                    <TableCell>{format(new Date(l.end_date), "MMM d, yyyy")}</TableCell>
                    <TableCell>{l.day_portion === "full_day" ? "Full day" : "Half day"}</TableCell>
                  </TableRow>
                );
              })}
              {upcoming.length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No upcoming leave</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <AttendanceApprovals />
    </div>
  );
}
