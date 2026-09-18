import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  Building2, CalendarDays, Users, ShieldCheck, IndianRupee,
  Check, Copy, Plus, Trash2, ArrowRight, ArrowLeft,
} from "lucide-react";

type Role = "admin" | "hr" | "manager" | "employee";

const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const timezones = ["Asia/Kolkata", "Asia/Dubai", "Asia/Singapore", "Europe/London", "Europe/Berlin", "America/New_York", "America/Los_Angeles", "UTC"];
const suggestedDepartments = ["Engineering", "Sales", "Marketing", "Human Resources", "Finance", "Operations", "Support"];

const steps = [
  { key: "company", label: "Company", icon: Building2 },
  { key: "week", label: "Work week", icon: CalendarDays },
  { key: "departments", label: "Departments", icon: Users },
  { key: "team", label: "Invite your team", icon: ShieldCheck },
  { key: "pay", label: "Pay & finish", icon: IndianRupee },
] as const;

export default function Setup() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { company, user, refresh } = useAuth();

  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState("");
  const [timezone, setTimezone] = useState("Asia/Kolkata");
  const [weeklyOffs, setWeeklyOffs] = useState<number[]>([0, 6]);
  const [deptName, setDeptName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<Role>("hr");

  const { data: companyRow } = useQuery({
    queryKey: ["setup-company", company?.id],
    enabled: !!company?.id,
    queryFn: async () => {
      const { data } = await supabase.from("companies").select("*").eq("id", company!.id).maybeSingle();
      return data;
    },
  });

  useEffect(() => {
    if (!companyRow) return;
    setName((p) => p || companyRow.name);
    setTimezone(companyRow.timezone || "Asia/Kolkata");
    setWeeklyOffs(companyRow.weekly_offs ?? [0, 6]);
  }, [companyRow]);

  const { data: departments } = useQuery({
    queryKey: ["setup-departments"],
    queryFn: async () => (await supabase.from("departments").select("*").order("name")).data || [],
  });

  const { data: invites } = useQuery({
    queryKey: ["setup-invites"],
    queryFn: async () =>
      (await supabase.from("company_invites").select("*").order("created_at", { ascending: false })).data || [],
  });

  const hasHrInvite = useMemo(() => (invites ?? []).some((i) => i.role === "hr"), [invites]);

  const saveCompany = async () => {
    if (name.trim().length < 2) return toast.error("Company name must be at least 2 characters");
    if (name.trim().length > 60) return toast.error("Company name must be 60 characters or less");
    setSaving(true);
    const { error } = await supabase
      .from("companies")
      .update({ name: name.trim(), timezone })
      .eq("id", company!.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    await refresh();
    setStep(1);
  };

  const saveWeek = async () => {
    if (weeklyOffs.length >= 7)
      return toast.error("You must keep at least one working day — every day cannot be an off day");
    setSaving(true);
    const { error } = await supabase
      .from("companies")
      .update({ weekly_offs: weeklyOffs })
      .eq("id", company!.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    setStep(2);
  };

  const addDepartment = async (value: string) => {
    const clean = value.trim();
    if (clean.length < 2) return toast.error("Department name must be at least 2 characters");
    if (clean.length > 50) return toast.error("Department name must be 50 characters or less");
    const { error } = await supabase.from("departments").insert({ name: clean });
    if (error) return toast.error(error.message);
    setDeptName("");
    queryClient.invalidateQueries({ queryKey: ["setup-departments"] });
  };

  const removeDepartment = async (id: string) => {
    const { error } = await supabase.from("departments").delete().eq("id", id);
    if (error) return toast.error(error.message);
    queryClient.invalidateQueries({ queryKey: ["setup-departments"] });
  };

  const createInvite = async () => {
    const email = inviteEmail.trim();
    if (!email) return toast.error("Email is required");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || email.length > 255)
      return toast.error("Please enter a valid email address");
    const { error } = await supabase.from("company_invites").insert({
      email,
      role: inviteRole,
      created_by: user?.id ?? null,
    });
    if (error) return toast.error(error.message);
    setInviteEmail("");
    toast.success("Invite code created");
    queryClient.invalidateQueries({ queryKey: ["setup-invites"] });
  };

  const removeInvite = async (id: string) => {
    const { error } = await supabase.from("company_invites").delete().eq("id", id);
    if (error) return toast.error(error.message);
    queryClient.invalidateQueries({ queryKey: ["setup-invites"] });
  };

  const finish = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("companies")
      .update({ setup_completed_at: new Date().toISOString() })
      .eq("id", company!.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    await refresh();
    toast.success("Your workspace is ready");
    navigate("/", { replace: true });
  };

  return (
    <div className="min-h-screen bg-muted/30 py-10 px-4">
      <div className="mx-auto w-full max-w-3xl space-y-6">
        <div className="text-center space-y-1">
          <h1 className="text-2xl font-bold">Set up {company?.name || "your company"}</h1>
          <p className="text-muted-foreground text-sm">
            A few basics first, so everything is ready before your people sign up.
          </p>
        </div>

        <ol className="flex flex-wrap items-center justify-center gap-2">
          {steps.map((s, i) => (
            <li key={s.key}>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setStep(i)}
                className={cn(
                  "h-auto rounded-full border px-3 py-1.5 text-xs",
                  i === step
                    ? "bg-primary text-primary-foreground border-primary"
                    : i < step
                      ? "bg-background text-foreground border-primary/40"
                      : "bg-background text-muted-foreground",
                )}
              >
                {i < step ? <Check className="h-3.5 w-3.5" /> : <s.icon className="h-3.5 w-3.5" />}
                {s.label}
              </Button>
            </li>
          ))}
        </ol>

        {step === 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Company details</CardTitle>
              <CardDescription>The name your team sees, and the time zone used for check-in times.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1">
                <Label>Company name</Label>
                <Input value={name} maxLength={60} onChange={(e) => setName(e.target.value)} placeholder="Acme Pvt Ltd" />
                <p className="text-xs text-muted-foreground">{name.trim().length}/60 characters</p>
              </div>
              <div className="space-y-1">
                <Label>Time zone</Label>
                <Select value={timezone} onValueChange={setTimezone}>
                  <SelectTrigger className="w-full sm:w-72"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {timezones.map((tz) => <SelectItem key={tz} value={tz}>{tz}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex justify-end">
                <Button onClick={saveCompany} disabled={saving}>
                  Continue <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {step === 1 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Work week</CardTitle>
              <CardDescription>
                Tick your weekly off days. Nobody is marked absent on these days and they are skipped when leave days are counted.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-4">
                {dayNames.map((label, idx) => (
                  <label key={label} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={weeklyOffs.includes(idx)}
                      onCheckedChange={(v) =>
                        setWeeklyOffs((prev) => (v ? [...prev, idx].sort() : prev.filter((d) => d !== idx)))
                      }
                    />
                    {label}
                  </label>
                ))}
              </div>
              {weeklyOffs.length >= 7 && (
                <p className="text-sm text-destructive">
                  You must keep at least one working day — every day cannot be an off day.
                </p>
              )}
              <div className="flex justify-between">
                <Button variant="ghost" onClick={() => setStep(0)}><ArrowLeft className="h-4 w-4 mr-2" /> Back</Button>
                <Button onClick={saveWeek} disabled={saving || weeklyOffs.length >= 7}>Continue <ArrowRight className="h-4 w-4 ml-2" /></Button>
              </div>
            </CardContent>
          </Card>
        )}

        {step === 2 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Departments</CardTitle>
              <CardDescription>Add the teams people will belong to. You can add more later.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Input
                  value={deptName}
                  maxLength={50}
                  onChange={(e) => setDeptName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") addDepartment(deptName); }}
                  placeholder="e.g. Engineering"
                />
                <Button onClick={() => addDepartment(deptName)} disabled={!deptName.trim()}>
                  <Plus className="h-4 w-4 mr-1" /> Add
                </Button>
              </div>

              <div className="flex flex-wrap gap-2">
                {suggestedDepartments
                  .filter((s) => !(departments ?? []).some((d) => d.name.toLowerCase() === s.toLowerCase()))
                  .map((s) => (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      key={s}
                      onClick={() => addDepartment(s)}
                      className="h-auto rounded-full border border-dashed px-3 py-1 text-xs text-muted-foreground hover:border-primary hover:text-foreground"
                    >
                      + {s}
                    </Button>
                  ))}
              </div>

              <div className="space-y-2">
                {(departments ?? []).map((d) => (
                  <div key={d.id} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                    <span className="font-medium">{d.name}</span>
                    <Button variant="ghost" size="icon" onClick={() => removeDepartment(d.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))}
                {(departments ?? []).length === 0 && (
                  <p className="text-sm text-muted-foreground">No departments yet.</p>
                )}
              </div>

              <div className="flex justify-between">
                <Button variant="ghost" onClick={() => setStep(1)}><ArrowLeft className="h-4 w-4 mr-2" /> Back</Button>
                <Button onClick={() => setStep(3)}>Continue <ArrowRight className="h-4 w-4 ml-2" /></Button>
              </div>
            </CardContent>
          </Card>
        )}

        {step === 3 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Invite your team</CardTitle>
              <CardDescription>
                Start with your HR person — share their code and they sign up straight into this company with the right access.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap items-end gap-3">
                <div className="space-y-1 flex-1 min-w-[200px]">
                  <Label>Email <span className="text-destructive">*</span></Label>
                  <Input
                    type="email"
                    required
                    maxLength={255}
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="hr@company.com"
                  />
                </div>
                <div className="space-y-1">
                  <Label>Joins as</Label>
                  <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as Role)}>
                    <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="hr">HR</SelectItem>
                      <SelectItem value="manager">Manager</SelectItem>
                      <SelectItem value="employee">Employee</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={createInvite} disabled={!inviteEmail.trim()}>Create code</Button>
              </div>

              <div className="space-y-2">
                {(invites ?? []).map((i) => (
                  <div key={i.id} className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
                    <span className="font-mono font-semibold">{i.code}</span>
                    <Badge variant="role" className="capitalize">{i.role === "hr" ? "HR" : i.role}</Badge>
                    <span className="text-muted-foreground truncate">{i.email || "Anyone"}</span>
                    <div className="ml-auto flex items-center gap-1">
                      <Button variant="ghost" size="icon" onClick={() => { navigator.clipboard.writeText(i.code); toast.success("Code copied"); }}>
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => removeInvite(i.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
                {(invites ?? []).length === 0 && <p className="text-sm text-muted-foreground">No codes yet.</p>}
              </div>

              {!hasHrInvite && (
                <p className="text-xs text-muted-foreground">
                  Tip: create at least one HR code so someone else can manage people, leave and payroll with you.
                </p>
              )}

              <div className="flex justify-between">
                <Button variant="ghost" onClick={() => setStep(2)}><ArrowLeft className="h-4 w-4 mr-2" /> Back</Button>
                <Button onClick={() => setStep(4)}>Continue <ArrowRight className="h-4 w-4 ml-2" /></Button>
              </div>
            </CardContent>
          </Card>
        )}

        {step === 4 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Pay & finish</CardTitle>
              <CardDescription>Salaries are set per person once they have joined.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-md border p-4 text-sm space-y-2">
                <p className="font-medium">What happens next</p>
                <ul className="list-disc pl-5 text-muted-foreground space-y-1">
                  <li>Share the invite codes — people sign up and land in this company.</li>
                  <li>Assign each person a department and a manager on the Employees page.</li>
                  <li>Set pay for each person on the Salary Entry page, then run payroll monthly.</li>
                  <li>Add your public holidays on the Holidays page.</li>
                </ul>
              </div>
              <div className="flex justify-between">
                <Button variant="ghost" onClick={() => setStep(3)}><ArrowLeft className="h-4 w-4 mr-2" /> Back</Button>
                <Button onClick={finish} disabled={saving}>Finish setup</Button>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="text-center">
          <Button type="button" variant="link" size="sm" onClick={() => navigate("/", { replace: true })} className="h-auto p-0 text-xs text-muted-foreground">
            Skip for now
          </Button>
        </div>
      </div>
    </div>
  );
}
