import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ChevronLeft, ChevronRight, CalendarRange } from "lucide-react";
import { format } from "date-fns";

type Scope = "mine" | "company";

interface CalendarRow {
  kind: string;
  label: string;
  start_date: string;
  end_date: string;
  day_portion: string | null;
  is_self: boolean;
}

const monthNames = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const iso = (y: number, m: number, d: number) =>
  `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

export default function LeaveCalendar() {
  const { company } = useAuth();
  const [year, setYear] = useState(new Date().getFullYear());
  const [scope, setScope] = useState<Scope>("mine");

  const weeklyOffs: number[] = (company as unknown as { weekly_offs?: number[] })?.weekly_offs ?? [0, 6];

  const { data: rows } = useQuery({
    queryKey: ["leave-calendar", year],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_leave_calendar", {
        _from: `${year}-01-01`,
        _to: `${year}-12-31`,
      });
      if (error) throw error;
      return (data || []) as CalendarRow[];
    },
  });

  const byDate = useMemo(() => {
    const map = new Map<string, CalendarRow[]>();
    for (const r of rows || []) {
      if (r.kind === "leave" && scope === "mine" && !r.is_self) continue;
      const start = new Date(r.start_date + "T00:00:00");
      const end = new Date(r.end_date + "T00:00:00");
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const key = format(d, "yyyy-MM-dd");
        map.set(key, [...(map.get(key) || []), r]);
      }
    }
    return map;
  }, [rows, scope]);

  const dayClass = (key: string, weekday: number) => {
    const entries = byDate.get(key) || [];
    const holiday = entries.some((e) => e.kind === "holiday");
    const mine = entries.some((e) => e.kind === "leave" && e.is_self);
    const other = entries.some((e) => e.kind === "leave" && !e.is_self);
    if (mine) return "bg-primary text-primary-foreground font-semibold";
    if (holiday) return "bg-destructive/15 text-destructive font-medium";
    if (other) return "bg-secondary text-secondary-foreground";
    if (weeklyOffs.includes(weekday)) return "text-muted-foreground/50";
    return "text-foreground";
  };

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 space-y-0">
        <CardTitle className="flex items-center gap-2">
          <CalendarRange className="h-5 w-5" /> Leave calendar {year}
        </CardTitle>
        <div className="flex items-center gap-3">
          <Tabs value={scope} onValueChange={(v) => setScope(v as Scope)}>
            <TabsList>
              <TabsTrigger value="mine">My leave</TabsTrigger>
              <TabsTrigger value="company">Company</TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" onClick={() => setYear((y) => y - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" onClick={() => setYear((y) => y + 1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-4 text-xs text-muted-foreground mb-4">
          <span className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-primary inline-block" /> My leave</span>
          <span className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-secondary inline-block" /> Colleague on leave</span>
          <span className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-destructive/30 inline-block" /> Holiday</span>
          <span className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-muted inline-block" /> Weekly off</span>
        </div>

        <TooltipProvider delayDuration={100}>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {monthNames.map((month, mi) => {
              const first = new Date(year, mi, 1);
              const days = new Date(year, mi + 1, 0).getDate();
              const pad = first.getDay();
              return (
                <div key={month} className="rounded-lg border p-3">
                  <p className="text-sm font-semibold mb-2">{month}</p>
                  <div className="grid grid-cols-7 gap-1 text-[10px] text-muted-foreground mb-1">
                    {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
                      <span key={i} className="text-center">{d}</span>
                    ))}
                  </div>
                  <div className="grid grid-cols-7 gap-1">
                    {Array.from({ length: pad }).map((_, i) => <span key={`p${i}`} />)}
                    {Array.from({ length: days }).map((_, i) => {
                      const day = i + 1;
                      const key = iso(year, mi, day);
                      const weekday = new Date(year, mi, day).getDay();
                      const entries = byDate.get(key) || [];
                      return (
                        <Tooltip key={key}>
                          <TooltipTrigger asChild>
                            <span
                              className={`h-6 w-6 flex items-center justify-center rounded text-[11px] ${dayClass(key, weekday)}`}
                            >
                              {day}
                            </span>
                          </TooltipTrigger>
                          {entries.length > 0 && (
                            <TooltipContent>
                              <div className="space-y-1">
                                {entries.map((e, idx) => (
                                  <p key={idx} className="text-xs capitalize">
                                    {e.label}
                                    {e.kind === "leave" && e.day_portion && e.day_portion !== "full_day" ? " (half day)" : ""}
                                  </p>
                                ))}
                              </div>
                            </TooltipContent>
                          )}
                        </Tooltip>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </TooltipProvider>
      </CardContent>
    </Card>
  );
}
