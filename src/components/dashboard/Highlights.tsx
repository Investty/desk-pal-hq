import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Cake, PartyPopper, Sparkles, Gift, Pencil } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface Celebration {
  full_name: string;
  date_of_birth: string | null;
  joining_date: string;
}

interface HighlightItem {
  name: string;
  kind: "birthday" | "anniversary";
  date: Date;
  label: string;
  isToday: boolean;
  years?: number;
}

function nextOccurrence(monthDay: string, today: Date): Date {
  const [, m, d] = monthDay.split("-").map(Number);
  const year = today.getFullYear();
  let occ = new Date(year, m - 1, d);
  // handle Feb 29 birthdays on non-leap years → celebrate Feb 28
  if (m === 2 && d === 29 && occ.getMonth() !== 1) occ = new Date(year, 1, 28);
  if (occ < new Date(year, today.getMonth(), today.getDate())) {
    occ = new Date(year + 1, m - 1, d);
    if (m === 2 && d === 29 && occ.getMonth() !== 1) occ = new Date(year + 1, 1, 28);
  }
  return occ;
}

function yearsBetween(from: string, to: Date): number {
  return to.getFullYear() - new Date(from).getFullYear();
}

export default function Highlights() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const [dobOpen, setDobOpen] = useState(false);
  const [dob, setDob] = useState("");

  const { data: celebrations } = useQuery({
    queryKey: ["celebrations"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_celebrations");
      if (error) throw error;
      return (data || []) as Celebration[];
    },
  });

  const saveDob = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("profiles")
        .update({ date_of_birth: dob || null })
        .eq("user_id", profile!.user_id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Birthday saved");
      setDobOpen(false);
      queryClient.invalidateQueries({ queryKey: ["celebrations"] });
    },
    onError: () => toast.error("Could not save birthday"),
  });

  const today = new Date();
  const items: HighlightItem[] = [];

  celebrations?.forEach((c) => {
    if (c.date_of_birth) {
      const occ = nextOccurrence(c.date_of_birth, today);
      const daysAway = Math.round((occ.getTime() - today.getTime()) / 86400000);
      items.push({
        name: c.full_name,
        kind: "birthday",
        date: occ,
        isToday: daysAway === 0,
        label: daysAway === 0 ? "Birthday today!" : `Birthday ${occ.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`,
      });
    }
    const ann = nextOccurrence(c.joining_date, today);
    const daysAway = Math.round((ann.getTime() - today.getTime()) / 86400000);
    const yrs = yearsBetween(c.joining_date, ann);
    if (yrs >= 1) {
      items.push({
        name: c.full_name,
        kind: "anniversary",
        date: ann,
        isToday: daysAway === 0,
        years: yrs,
        label: daysAway === 0
          ? `${yrs} year${yrs > 1 ? "s" : ""} at the company today!`
          : `${yrs} year${yrs > 1 ? "s" : ""} anniversary on ${ann.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`,
      });
    }
  });

  items.sort((a, b) => a.date.getTime() - b.date.getTime());
  const upcoming = items.slice(0, 6);
  const todaysItems = upcoming.filter((i) => i.isToday);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2 text-lg">
          <PartyPopper className="h-5 w-5 text-primary" />
          Highlights & Celebrations
        </CardTitle>
        <Dialog open={dobOpen} onOpenChange={setDobOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1.5">
              <Pencil className="h-3.5 w-3.5" /> My birthday
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>Set your birthday</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <Input type="date" value={dob} onChange={(e) => setDob(e.target.value)} max={today.toISOString().slice(0, 10)} />
              <Button className="w-full" onClick={() => saveDob.mutate()} disabled={!dob || saveDob.isPending}>
                Save
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent className="space-y-4">
        {todaysItems.length > 0 && (
          <div className="rounded-lg bg-primary/10 border border-primary/20 p-4 space-y-2">
            {todaysItems.map((i, idx) => (
              <p key={idx} className="flex items-center gap-2 text-sm font-medium text-primary">
                <Sparkles className="h-4 w-4" /> {i.name} — {i.label}
              </p>
            ))}
          </div>
        )}
        {upcoming.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">No upcoming celebrations yet. Set your birthday to get started!</p>
        ) : (
          <ul className="divide-y divide-border">
            {upcoming.map((i, idx) => {
              const initials = i.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
              const Icon = i.kind === "birthday" ? Cake : Gift;
              return (
                <li key={idx} className="flex items-center gap-3 py-2.5">
                  <Avatar className="h-9 w-9">
                    <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">{initials}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{i.name}</p>
                    <p className="text-xs text-muted-foreground">{i.label}</p>
                  </div>
                  <Icon className={`h-4 w-4 shrink-0 ${i.isToday ? "text-primary" : "text-muted-foreground"}`} />
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
