import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { format } from "date-fns";
import { Megaphone, Pin, Trash2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

export default function Announcements() {
  const queryClient = useQueryClient();
  const { isAdmin, user } = useAuth();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [pinned, setPinned] = useState(false);

  const { data: announcements } = useQuery({
    queryKey: ["announcements"],
    queryFn: async () => {
      const { data } = await supabase.from("announcements").select("*").order("is_pinned", { ascending: false }).order("created_at", { ascending: false });
      return data || [];
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      if (!title.trim() || !body.trim()) throw new Error("Title and message are required");
      const { error } = await supabase.from("announcements").insert({ title: title.trim(), body: body.trim(), is_pinned: pinned, created_by: user?.id });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Announcement posted!");
      setOpen(false); setTitle(""); setBody(""); setPinned(false);
      queryClient.invalidateQueries({ queryKey: ["announcements"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("announcements").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Announcement removed");
      queryClient.invalidateQueries({ queryKey: ["announcements"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Megaphone className="h-6 w-6" /> Announcements</h1>
          <p className="text-muted-foreground">Company-wide updates and notices</p>
        </div>
        {isAdmin && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button>New Announcement</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Post Announcement</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Title</Label>
                  <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Announcement title" />
                </div>
                <div className="space-y-2">
                  <Label>Message</Label>
                  <Textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Write your announcement..." rows={4} />
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={pinned} onChange={(e) => setPinned(e.target.checked)} className="accent-primary" />
                  Pin to top
                </label>
                <Button onClick={() => create.mutate()} disabled={create.isPending} className="w-full">Post</Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="space-y-4">
        {announcements?.map((a) => (
          <Card key={a.id} className={a.is_pinned ? "border-primary/50" : ""}>
            <CardHeader className="flex flex-row items-start justify-between pb-2">
              <div className="space-y-1">
                <CardTitle className="text-lg flex items-center gap-2">
                  {a.is_pinned && <Pin className="h-4 w-4 text-primary" />}
                  {a.title}
                  {a.is_pinned && <Badge variant="secondary">Pinned</Badge>}
                </CardTitle>
                <p className="text-xs text-muted-foreground">{format(new Date(a.created_at), "MMM d, yyyy 'at' hh:mm a")}</p>
              </div>
              {isAdmin && (
                <Button variant="ghost" size="icon" onClick={() => remove.mutate(a.id)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              )}
            </CardHeader>
            <CardContent><p className="text-sm whitespace-pre-wrap">{a.body}</p></CardContent>
          </Card>
        ))}
        {announcements?.length === 0 && (
          <Card><CardContent className="py-12 text-center text-muted-foreground">No announcements yet</CardContent></Card>
        )}
      </div>
    </div>
  );
}
