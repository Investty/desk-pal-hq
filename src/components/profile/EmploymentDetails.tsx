import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";

const EMPLOYMENT_TYPES = ["Full-time", "Part-time", "Contract", "Intern", "Consultant"];
const EMPLOYMENT_STATUSES = ["Probation", "Confirmed", "Notice Period", "Resigned", "Terminated", "Retired"];

type Form = {
  joining_date: string; retirement_date: string; employment_type: string; employment_status: string;
  confirmation_date: string; company: string; business_unit: string; department_id: string;
  sub_department: string; designation: string; region: string; branch: string; sub_branch: string;
  manager_id: string; functional_manager_id: string;
};

const EMPTY: Form = {
  joining_date: "", retirement_date: "", employment_type: "", employment_status: "", confirmation_date: "",
  company: "", business_unit: "", department_id: "", sub_department: "", designation: "", region: "",
  branch: "", sub_branch: "", manager_id: "", functional_manager_id: "",
};

const NONE = "__none__";

export default function EmploymentDetails() {
  const { user, isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<Form>(EMPTY);

  const { data: profile } = useQuery({
    queryKey: ["my-profile", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("*, departments(name)").eq("user_id", user!.id).single();
      return data;
    },
    enabled: !!user,
  });

  const { data: departments } = useQuery({
    queryKey: ["departments-list"],
    queryFn: async () => (await supabase.from("departments").select("id, name").order("name")).data || [],
  });

  const { data: people } = useQuery({
    queryKey: ["profiles-minimal"],
    queryFn: async () => (await supabase.from("profiles").select("id, full_name").order("full_name")).data || [],
  });

  useEffect(() => {
    if (!profile) return;
    setForm({
      joining_date: profile.joining_date || "",
      retirement_date: profile.retirement_date || "",
      employment_type: profile.employment_type || "",
      employment_status: profile.employment_status || "",
      confirmation_date: profile.confirmation_date || "",
      company: profile.company || "",
      business_unit: profile.business_unit || "",
      department_id: profile.department_id || "",
      sub_department: profile.sub_department || "",
      designation: profile.designation || "",
      region: profile.region || "",
      branch: profile.branch || "",
      sub_branch: profile.sub_branch || "",
      manager_id: profile.manager_id || "",
      functional_manager_id: profile.functional_manager_id || "",
    });
  }, [profile]);

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("profiles").update({
        joining_date: form.joining_date || profile!.joining_date,
        retirement_date: form.retirement_date || null,
        employment_type: form.employment_type || null,
        employment_status: form.employment_status || null,
        confirmation_date: form.confirmation_date || null,
        company: form.company || null,
        business_unit: form.business_unit || null,
        department_id: form.department_id || null,
        sub_department: form.sub_department || null,
        designation: form.designation || null,
        region: form.region || null,
        branch: form.branch || null,
        sub_branch: form.sub_branch || null,
        manager_id: form.manager_id || null,
        functional_manager_id: form.functional_manager_id || null,
      }).eq("user_id", user!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Employment details updated");
      queryClient.invalidateQueries({ queryKey: ["my-profile"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const nameOf = (id: string | null) => people?.find((p) => p.id === id)?.full_name || "—";
  const dateText = (d: string) => (d ? format(new Date(d), "MMM d, yyyy") : "—");

  const Row = ({ label, value }: { label: string; value: string }) => (
    <div className="space-y-1">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium">{value || "—"}</p>
    </div>
  );

  if (!isAdmin) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader><CardTitle>Employment Status &amp; Type</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <Row label="Date of Joining" value={dateText(form.joining_date)} />
            <Row label="Retirement Date" value={dateText(form.retirement_date)} />
            <Row label="Employment Type" value={form.employment_type} />
            <Row label="Employment Status" value={form.employment_status} />
            <Row label="Date of Confirmation" value={dateText(form.confirmation_date)} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Position</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <Row label="Company" value={form.company} />
            <Row label="Business Unit" value={form.business_unit} />
            <Row label="Department" value={(profile?.departments as { name?: string } | null)?.name || ""} />
            <Row label="Sub Department" value={form.sub_department} />
            <Row label="Designation" value={form.designation} />
            <Row label="Region" value={form.region} />
            <Row label="Branch" value={form.branch} />
            <Row label="Sub Branch" value={form.sub_branch} />
            <Row label="Reporting Manager" value={nameOf(form.manager_id)} />
            <Row label="Functional Manager" value={nameOf(form.functional_manager_id)} />
          </CardContent>
        </Card>
      </div>
    );
  }

  const text = (key: keyof Form, label: string, type = "text") => (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input type={type} value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} />
    </div>
  );

  const select = (key: keyof Form, label: string, options: { value: string; label: string }[]) => (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Select value={form[key] || NONE} onValueChange={(v) => setForm({ ...form, [key]: v === NONE ? "" : v })}>
        <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
        <SelectContent>
          <SelectItem value={NONE}>Not set</SelectItem>
          {options.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle>Employment Status &amp; Type</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {text("joining_date", "Date of Joining", "date")}
          {text("retirement_date", "Retirement Date", "date")}
          {select("employment_type", "Employment Type", EMPLOYMENT_TYPES.map((t) => ({ value: t, label: t })))}
          {select("employment_status", "Employment Status", EMPLOYMENT_STATUSES.map((t) => ({ value: t, label: t })))}
          {text("confirmation_date", "Date of Confirmation", "date")}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Position</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {text("company", "Company")}
          {text("business_unit", "Business Unit")}
          {select("department_id", "Department", (departments || []).map((d) => ({ value: d.id, label: d.name })))}
          {text("sub_department", "Sub Department")}
          {text("designation", "Designation")}
          {text("region", "Region")}
          {text("branch", "Branch")}
          {text("sub_branch", "Sub Branch")}
          {select("manager_id", "Reporting Manager", (people || []).filter((p) => p.id !== profile?.id).map((p) => ({ value: p.id, label: p.full_name })))}
          {select("functional_manager_id", "Functional Manager", (people || []).filter((p) => p.id !== profile?.id).map((p) => ({ value: p.id, label: p.full_name })))}
        </CardContent>
      </Card>

      <Button onClick={() => save.mutate()} disabled={save.isPending}>Save Employment Details</Button>
    </div>
  );
}
