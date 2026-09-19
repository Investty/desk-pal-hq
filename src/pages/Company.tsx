import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/components/ui/sonner";
import { Building2, Copy, Trash2 } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { format } from "date-fns";

type Role = "admin" | "hr" | "manager" | "employee";

const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export default function Company() {
  const queryClient = useQueryClient();
  const { company, user, refresh } = useAuth();
  const [name, setName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<Role>("employee");
  const [weeklyOffs, setWeeklyOffs] = useState<number[] | null>(null);

  const { data: companyRow } = useQuery({
    queryKey: ["company", company?.id],
    enabled: !!company?.id,
    queryFn: async () => {
      const companyId = company?.id;
      if (!companyId) throw new Error("No active company selected");
      const { data, error } = await supabase.from("companies").select("*").eq("id", companyId).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    const currentName = companyRow?.name ?? company?.name;
    if (currentName) setName((prev) => (prev ? prev : currentName));
  }, [companyRow?.name, company?.name]);

  useEffect(() => {
    if (companyRow) setWeeklyOffs((prev) => prev ?? (companyRow.weekly_offs ?? [0, 6]));
  }, [companyRow]);

  const { data: invites } = useQuery({
    queryKey: ["company-invites"],
    queryFn: async () => {
      const { data } = await supabase.from("company_invites").select("*").order("created_at", { ascending: false });
      return data || [];
    },
  });

  const rename = useMutation({
    mutationFn: async () => {
      const trimmed = name.trim();
      if (trimmed.length < 2) throw new Error("Company name must be at least 2 characters");
      if (trimmed.length > 60) throw new Error("Company name must be 60 characters or less");
      const id = companyRow?.id ?? company?.id;
      if (!id) throw new Error("Company is still loading — please try again");
      const { error } = await supabase.from("companies").update({ name: trimmed }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Company name updated");
      queryClient.invalidateQueries({ queryKey: ["company"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const saveWeeklyOffs = useMutation({
    mutationFn: async (days: number[]) => {
      if (days.length >= 7) throw new Error("At least one working day is required — you cannot mark every day as an off day");
      const { error } = await supabase.rpc("set_company_weekly_offs", { _weekly_offs: days });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Work week updated");
      queryClient.invalidateQueries({ queryKey: ["company"] });
      void refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const createInvite = useMutation({
    mutationFn: async () => {
      const email = inviteEmail.trim();
      if (!email) throw new Error("Email is required");
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || email.length > 255)
        throw new Error("Please enter a valid email address");
      const normalized = email.toLowerCase();

      const { data: existingMember } = await supabase
        .from("profiles")
        .select("id")
        .eq("company_id", company?.id ?? "")
        .ilike("email", normalized)
        .maybeSingle();
      if (existingMember) throw new Error("This user already exists in your company");

      const { data: openInvite } = await supabase
        .from("company_invites")
        .select("code")
        .ilike("email", normalized)
        .is("used_at", null)
        .maybeSingle();
      if (openInvite) throw new Error(`An unused invite already exists for this email (code ${openInvite.code})`);

      const { error } = await supabase.from("company_invites").insert({
        email: normalized,
        role: inviteRole,
        created_by: user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setInviteEmail("");
      toast.success("Invite code created");
      queryClient.invalidateQueries({ queryKey: ["company-invites"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeInvite = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("company_invites").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["company-invites"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><Building2 className="h-6 w-6" /> Company</h1>
        <p className="text-muted-foreground">Your workspace: {company?.name || "—"}</p>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Company details</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap items-end gap-3">
          <div className="space-y-1 flex-1 min-w-[220px]">
            <Label>Company name</Label>
            <Input value={name} maxLength={60} onChange={(e) => setName(e.target.value)} />
            <p className="text-xs text-muted-foreground">{name.trim().length}/60 characters</p>
          </div>
          <Button onClick={() => rename.mutate()} disabled={!name.trim() || rename.isPending}>Save</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Work week</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Tick the days your company does not work. These days are skipped when leave days are counted and nobody is marked absent on them.
          </p>
          <div className="flex flex-wrap gap-4">
            {dayNames.map((label, idx) => (
              <label key={label} className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={(weeklyOffs ?? []).includes(idx)}
                  onCheckedChange={(v) =>
                    setWeeklyOffs((prev) => {
                      const cur = prev ?? [];
                      return v ? [...cur, idx].sort() : cur.filter((d) => d !== idx);
                    })
                  }
                />
                {label}
              </label>
            ))}
          </div>
          {(weeklyOffs?.length ?? 0) >= 7 && (
            <p className="text-sm text-destructive">
              You must keep at least one working day — every day cannot be an off day.
            </p>
          )}
          <Button
            onClick={() => weeklyOffs && saveWeeklyOffs.mutate(weeklyOffs)}
            disabled={!weeklyOffs || weeklyOffs.length >= 7 || saveWeeklyOffs.isPending}
          >
            Save work week
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Invite people to this company</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1 flex-1 min-w-[220px]">
              <Label>Email <span className="text-destructive">*</span></Label>
              <Input
                type="email"
                required
                requiredMessage="Please enter Email Address"
                maxLength={255}
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="person@company.com"
              />
            </div>
            <div className="space-y-1">
              <Label>Role</Label>
              <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as Role)}>
                <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="employee">Employee</SelectItem>
                  <SelectItem value="manager">Manager</SelectItem>
                  <SelectItem value="hr">HR</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={() => createInvite.mutate()} disabled={!inviteEmail.trim() || createInvite.isPending}>Generate code</Button>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>For</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invites?.map((i) => (
                <TableRow key={i.id}>
                  <TableCell className="font-mono font-medium">{i.code}</TableCell>
                  <TableCell className="capitalize">{i.role === "hr" ? "HR" : i.role}</TableCell>
                  <TableCell className="text-muted-foreground">{i.email || "Anyone"}</TableCell>
                  <TableCell>
                    {i.used_at
                      ? <Badge variant="secondary">Used {format(new Date(i.used_at), "dd MMM")}</Badge>
                      : <Badge>Active</Badge>}
                  </TableCell>
                  <TableCell className="text-right space-x-1">
                    <Button variant="ghost" size="icon" onClick={() => { navigator.clipboard.writeText(i.code); toast.success("Code copied"); }}>
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => removeInvite.mutate(i.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {invites?.length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No invites yet</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
          <p className="text-xs text-muted-foreground">
            Share a code with a new joiner. On the sign-up screen they pick “I have an invite” and enter it — they land in this company with the role you chose.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
