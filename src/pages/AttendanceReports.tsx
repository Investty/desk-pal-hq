import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BarChart3, Download } from "lucide-react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isWeekend } from "date-fns";

export default function AttendanceReports() {
  const [month, setMonth] = useState(format(new Date(), "yyyy-MM"));
  const monthStart = startOfMonth(new Date(month + "-01"));
  const monthEnd = endOfMonth(monthStart);
  const today = new Date();
  const effectiveEnd = monthEnd > today ? today : monthEnd;
  const workingDays = eachDayOfInterval({ start: monthStart, end: effectiveEnd }).filter((d) => !isWeekend(d)).length;

  const { data: report, isLoading } = useQuery({
    queryKey: ["attendance-report", month],
    queryFn: async () => {
      const { data: profiles } = await supabase.from("profiles").select("user_id, full_name, employee_id").eq("is_active", true).order("full_name");
      const { data: attendance } = await supabase
        .from("attendance")
        .select("user_id, date, status, working_hours")
        .gte("date", format(monthStart, "yyyy-MM-dd"))
        .lte("date", format(effectiveEnd, "yyyy-MM-dd"));
      return (profiles || []).map((p) => {
        const records = (attendance || []).filter((a) => a.user_id === p.user_id);
        const present = records.filter((r) => r.status === "present").length;
        const late = records.filter((r) => r.status === "late").length;
        const absent = records.filter((r) => r.status === "absent").length;
        const hours = records.reduce((s, r) => s + (Number(r.working_hours) || 0), 0);
        return { ...p, present, late, absent, notMarked: Math.max(0, workingDays - records.length), hours: hours.toFixed(1) };
      });
    },
  });

  const exportCsv = () => {
    if (!report) return;
    const header = "Employee ID,Name,Present,Late,Absent,Not Marked,Working Hours";
    const rows = report.map((r) => [r.employee_id, `"${r.full_name}"`, r.present, r.late, r.absent, r.notMarked, r.hours].join(","));
    const blob = new Blob([[header, ...rows].join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `attendance-report-${month}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><BarChart3 className="h-6 w-6" /> Attendance Reports</h1>
          <p className="text-muted-foreground">Monthly attendance summary · {workingDays} working days so far</p>
        </div>
        <div className="flex items-end gap-3">
          <div className="space-y-1">
            <Label>Month</Label>
            <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
          </div>
          <Button variant="outline" onClick={exportCsv} disabled={!report?.length}>
            <Download className="h-4 w-4 mr-2" /> Export CSV
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead className="text-center">Present</TableHead>
                <TableHead className="text-center">Late</TableHead>
                <TableHead className="text-center">Absent</TableHead>
                <TableHead className="text-center">Not Marked</TableHead>
                <TableHead className="text-right">Hours</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {report?.map((r) => (
                <TableRow key={r.user_id}>
                  <TableCell className="font-medium">{r.full_name} <span className="text-xs text-muted-foreground">({r.employee_id})</span></TableCell>
                  <TableCell className="text-center text-success">{r.present}</TableCell>
                  <TableCell className="text-center text-warning">{r.late}</TableCell>
                  <TableCell className="text-center text-destructive">{r.absent}</TableCell>
                  <TableCell className="text-center text-muted-foreground">{r.notMarked}</TableCell>
                  <TableCell className="text-right">{r.hours}</TableCell>
                </TableRow>
              ))}
              {!isLoading && report?.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No data available</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
