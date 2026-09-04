import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { format } from "date-fns";
import { Wallet, Play, Printer, IndianRupee } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { computeSalary, formatINR as fmt } from "@/lib/salary";

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

interface PayslipRow {
  id: string; user_id: string; month: number; year: number;
  gross: number; deductions: number; net: number; created_at: string;
  basic: number; da: number; hra: number; special_allowance: number;
  pf: number; professional_tax: number; tds: number;
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
  const [runMonth, setRunMonth] = useState(String(now.getMonth() + 1));
  const [runYear, setRunYear] = useState(String(now.getFullYear()));
  const [viewSlip, setViewSlip] = useState<PayslipRow | null>(null);

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
    queryKey: ["salary-structures"],
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

  const runPayroll = useMutation({
    mutationFn: async () => {
      const m = Number(runMonth), y = Number(runYear);
      if (!salaries?.length) throw new Error("No salary structures defined — add salaries in Salary Entry first");
      const rows = salaries.map((s) => {
        const c = computeSalary(s);
        return {
          user_id: s.user_id, month: m, year: y,
          basic: c.basic, da: c.da, hra: c.hra, special_allowance: c.special_allowance,
          pf: c.pf, professional_tax: c.professional_tax, tds: c.tds,
          gross: c.gross, deductions: c.deductions, net: c.net,
          generated_by: user!.id,
        };
      });
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
  const slipEmp = viewSlip ? emp(viewSlip.user_id) : undefined;

  const printSlip = () => {
    if (!viewSlip) return;
    const e = slipEmp;
    const p = viewSlip;
    const win = window.open("", "_blank", "width=800,height=900");
    if (!win) return;
    const row = (l: string, v: string, strong = false) =>
      `<tr><td>${l}</td><td style="text-align:right;${strong ? "font-weight:700" : ""}">${v}</td></tr>`;
    win.document.write(`<!doctype html><html><head><title>Payslip ${MONTHS[p.month - 1]} ${p.year}</title>
      <style>
        body{font-family:ui-sans-serif,system-ui,sans-serif;padding:40px;color:#111}
        h1{font-size:20px;margin:0 0 4px}
        h2{font-size:13px;margin:18px 0 6px;text-transform:uppercase;letter-spacing:.05em;color:#555}
        .muted{color:#666;font-size:12px}
        .grid{display:grid;grid-template-columns:1fr 1fr;gap:6px 24px;margin:20px 0;font-size:13px}
        table{width:100%;border-collapse:collapse;font-size:13px}
        td{padding:6px 0;border-bottom:1px solid #eee}
        .total td{border-top:2px solid #111;border-bottom:none;font-size:15px}
      </style></head><body>
      <h1>${e?.company || "Payslip"}</h1>
      <div class="muted">Payslip for ${MONTHS[p.month - 1]} ${p.year}</div>
      <div class="grid">
        <div><b>Employee:</b> ${e?.full_name || "—"}</div>
        <div><b>Employee ID:</b> ${e?.employee_id || "—"}</div>
        <div><b>Designation:</b> ${e?.designation || "—"}</div>
        <div><b>Department:</b> ${e?.departments?.name || "—"}</div>
        <div><b>Employment type:</b> ${e?.employment_type || "—"}</div>
        <div><b>Date of joining:</b> ${e?.joining_date ? format(new Date(e.joining_date), "dd MMM yyyy") : "—"}</div>
      </div>
      <h2>Earnings</h2>
      <table>
        ${row("Basic pay", fmt(p.basic))}
        ${row("Dearness Allowance (DA)", fmt(p.da))}
        ${row("HRA", fmt(p.hra))}
        ${row("Other allowances", fmt(p.special_allowance))}
        ${row("Gross earnings", fmt(p.gross), true)}
      </table>
      <h2>Deductions</h2>
      <table>
        ${row("Provident Fund (PF)", fmt(p.pf))}
        ${row("Professional tax", fmt(p.professional_tax))}
        ${row("Income tax (TDS)", fmt(p.tds))}
        ${row("Total deductions", fmt(p.deductions), true)}
        <tr class="total"><td>Net Pay</td><td style="text-align:right;font-weight:700">${fmt(p.net)}</td></tr>
      </table>
      <p class="muted" style="margin-top:24px">Generated on ${format(new Date(p.created_at), "dd MMM yyyy")}. This is a computer-generated payslip.</p>
      </body></html>`);
    win.document.close();
    win.focus();
    win.print();
  };

  const mySalary = employees?.[0] ? salaries?.find((s) => s.user_id === employees[0].user_id) : undefined;
  const myCalc = mySalary ? computeSalary(mySalary) : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Wallet className="h-6 w-6" /> Payroll</h1>
          <p className="text-muted-foreground">{isAdmin ? "Generate payslips from saved salary structures" : "Your salary structure and payslips"}</p>
        </div>
        {isAdmin && (
          <Button variant="outline" asChild><Link to="/salary"><IndianRupee className="h-4 w-4 mr-2" /> Salary Entry</Link></Button>
        )}
      </div>

      {isAdmin && (
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
            <p className="text-xs text-muted-foreground self-center">
              Generates payslips for all {salaries?.length || 0} employees with a salary structure. PF is computed on Basic + DA (existing payslips are overwritten).
            </p>
          </CardContent>
        </Card>
      )}

      {!isAdmin && employees?.[0] && (
        <Card>
          <CardHeader><CardTitle className="text-base">My Salary Structure</CardTitle></CardHeader>
          <CardContent className="text-sm space-y-2">
            <p className="text-muted-foreground">
              {employees[0].designation || "—"} · {employees[0].departments?.name || "—"} · joined {format(new Date(employees[0].joining_date), "dd MMM yyyy")}
            </p>
            {myCalc ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                <div><p className="text-xs text-muted-foreground">Basic</p><p className="font-medium">{fmt(myCalc.basic)}</p></div>
                <div><p className="text-xs text-muted-foreground">DA</p><p className="font-medium">{fmt(myCalc.da)}</p></div>
                <div><p className="text-xs text-muted-foreground">HRA</p><p className="font-medium">{fmt(myCalc.hra)}</p></div>
                <div><p className="text-xs text-muted-foreground">Other allowances</p><p className="font-medium">{fmt(myCalc.special_allowance)}</p></div>
                <div><p className="text-xs text-muted-foreground">Gross</p><p className="font-medium">{fmt(myCalc.gross)}</p></div>
                <div><p className="text-xs text-muted-foreground">PF ({myCalc.pf_rate}%)</p><p className="font-medium">{fmt(myCalc.pf)}</p></div>
                <div><p className="text-xs text-muted-foreground">Deductions</p><p className="font-medium">{fmt(myCalc.deductions)}</p></div>
                <div><p className="text-xs text-muted-foreground">Net monthly</p><p className="font-semibold">{fmt(myCalc.net)}</p></div>
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
                <TableHead className="text-right">Basic</TableHead>
                <TableHead className="text-right">DA</TableHead>
                <TableHead className="text-right">HRA</TableHead>
                <TableHead className="text-right">Gross</TableHead>
                <TableHead className="text-right">PF</TableHead>
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
                  <TableCell className="text-right">{fmt(p.basic)}</TableCell>
                  <TableCell className="text-right">{fmt(p.da)}</TableCell>
                  <TableCell className="text-right">{fmt(p.hra)}</TableCell>
                  <TableCell className="text-right">{fmt(p.gross)}</TableCell>
                  <TableCell className="text-right">{fmt(p.pf)}</TableCell>
                  <TableCell className="text-right">{fmt(p.deductions)}</TableCell>
                  <TableCell className="text-right font-semibold">{fmt(p.net)}</TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" onClick={() => setViewSlip(p)}><Printer className="h-4 w-4" /></Button>
                  </TableCell>
                </TableRow>
              ))}
              {payslips?.length === 0 && (
                <TableRow><TableCell colSpan={10} className="text-center text-muted-foreground py-8">No payslips yet</TableCell></TableRow>
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
                <p className="text-xs font-medium text-muted-foreground uppercase">Earnings</p>
                <div className="flex justify-between"><span>Basic pay</span><span>{fmt(viewSlip.basic)}</span></div>
                <div className="flex justify-between"><span>Dearness Allowance</span><span>{fmt(viewSlip.da)}</span></div>
                <div className="flex justify-between"><span>HRA</span><span>{fmt(viewSlip.hra)}</span></div>
                <div className="flex justify-between"><span>Other allowances</span><span>{fmt(viewSlip.special_allowance)}</span></div>
                <div className="flex justify-between font-medium border-t pt-2"><span>Gross earnings</span><span>{fmt(viewSlip.gross)}</span></div>
                <p className="text-xs font-medium text-muted-foreground uppercase pt-2">Deductions</p>
                <div className="flex justify-between text-destructive"><span>Provident Fund</span><span>-{fmt(viewSlip.pf)}</span></div>
                <div className="flex justify-between text-destructive"><span>Professional tax</span><span>-{fmt(viewSlip.professional_tax)}</span></div>
                <div className="flex justify-between text-destructive"><span>Income tax (TDS)</span><span>-{fmt(viewSlip.tds)}</span></div>
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
