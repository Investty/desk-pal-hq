import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/components/ui/sonner";
import { Plus, Trash2 } from "lucide-react";
import { format } from "date-fns";

interface Broadcast {
  id: string; title: string; body: string; severity: string; audience: string;
  is_published: boolean; publish_at: string; expires_at: string | null; created_at: string;
}

const SEVERITIES = [
  { value: "info", label: "Release note / info" },
  { value: "warning", label: "Scheduled maintenance" },
  { value: "critical", label: "Urgent incident" },
];

const AUDIENCES = [
  { value: "admins", label: "HR and admins only" },
  { value: "everyone", label: "Everyone in every company" },
];

const toLocalInput = (iso: string | null) => (iso ? format(new Date(iso), "yyyy-MM-dd'T'HH:mm") : "");

const empty = {
  id: null as string | null, title: "", body: "", severity: "info", audience: "admins",
  is_published: false, publish_at: toLocalInput(new Date().toISOString()), expires_at: "",
};

export default function BroadcastsTab() {
  const qc = useQueryClient();
  const [form, setForm] = useState<typeof empty | null>(null);

  const { data: list } = useQuery({
    queryKey: ["owner-broadcasts"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("owner_list_broadcasts");
      if (error) throw error;
      return (data ?? []) as unknown as Broadcast[];
    },
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["owner-broadcasts"] });
    qc.invalidateQueries({ queryKey: ["owner-audit"] });
  };

  const save = useMutation({
    mutationFn: async (b: typeof empty) => {
      const { error } = await supabase.rpc("owner_upsert_broadcast", {
        _id: b.id,
        _title: b.title,
        _body: b.body,
        _severity: b.severity,
        _audience: b.audience,
        _is_published: b.is_published,
        _publish_at: b.publish_at ? new Date(b.publish_at).toISOString() : new Date().toISOString(),
        _expires_at: b.expires_at ? new Date(b.expires_at).toISOString() : null,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Message saved"); setForm(null); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc("owner_delete_broadcast", { _id: id });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Message deleted"); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle>Platform messages</CardTitle>
          <CardDescription>Maintenance notices, incidents and release notes shown inside every company</CardDescription>
        </div>
        <Button size="sm" onClick={() => setForm({ ...empty, publish_at: toLocalInput(new Date().toISOString()) })}>
          <Plus className="h-4 w-4 mr-2" /> New message
        </Button>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Message</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Shown to</TableHead>
              <TableHead>Live from</TableHead>
              <TableHead>Until</TableHead>
              <TableHead>State</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(list ?? []).map((b) => (
              <TableRow key={b.id}>
                <TableCell>
                  <p className="font-medium">{b.title}</p>
                  <p className="text-xs text-muted-foreground max-w-[320px] truncate">{b.body}</p>
                </TableCell>
                <TableCell className="capitalize">{b.severity}</TableCell>
                <TableCell>{b.audience === "everyone" ? "Everyone" : "HR & admins"}</TableCell>
                <TableCell className="text-sm whitespace-nowrap">{format(new Date(b.publish_at), "dd MMM yyyy HH:mm")}</TableCell>
                <TableCell className="text-sm whitespace-nowrap">{b.expires_at ? format(new Date(b.expires_at), "dd MMM yyyy HH:mm") : "—"}</TableCell>
                <TableCell>
                  <Badge variant={b.is_published ? "default" : "secondary"}>{b.is_published ? "Published" : "Draft"}</Badge>
                </TableCell>
                <TableCell className="text-right space-x-2 whitespace-nowrap">
                  <Button size="sm" variant="outline" onClick={() => setForm({
                    id: b.id, title: b.title, body: b.body, severity: b.severity, audience: b.audience,
                    is_published: b.is_published, publish_at: toLocalInput(b.publish_at), expires_at: toLocalInput(b.expires_at),
                  })}>Edit</Button>
                  <Button size="sm" variant="ghost" onClick={() => remove.mutate(b.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {(list ?? []).length === 0 && (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No messages yet</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>

      <Dialog open={!!form} onOpenChange={(o) => !o && setForm(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{form?.id ? "Edit message" : "New message"}</DialogTitle>
            <DialogDescription>Published messages appear as a banner until the reader dismisses them or they expire.</DialogDescription>
          </DialogHeader>
          {form && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Title</Label>
                <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Scheduled maintenance on Sunday" />
              </div>
              <div className="space-y-2">
                <Label>Message</Label>
                <Textarea rows={4} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Type</Label>
                  <Select value={form.severity} onValueChange={(v) => setForm({ ...form, severity: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {SEVERITIES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Shown to</Label>
                  <Select value={form.audience} onValueChange={(v) => setForm({ ...form, audience: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {AUDIENCES.map((a) => <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Live from</Label>
                  <Input type="datetime-local" value={form.publish_at} onChange={(e) => setForm({ ...form, publish_at: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Hide after (optional)</Label>
                  <Input type="datetime-local" value={form.expires_at} onChange={(e) => setForm({ ...form, expires_at: e.target.value })} />
                </div>
              </div>
              <div className="flex items-center justify-between rounded-md border p-3">
                <div>
                  <p className="text-sm font-medium">Publish now</p>
                  <p className="text-xs text-muted-foreground">Leave off to keep it as a draft</p>
                </div>
                <Switch checked={form.is_published} onCheckedChange={(v) => setForm({ ...form, is_published: v })} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setForm(null)}>Cancel</Button>
            <Button disabled={!form?.title || !form?.body || save.isPending} onClick={() => form && save.mutate(form)}>
              Save message
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
