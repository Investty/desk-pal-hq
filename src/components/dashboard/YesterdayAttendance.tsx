import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { History } from "lucide-react";
import { format, subDays } from "date-fns";

export default function YesterdayAttendance() {
  const { data: rows } = useQuery({
    queryKey: ["yesterday-attendance"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_yesterday_attendance");
      if (error) throw error;
      return data || [];
    },
  });

  const statusVariant = (s: string) =>
    s === "present" ? ("default" as const) : s === "late" ? ("secondary" as const) : ("destructive" as const);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <History className="h-4 w-4" /> Yesterday's Attendance
          <span className="text-xs font-normal text-muted-foreground">
            {format(subDays(new Date(), 1), "EEE, MMM d")}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Employee</TableHead>
              <TableHead>Check In</TableHead>
              <TableHead>Check Out</TableHead>
              <TableHead>Hours</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows?.map((r, i) => (
              <TableRow key={`${r.full_name}-${i}`}>
                <TableCell className="font-medium">{r.full_name}</TableCell>
                <TableCell>{r.check_in ? format(new Date(r.check_in), "hh:mm a") : "—"}</TableCell>
                <TableCell>{r.check_out ? format(new Date(r.check_out), "hh:mm a") : "—"}</TableCell>
                <TableCell>{r.working_hours ?? "—"}</TableCell>
                <TableCell><Badge variant={statusVariant(r.status)} className="capitalize">{r.status}</Badge></TableCell>
              </TableRow>
            ))}
            {rows?.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-6">
                  No attendance recorded yesterday
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
