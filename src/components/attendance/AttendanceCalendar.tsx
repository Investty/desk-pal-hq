import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import { format } from "date-fns";

const iso = (y: number, m: number, d: number) =>
  `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

export default function AttendanceCalendar() {
  const { company, user } = useAuth();
  const today = new Date();
  const [cursor, setCursor] = useState(new Date(today.getFullYear(), today.getMonth(), 1));

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const monthStart = iso(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthEnd = iso(year, month, daysInMonth);

  const weeklyOffs: number[] = (company as unknown as { weekly_offs?: number[] })?.weekly_offs ?? [0, 6];

  const { data: records } = useQuery({
    queryKey: ["attendance-calendar", user?.id, monthStart],
    enabled: !!user?.id,
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from("attendance")
        .select("date, check_in, check_out, working_hours, status")
        .eq("user_id", user.id)
        .gte("date", monthStart)
        .lte("date", monthEnd);
      if (error) throw error;
      return data || [];
    },
  });

  const { data: holidays } = useQuery({
    queryKey: ["attendance-calendar-holidays", monthStart],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("holidays")
        .select("name, date")
        .gte("date", monthStart)
        .lte("date", monthEnd);
      if (error) throw error;
      return data || [];
    },
  });

  const byDate = useMemo(() => {
    const map = new Map<string, { status: string; check_in: string | null; check_out: string | null; working_hours: number | null }>();
    for (const r of records || []) map.set(r.date, r);
    return map;
  }, [records]);

  const holidayByDate = useMemo(() => {
    const map = new Map<string, string>();
    for (const h of holidays || []) map.set(h.date, h.name);
    return map;
  }, [holidays]);

  const todayKey = format(today, "yyyy-MM-dd");

  const cellFor = (key: string, weekday: number) => {
    const rec = byDate.get(key);
    const holiday = holidayByDate.get(key);
    const isFuture = key > todayKey;

    if (rec && rec.check_in && rec.check_out) {
      return {
        cls: rec.status === "late"
          ? "bg-warning/20 text-warning-foreground font-semibold"
          : "bg-success/20 text-success-foreground font-semibold",
        note: `${rec.status === "late" ? "Late" : "Present"} · ${rec.working_hours ?? 0}h`,
      };
    }
    if (rec && rec.check_in && !rec.check_out) {
      return { cls: "bg-info/20 text-info-foreground font-medium", note: "Checked in — not checked out" };
    }
    if (holiday) return { cls: "bg-destructive/15 text-destructive font-medium", note: holiday };
    if (weeklyOffs.includes(weekday)) return { cls: "text-muted-foreground/50", note: "Weekly off" };
    if (isFuture) return { cls: "text-muted-foreground", note: "" };
    if (rec && rec.status === "absent") return { cls: "bg-destructive/80 text-destructive-foreground font-semibold", note: "Absent" };
    return { cls: "bg-destructive/80 text-destructive-foreground font-semibold", note: "Absent" };
  };

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 space-y-0">
        <CardTitle className="flex items-center gap-2">
          <CalendarDays className="h-5 w-5" /> {format(cursor, "MMMM yyyy")}
        </CardTitle>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" onClick={() => setCursor(new Date(year, month - 1, 1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={() => setCursor(new Date(year, month + 1, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-4 text-xs text-muted-foreground mb-4">
          <span className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-success/40 inline-block" /> Full shift</span>
          <span className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-warning/40 inline-block" /> Late</span>
          <span className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-info/40 inline-block" /> Not checked out</span>
          <span className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-destructive/80 inline-block" /> Absent</span>
          <span className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-destructive/30 inline-block" /> Holiday</span>
          <span className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-muted inline-block" /> Weekly off</span>
        </div>

        <TooltipProvider delayDuration={100}>
          <div className="max-w-sm">
            <div className="grid grid-cols-7 gap-1 text-[11px] text-muted-foreground mb-1">
              {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
                <span key={i} className="text-center">{d}</span>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: new Date(year, month, 1).getDay() }).map((_, i) => <span key={`p${i}`} />)}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const day = i + 1;
                const key = iso(year, month, day);
                const weekday = new Date(year, month, day).getDay();
                const { cls, note } = cellFor(key, weekday);
                return (
                  <Tooltip key={key}>
                    <TooltipTrigger asChild>
                      <span
                        className={`h-9 w-9 flex items-center justify-center rounded-md text-xs ${cls} ${key === todayKey ? "ring-2 ring-primary" : ""}`}
                      >
                        {day}
                      </span>
                    </TooltipTrigger>
                    {note && (
                      <TooltipContent>
                        <p className="text-xs">{format(new Date(key + "T00:00:00"), "MMM d")} — {note}</p>
                      </TooltipContent>
                    )}
                  </Tooltip>
                );
              })}
            </div>
          </div>
        </TooltipProvider>
      </CardContent>
    </Card>
  );
}
