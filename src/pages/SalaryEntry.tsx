import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { format } from "date-fns";
import { IndianRupee, Save, Wallet } from "lucide-react";
import { Link } from "react-router-dom";
import { computeSalary, formatINR as fmt, type SalaryComponents } from "@/lib/salary";

interface EmpRow {
  user_id: string;
  full_name: string;
  employee_id: string;
  designation: string | null;
  joining_date: string;
  employment_type: string | null;
  departments: { name: string } | null;
}

const EMPTY = { basic: "", da: "", hra: "", special_allowance: "", pf_rate: "12", professional_tax: "", tds: "" };

export default function SalaryEntry() {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState("");
  const [form, setForm] = useState({ ...EMPTY });
  const [effectiveFrom, setEffectiveFrom] = useState(new Date().toISOString().slice(0, 10));

  const { data: employees } = useQuery({
    queryKey: ["salary-entry-employees"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, full_name, employee_id, designation, joining_date, employment_type, departments(name)")
        .eq("is_active", true)
        .order("full_name")
        .returns<EmpRow[]>();
      if (error) throw error;
      return data || [];
    },
  });

  const { data: salaries } = useQuery({
    queryKey: ["salary-structures"],
    queryFn: async () => {
      const { data, error } = await supabase.from("salary_structures").select("*");
      if (error) throw error;
      return data || [];
    },
  });

  const salaryOf = (uid: string) => salaries?.find((s) => s.user_id === uid);
  const emp = (uid: string) => employees?.find((e) => e.user_id === uid);

  const num = (v: string) => Number(v) || 0;
  const draft: SalaryComponents = {
    basic: num(form.basic), da: num(form.da), hra: num(form.hra),
    special_allowance: num(form.special_allowance),
    pf_rate: form.pf_rate === "" ? 0 : num(form.pf_rate),
    professional_tax: num(form.professional_tax), tds: num(form.tds),
  };
  const preview = computeSalary(draft);

  const onSelect = (uid: string) => {
    setSelected(uid);
    const s = salaryOf(uid);
    if (s) {
      setForm({
        basic: String(s.basic ?? ""), da: String(s.da ?? ""), hra: String(s.hra ?? ""),
        special_allowance: String(s.special_allowance ?? ""), pf_rate: String(s.pf_rate ?? 12),
        professional_tax: String(s.professional_tax ?? ""), tds: String(s.tds ?? ""),
      });
      setEffectiveFrom(s.effective_from);
    } else {
      setForm({ ...EMPTY });
      setEffectiveFrom(new Date().toISOString().slice(0, 10));
    }
  };

  const save = useMutation({
    mutationFn: async () => {
      if (!selected) throw new Error("Select an employee first");
      if (draft.basic <= 0) throw new Error("Basic pay must be greater than zero");
      const { error } = await supabase.from("salary_structures").upsert({
        user_id: selected,
        basic: draft.basic,
        da: draft.da,
        hra: draft.hra,
        special_allowance: draft.special_allowance,
        pf_rate: draft.pf_rate,
        professional_tax: draft.professional_tax,
        tds: draft.tds,
        // legacy roll-up columns kept in sync
        allowances: draft.hra + draft.special_allowance,
        deductions: preview.deductions,
        effective_from: effectiveFrom,
      }, { onConflict: "user_id" });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Salary saved — payslips will use these figures.");
      queryClient.invalidateQueries({ queryKey: ["salary-structures"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const field = (key: keyof typeof EMPTY, label: string, hint?: string) => (
    <div className="space-y-1">
      <Label>{label}</Label>
      <Input type="number" min="0" value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} />
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );

  const selectedEmp = selected ? emp(selected) : undefined;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><IndianRupee className="h-6 w-6" /> Salary Entry</h1>
          <p className="text-muted-foreground">Set each employee's salary components — Payroll and payslips use these figures.</p>
        </div>
        <Button variant="outline" asChild><Link to="/payroll"><Wallet className="h-4 w-4 mr-2" /> Go to Payroll</Link></Button>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Employee Salary</CardTitle></CardHeader>
        <CardContent className="space-y-5">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1 min-w-64">
              <Label>Employee</Label>
              <Select value={selected} onValueChange={onSelect}>
                <SelectTrigger><SelectValue placeholder="Select employee" /></SelectTrigger>
                <SelectContent>
                  {employees?.map((e) => (
                    <SelectItem key={e.user_id} value={e.user_id}>{e.full_name} ({e.employee_id})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1 w-44">
              <Label>Effective from</Label>
              <Input type="date" value={effectiveFrom} onChange={(e) => setEffectiveFrom(e.target.value)} />
            </div>
          </div>

          {selectedEmp && (
            <p className="text-xs text-muted-foreground">
              {selectedEmp.designation || "No designation"} · {selectedEmp.departments?.name || "No department"} ·{" "}
              {selectedEmp.employment_type || "—"} · joined {format(new Date(selectedEmp.joining_date), "dd MMM yyyy")}
            </p>
          )}

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {field("basic", "Basic pay (monthly)")}
            {field("da", "Dearness Allowance (DA)")}
            {field("hra", "HRA")}
            {field("special_allowance", "Other / Special allowance")}
            {field("pf_rate", "PF rate (%)", "PF = % of Basic + DA")}
            {field("professional_tax", "Professional tax")}
            {field("tds", "Income tax (TDS)")}
          </div>

          <div className="rounded-lg border bg-muted/40 p-4 grid gap-3 sm:grid-cols-4 text-sm">
            <div><p className="text-xs text-muted-foreground">Gross earnings</p><p className="font-semibold">{fmt(preview.gross)}</p></div>
            <div><p className="text-xs text-muted-foreground">PF ({draft.pf_rate}%)</p><p className="font-semibold">{fmt(preview.pf)}</p></div>
            <div><p className="text-xs text-muted-foreground">Total deductions</p><p className="font-semibold">{fmt(preview.deductions)}</p></div>
            <div><p className="text-xs text-muted-foreground">Net pay</p><p className="font-bold text-primary">{fmt(preview.net)}</p></div>
          </div>

          <Button onClick={() => save.mutate()} disabled={save.isPending || !selected}>
            <Save className="h-4 w-4 mr-2" /> Save salary
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">All Salary Structures</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead className="text-right">Basic</TableHead>
                <TableHead className="text-right">DA</TableHead>
                <TableHead className="text-right">HRA</TableHead>
                <TableHead className="text-right">Other</TableHead>
                <TableHead className="text-right">Gross</TableHead>
                <TableHead className="text-right">PF</TableHead>
                <TableHead className="text-right">Deductions</TableHead>
                <TableHead className="text-right">Net</TableHead>
                <TableHead className="w-16"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {employees?.map((e) => {
                const s = salaryOf(e.user_id);
                const c = s ? computeSalary(s) : null;
                return (
                  <TableRow key={e.user_id}>
                    <TableCell className="font-medium">{e.full_name} <span className="text-muted-foreground text-xs">({e.employee_id})</span></TableCell>
                    {c ? (
                      <>
                        <TableCell className="text-right">{fmt(c.basic)}</TableCell>
                        <TableCell className="text-right">{fmt(c.da)}</TableCell>
                        <TableCell className="text-right">{fmt(c.hra)}</TableCell>
                        <TableCell className="text-right">{fmt(c.special_allowance)}</TableCell>
                        <TableCell className="text-right">{fmt(c.gross)}</TableCell>
                        <TableCell className="text-right">{fmt(c.pf)}</TableCell>
                        <TableCell className="text-right">{fmt(c.deductions)}</TableCell>
                        <TableCell className="text-right font-semibold">{fmt(c.net)}</TableCell>
                      </>
                    ) : (
                      <TableCell colSpan={8} className="text-right"><Badge variant="outline">Not set</Badge></TableCell>
                    )}
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => onSelect(e.user_id)}>Edit</Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
