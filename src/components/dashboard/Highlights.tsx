import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Cake, PartyPopper, Gift, Pencil, Heart } from "lucide-react";
import { useState } from "react";
import { toast } from "@/components/ui/sonner";

interface Celebration {
  user_id: string;
  full_name: string;
  date_of_birth: string | null;
  joining_date: string;
}

type Occasion = "birthday" | "anniversary";

interface TodayItem {
  userId: string;
  name: string;
  kind: Occasion;
  label: string;
  years?: number;
}

const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

// true when monthDay (yyyy-mm-dd) falls on today (Feb 29 celebrated Feb 28 on non-leap years)
function isTodayOccurrence(dateStr: string, today: Date): boolean {
  const [, m, d] = dateStr.split("-").map(Number);
  if (m === today.getMonth() + 1 && d === today.getDate()) return true;
  if (m === 2 && d === 29) {
    const leap = new Date(today.getFullYear(), 1, 29).getMonth() === 1;
    if (!leap && today.getMonth() === 1 && today.getDate() === 28) return true;
  }
  return false;
}

export default function Highlights() {
  const { profile, user } = useAuth();
  const queryClient = useQueryClient();
  const [dobOpen, setDobOpen] = useState(false);
  const [dob, setDob] = useState("");
  const [wishFor, setWishFor] = useState<TodayItem | null>(null);
  const [wishText, setWishText] = useState("");
  const [thanksOpen, setThanksOpen] = useState(false);
  const [thanksText, setThanksText] = useState("Thank you so much for your wishes!");

  const today = new Date();
  const todayIso = iso(today);

  const { data: celebrations } = useQuery({
    queryKey: ["celebrations"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_celebrations");
      if (error) throw error;
      return (data || []) as Celebration[];
    },
  });

  const { data: wishes } = useQuery({
    queryKey: ["celebration-wishes", todayIso],
    queryFn: async () => {
      const { data } = await supabase
        .from("celebration_wishes")
        .select("*")
        .eq("occasion_date", todayIso);
      return data || [];
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

  const sendWish = useMutation({
    mutationFn: async () => {
      const item = wishFor!;
      const { error } = await supabase.from("celebration_wishes").insert({
        company_id: profile!.company_id,
        recipient_user_id: item.userId,
        sender_user_id: user!.id,
        occasion_type: item.kind,
        occasion_date: todayIso,
        message: wishText.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Wish sent!");
      setWishFor(null);
      setWishText("");
      queryClient.invalidateQueries({ queryKey: ["celebration-wishes"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const sendThanks = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("celebration_wishes")
        .update({ thanks_message: thanksText.trim() || null, thanked_at: new Date().toISOString() })
        .eq("recipient_user_id", user!.id)
        .eq("occasion_date", todayIso)
        .is("thanked_at", null);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Thank you sent to everyone who wished you");
      setThanksOpen(false);
      queryClient.invalidateQueries({ queryKey: ["celebration-wishes"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const items: TodayItem[] = [];
  celebrations?.forEach((c) => {
    if (c.date_of_birth && isTodayOccurrence(c.date_of_birth, today)) {
      items.push({ userId: c.user_id, name: c.full_name, kind: "birthday", label: "Birthday today!" });
    }
    if (isTodayOccurrence(c.joining_date, today)) {
      const yrs = today.getFullYear() - new Date(c.joining_date).getFullYear();
      if (yrs >= 1) {
        items.push({
          userId: c.user_id,
          name: c.full_name,
          kind: "anniversary",
          years: yrs,
          label: `${yrs} year${yrs > 1 ? "s" : ""} at the company today!`,
        });
      }
    }
  });

  const myWishes = wishes?.filter((w) => w.recipient_user_id === user?.id) || [];
  const unthanked = myWishes.filter((w) => !w.thanked_at);
  const nameOf = (uid: string) => celebrations?.find((c) => c.user_id === uid)?.full_name || "A colleague";

  const wishCount = (item: TodayItem) =>
    wishes?.filter((w) => w.recipient_user_id === item.userId && w.occasion_type === item.kind).length || 0;
  const alreadyWished = (item: TodayItem) =>
    !!wishes?.some(
      (w) => w.recipient_user_id === item.userId && w.occasion_type === item.kind && w.sender_user_id === user?.id,
    );

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2 text-lg">
          <PartyPopper className="h-5 w-5 text-primary" />
          Today's Celebrations
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
              <Input type="date" value={dob} onChange={(e) => setDob(e.target.value)} max={todayIso} />
              <Button className="w-full" onClick={() => saveDob.mutate()} disabled={!dob || saveDob.isPending}>
                Save
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent className="space-y-4">
        {myWishes.length > 0 && (
          <div className="rounded-lg bg-primary/10 border border-primary/20 p-4 space-y-2">
            <p className="text-sm font-medium text-primary">
              {myWishes.length} {myWishes.length === 1 ? "colleague has" : "colleagues have"} wished you today
            </p>
            <p className="text-xs text-muted-foreground">
              {myWishes.map((w) => nameOf(w.sender_user_id)).join(", ")}
            </p>
            {unthanked.length > 0 && (
              <Dialog open={thanksOpen} onOpenChange={setThanksOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" variant="outline" className="gap-1.5">
                    <Heart className="h-3.5 w-3.5" /> Say thanks
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-sm">
                  <DialogHeader>
                    <DialogTitle>Thank everyone who wished you</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 pt-2">
                    <Textarea value={thanksText} onChange={(e) => setThanksText(e.target.value)} rows={3} />
                    <Button className="w-full" onClick={() => sendThanks.mutate()} disabled={sendThanks.isPending}>
                      Send thank you
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </div>
        )}

        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">No celebrations today.</p>
        ) : (
          <ul className="divide-y divide-border">
            {items.map((i, idx) => {
              const initials = i.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
              const Icon = i.kind === "birthday" ? Cake : Gift;
              const isSelf = i.userId === user?.id;
              const count = wishCount(i);
              return (
                <li key={idx} className="flex items-center gap-3 py-2.5">
                  <Avatar className="h-9 w-9">
                    <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">{initials}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{isSelf ? "You" : i.name}</p>
                    <p className="text-xs text-muted-foreground">{i.label}</p>
                  </div>
                  {count > 0 && <Badge variant="secondary">{count} wish{count > 1 ? "es" : ""}</Badge>}
                  {!isSelf &&
                    (alreadyWished(i) ? (
                      <Badge variant="outline" className="gap-1"><Heart className="h-3 w-3" /> Wished</Badge>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1.5"
                        onClick={() => {
                          setWishFor(i);
                          setWishText(
                            i.kind === "birthday" ? "Happy birthday! 🎉" : "Congratulations on your work anniversary! 🎊",
                          );
                        }}
                      >
                        <Heart className="h-3.5 w-3.5" /> Wish
                      </Button>
                    ))}
                  <Icon className="h-4 w-4 shrink-0 text-primary" />
                </li>
              );
            })}
          </ul>
        )}

        <Dialog open={!!wishFor} onOpenChange={(o) => !o && setWishFor(null)}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>Wish {wishFor?.name}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <Textarea value={wishText} onChange={(e) => setWishText(e.target.value)} rows={3} />
              <Button className="w-full" onClick={() => sendWish.mutate()} disabled={sendWish.isPending}>
                Send wish
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
