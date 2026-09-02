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
import { Wallet, Play, Printer, Pencil } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const fmt = (n: number) => `₹${Number(n).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

interface PayslipRow {
  id: string; user_id: string; month: number; year: number;
  gross: number; deductions: number; net: number; created_at: string;
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
  const [viewSlip, setViewSlip] = useState<(PayslipRow & { name?: string; employee_id?: string }) | null>(null);

  const { data: employees } = useQuery({
    queryKey: ["payroll-employees"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("user_id, full_name, employee_id").eq("is_active", true).order("full_name");
      return data || [];
    },
    enabled: isAdmin,
  });

  const { data: salaries } = useQuery({
    queryKey: ["salary-structures"],
    queryFn: async () => {
      const { data } = await supabase.from("salary_structures").select("*");
      return data || [];
    },
    enabled: isAdmin,
  });

  const { data: payslips } = useQuery({
    queryKey: ["payslips", isAdmin],
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
    },
    onSuccess: () => {
      toast.success("Payroll generated!");
      queryClient.invalidateQueries({ queryKey: ["payslips"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const empName = (uid: string) => employees?.find((e) => e.user_id === uid)?.full_name;
  const openSlip = (p: PayslipRow) => setViewSlip({ ...p, name: empName(p.user_id), employee_id: employees?.find((e) => e.user_id === p.user_id)?.employee_id });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><Wallet className="h-6 w-6" /> Payroll</h1>
        <p className="text-muted-foreground">{isAdmin ? "Salary structures and payslip generation" : "Your payslips"}</p>
      </div>

      {isAdmin && (
        <>
          <Card>
            <CardHeader><CardTitle className="text-base">Salary Structure</CardTitle></CardHeader>
            <CardContent className="flex flex-wrap items-end gap-3">
              <div className="space-y-1 min-w-48">
                <Label>Employee</Label>
                <Select value={editUser} onValueChange={(v) => {
                  setEditUser(v);
                  const s = salaries?.find((x) => x.user_id === v);
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
              <p className="text-xs text-muted-foreground self-center">Generates payslips for all employees with a salary structure (existing ones are overwritten).</p>
            </CardContent>
          </Card>
        </>
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
                  {isAdmin && <TableCell className="font-medium">{empName(p.user_id) || "—"}</TableCell>}
                  <TableCell>{MONTHS[p.month - 1]} {p.year}</TableCell>
                  <TableCell className="text-right">{fmt(p.gross)}</TableCell>
                  <TableCell className="text-right">{fmt(p.deductions)}</TableCell>
                  <TableCell className="text-right font-semibold">{fmt(p.net)}</TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" onClick={() => openSlip(p)}><Printer className="h-4 w-4" /></Button>
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
            <div className="space-y-4" id="payslip-print">
              <div className="border-b pb-3">
                <p className="font-semibold">{viewSlip.name || "Employee"}</p>
                {viewSlip.employee_id && <p className="text-sm text-muted-foreground">{viewSlip.employee_id}</p>}
                <p className="text-sm text-muted-foreground">{MONTHS[viewSlip.month - 1]} {viewSlip.year}</p>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span>Gross Earnings</span><span>{fmt(viewSlip.gross)}</span></div>
                <div className="flex justify-between text-destructive"><span>Deductions</span><span>-{fmt(viewSlip.deductions)}</span></div>
                <div className="flex justify-between font-bold border-t pt-2"><span>Net Pay</span><span>{fmt(viewSlip.net)}</span></div>
              </div>
              <p className="text-xs text-muted-foreground">Generated on {format(new Date(viewSlip.created_at), "MMM d, yyyy")}</p>
              <Button variant="outline" className="w-full" onClick={() => window.print()}><Printer className="h-4 w-4 mr-2" /> Print / Save as PDF</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
