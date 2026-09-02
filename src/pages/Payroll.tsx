import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { format } from "date-fns";
import { Wallet, Play, Printer, Pencil } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const fmt = (n: number) => `₹${Number(n).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

interface PayslipRow {
  id: string; user_id: string; month: number; year: number;
  gross: number; deductions: number; net: number; created_at: string;
}

interface EmpRow {
  user_id: string;
  full_name: string;
  employee_id: string;
  designation: string | null;
  joining_date: string;
  employment_type: string | null;
  company: string | null;
  departments: { name: string } | null;
}

export default function Payroll() {
  const queryClient = useQueryClient();
  const { isAdmin, user } = useAuth();
  const now = new Date();
  const [editUser, setEditUser] = useState("");
  const [basic, setBasic] = useState("");
  const [allowances, setAllowances] = useState("");
  const [deductions, setDeductions] = useState("");
  const [runMonth, setRunMonth] = useState(String(now.getMonth() + 1));
  const [runYear, setRunYear] = useState(String(now.getFullYear()));
  const [viewSlip, setViewSlip] = useState<PayslipRow | null>(null);

  // Employment details for everyone the current user can see (self, or all for admin)
  const { data: employees } = useQuery({
    queryKey: ["payroll-employees", isAdmin, user?.id],
    queryFn: async () => {
      let q = supabase
        .from("profiles")
        .select("user_id, full_name, employee_id, designation, joining_date, employment_type, company, departments(name)")
        .order("full_name");
      if (!isAdmin) q = q.eq("user_id", user!.id);
      else q = q.eq("is_active", true);
      const { data, error } = await q.returns<EmpRow[]>();
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  const { data: salaries } = useQuery({
    queryKey: ["salary-structures", isAdmin],
    queryFn: async () => {
      const { data } = await supabase.from("salary_structures").select("*");
      return data || [];
    },
    enabled: !!user,
  });

  const { data: payslips } = useQuery({
    queryKey: ["payslips"],
    queryFn: async () => {
      const { data } = await supabase.from("payslips").select("*").order("year", { ascending: false }).order("month", { ascending: false });
      return (data || []) as PayslipRow[];
    },
  });

  const saveSalary = useMutation({
    mutationFn: async () => {
      if (!editUser) throw new Error("Select an employee");
      const { error } = await supabase.from("salary_structures").upsert({
        user_id: editUser,
        basic: Number(basic) || 0,
        allowances: Number(allowances) || 0,
        deductions: Number(deductions) || 0,
        effective_from: new Date().toISOString().slice(0, 10),
      }, { onConflict: "user_id" });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Salary structure saved!");
      setEditUser(""); setBasic(""); setAllowances(""); setDeductions("");
      queryClient.invalidateQueries({ queryKey: ["salary-structures"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const runPayroll = useMutation({
    mutationFn: async () => {
      const m = Number(runMonth), y = Number(runYear);
      if (!salaries?.length) throw new Error("No salary structures defined");
      const rows = salaries.map((s) => ({
        user_id: s.user_id, month: m, year: y,
        gross: Number(s.basic) + Number(s.allowances),
        deductions: Number(s.deductions),
        net: Number(s.basic) + Number(s.allowances) - Number(s.deductions),
        generated_by: user!.id,
      }));
      const { error } = await supabase.from("payslips").upsert(rows, { onConflict: "user_id,month,year" });
      if (error) throw error;
      return rows.length;
    },
    onSuccess: (count) => {
      toast.success(`Payroll generated for ${count} employee${count === 1 ? "" : "s"}!`);
      queryClient.invalidateQueries({ queryKey: ["payslips"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const emp = (uid: string) => employees?.find((e) => e.user_id === uid);
  const salaryOf = (uid: string) => salaries?.find((s) => s.user_id === uid);
  const slipEmp = viewSlip ? emp(viewSlip.user_id) : undefined;

  const printSlip = () => {
    if (!viewSlip) return;
    const e = slipEmp;
    const s = salaryOf(viewSlip.user_id);
    const win = window.open("", "_blank", "width=800,height=900");
    if (!win) return;
    const row = (l: string, v: string, strong = false) =>
      `<tr><td>${l}</td><td style="text-align:right;${strong ? "font-weight:700" : ""}">${v}</td></tr>`;
    win.document.write(`<!doctype html><html><head><title>Payslip ${MONTHS[viewSlip.month - 1]} ${viewSlip.year}</title>
      <style>
        body{font-family:ui-sans-serif,system-ui,sans-serif;padding:40px;color:#111}
        h1{font-size:20px;margin:0 0 4px}
        .muted{color:#666;font-size:12px}
        .grid{display:grid;grid-template-columns:1fr 1fr;gap:6px 24px;margin:20px 0;font-size:13px}
        table{width:100%;border-collapse:collapse;font-size:13px}
        td{padding:6px 0;border-bottom:1px solid #eee}
        .total td{border-top:2px solid #111;border-bottom:none;font-size:15px}
      </style></head><body>
      <h1>${e?.company || "Payslip"}</h1>
      <div class="muted">Payslip for ${MONTHS[viewSlip.month - 1]} ${viewSlip.year}</div>
      <div class="grid">
        <div><b>Employee:</b> ${e?.full_name || "—"}</div>
        <div><b>Employee ID:</b> ${e?.employee_id || "—"}</div>
        <div><b>Designation:</b> ${e?.designation || "—"}</div>
        <div><b>Department:</b> ${e?.departments?.name || "—"}</div>
        <div><b>Employment type:</b> ${e?.employment_type || "—"}</div>
        <div><b>Date of joining:</b> ${e?.joining_date ? format(new Date(e.joining_date), "dd MMM yyyy") : "—"}</div>
      </div>
      <table>
        ${s ? row("Basic", fmt(Number(s.basic))) + row("Allowances", fmt(Number(s.allowances))) : ""}
        ${row("Gross Earnings", fmt(viewSlip.gross), true)}
        ${row("Deductions", "-" + fmt(viewSlip.deductions))}
        <tr class="total"><td>Net Pay</td><td style="text-align:right;font-weight:700">${fmt(viewSlip.net)}</td></tr>
      </table>
      <p class="muted" style="margin-top:24px">Generated on ${format(new Date(viewSlip.created_at), "dd MMM yyyy")}. This is a computer-generated payslip.</p>
      </body></html>`);
    win.document.close();
    win.focus();
    win.print();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><Wallet className="h-6 w-6" /> Payroll</h1>
        <p className="text-muted-foreground">{isAdmin ? "Salary structures and payslip generation" : "Your salary structure and payslips"}</p>
      </div>

      {isAdmin && (
        <>
          <Card>
            <CardHeader><CardTitle className="text-base">Salary Structure</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap items-end gap-3">
                <div className="space-y-1 min-w-56">
                  <Label>Employee</Label>
                  <Select value={editUser} onValueChange={(v) => {
                    setEditUser(v);
                    const s = salaryOf(v);
                    setBasic(s ? String(s.basic) : "");
                    setAllowances(s ? String(s.allowances) : "");
                    setDeductions(s ? String(s.deductions) : "");
                  }}>
                    <SelectTrigger><SelectValue placeholder="Select employee" /></SelectTrigger>
                    <SelectContent>
                      {employees?.map((e) => <SelectItem key={e.user_id} value={e.user_id}>{e.full_name} ({e.employee_id})</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1 w-32"><Label>Basic</Label><Input type="number" value={basic} onChange={(e) => setBasic(e.target.value)} /></div>
                <div className="space-y-1 w-32"><Label>Allowances</Label><Input type="number" value={allowances} onChange={(e) => setAllowances(e.target.value)} /></div>
                <div className="space-y-1 w-32"><Label>Deductions</Label><Input type="number" value={deductions} onChange={(e) => setDeductions(e.target.value)} /></div>
                <Button onClick={() => saveSalary.mutate()} disabled={saveSalary.isPending}><Pencil className="h-4 w-4 mr-2" /> Save</Button>
              </div>
              {editUser && emp(editUser) && (
                <p className="text-xs text-muted-foreground">
                  {emp(editUser)!.designation || "No designation"} · {emp(editUser)!.departments?.name || "No department"} · joined {format(new Date(emp(editUser)!.joining_date), "dd MMM yyyy")}
                  {" · "}Net monthly: <span className="font-medium text-foreground">{fmt((Number(basic) || 0) + (Number(allowances) || 0) - (Number(deductions) || 0))}</span>
                </p>
              )}

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Designation</TableHead>
                    <TableHead className="text-right">Basic</TableHead>
                    <TableHead className="text-right">Allowances</TableHead>
                    <TableHead className="text-right">Deductions</TableHead>
                    <TableHead className="text-right">Net</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {employees?.map((e) => {
                    const s = salaryOf(e.user_id);
                    return (
                      <TableRow key={e.user_id}>
                        <TableCell className="font-medium">{e.full_name} <span className="text-muted-foreground text-xs">({e.employee_id})</span></TableCell>
                        <TableCell className="text-muted-foreground">{e.designation || "—"}</TableCell>
                        {s ? (
                          <>
                            <TableCell className="text-right">{fmt(Number(s.basic))}</TableCell>
                            <TableCell className="text-right">{fmt(Number(s.allowances))}</TableCell>
                            <TableCell className="text-right">{fmt(Number(s.deductions))}</TableCell>
                            <TableCell className="text-right font-semibold">{fmt(Number(s.basic) + Number(s.allowances) - Number(s.deductions))}</TableCell>
                          </>
                        ) : (
                          <TableCell colSpan={4} className="text-right"><Badge variant="outline">Not set</Badge></TableCell>
                        )}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Run Payroll</CardTitle></CardHeader>
            <CardContent className="flex flex-wrap items-end gap-3">
              <div className="space-y-1 w-40">
                <Label>Month</Label>
                <Select value={runMonth} onValueChange={setRunMonth}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{MONTHS.map((m, i) => <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1 w-28"><Label>Year</Label><Input type="number" value={runYear} onChange={(e) => setRunYear(e.target.value)} /></div>
              <Button onClick={() => runPayroll.mutate()} disabled={runPayroll.isPending}>
                <Play className="h-4 w-4 mr-2" /> Generate Payslips
              </Button>
              <p className="text-xs text-muted-foreground self-center">One click generates payslips for all {salaries?.length || 0} employees with a salary structure (existing ones are overwritten).</p>
            </CardContent>
          </Card>
        </>
      )}

      {!isAdmin && employees?.[0] && (
        <Card>
          <CardHeader><CardTitle className="text-base">My Salary Structure</CardTitle></CardHeader>
          <CardContent className="text-sm space-y-1">
            <p className="text-muted-foreground">
              {employees[0].designation || "—"} · {employees[0].departments?.name || "—"} · joined {format(new Date(employees[0].joining_date), "dd MMM yyyy")}
            </p>
            {salaryOf(employees[0].user_id) ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                <div><p className="text-xs text-muted-foreground">Basic</p><p className="font-medium">{fmt(Number(salaryOf(employees[0].user_id)!.basic))}</p></div>
                <div><p className="text-xs text-muted-foreground">Allowances</p><p className="font-medium">{fmt(Number(salaryOf(employees[0].user_id)!.allowances))}</p></div>
                <div><p className="text-xs text-muted-foreground">Deductions</p><p className="font-medium">{fmt(Number(salaryOf(employees[0].user_id)!.deductions))}</p></div>
                <div><p className="text-xs text-muted-foreground">Net monthly</p><p className="font-semibold">{fmt(Number(salaryOf(employees[0].user_id)!.basic) + Number(salaryOf(employees[0].user_id)!.allowances) - Number(salaryOf(employees[0].user_id)!.deductions))}</p></div>
              </div>
            ) : (
              <p className="text-muted-foreground pt-2">No salary structure has been set for you yet.</p>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle className="text-base">Payslips</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                {isAdmin && <TableHead>Employee</TableHead>}
                <TableHead>Period</TableHead>
                <TableHead className="text-right">Gross</TableHead>
                <TableHead className="text-right">Deductions</TableHead>
                <TableHead className="text-right">Net Pay</TableHead>
                <TableHead className="w-16"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payslips?.map((p) => (
                <TableRow key={p.id}>
                  {isAdmin && <TableCell className="font-medium">{emp(p.user_id)?.full_name || "—"}</TableCell>}
                  <TableCell>{MONTHS[p.month - 1]} {p.year}</TableCell>
                  <TableCell className="text-right">{fmt(p.gross)}</TableCell>
                  <TableCell className="text-right">{fmt(p.deductions)}</TableCell>
                  <TableCell className="text-right font-semibold">{fmt(p.net)}</TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" onClick={() => setViewSlip(p)}><Printer className="h-4 w-4" /></Button>
                  </TableCell>
                </TableRow>
              ))}
              {payslips?.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No payslips yet</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!viewSlip} onOpenChange={() => setViewSlip(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Payslip</DialogTitle></DialogHeader>
          {viewSlip && (
            <div className="space-y-4">
              <div className="border-b pb-3">
                <p className="font-semibold">{slipEmp?.full_name || "Employee"}</p>
                {slipEmp?.employee_id && <p className="text-sm text-muted-foreground">{slipEmp.employee_id}</p>}
                <p className="text-sm text-muted-foreground">
                  {[slipEmp?.designation, slipEmp?.departments?.name].filter(Boolean).join(" · ") || "—"}
                </p>
                <p className="text-sm text-muted-foreground">{MONTHS[viewSlip.month - 1]} {viewSlip.year}</p>
              </div>
              <div className="space-y-2 text-sm">
                {salaryOf(viewSlip.user_id) && (
                  <>
                    <div className="flex justify-between"><span>Basic</span><span>{fmt(Number(salaryOf(viewSlip.user_id)!.basic))}</span></div>
                    <div className="flex justify-between"><span>Allowances</span><span>{fmt(Number(salaryOf(viewSlip.user_id)!.allowances))}</span></div>
                  </>
                )}
                <div className="flex justify-between"><span>Gross Earnings</span><span>{fmt(viewSlip.gross)}</span></div>
                <div className="flex justify-between text-destructive"><span>Deductions</span><span>-{fmt(viewSlip.deductions)}</span></div>
                <div className="flex justify-between font-bold border-t pt-2"><span>Net Pay</span><span>{fmt(viewSlip.net)}</span></div>
              </div>
              <p className="text-xs text-muted-foreground">Generated on {format(new Date(viewSlip.created_at), "MMM d, yyyy")}</p>
              <Button variant="outline" className="w-full" onClick={printSlip}><Printer className="h-4 w-4 mr-2" /> Print / Save as PDF</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
