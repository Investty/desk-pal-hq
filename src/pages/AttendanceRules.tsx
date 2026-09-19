import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/components/ui/sonner";
import { ClipboardCheck } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

type Rules = {
  early_leave_enabled: boolean;
  early_leave_max_hours: number;
  early_leave_max_per_month: number;
  regularization_enabled: boolean;
  regularization_max_per_month: number;
  regularization_backdate_days: number;
};

const DEFAULTS: Rules = {
  early_leave_enabled: true,
  early_leave_max_hours: 2,
  early_leave_max_per_month: 2,
  regularization_enabled: true,
  regularization_max_per_month: 3,
  regularization_backdate_days: 15,
};

export default function AttendanceRules() {
  const { company } = useAuth();
  const qc = useQueryClient();
  const [form, setForm] = useState<Rules>(DEFAULTS);

  const { data } = useQuery({
    queryKey: ["attendance-rules"],
    queryFn: async () => {
      const { data } = await supabase.from("attendance_rules").select("*").maybeSingle();
      return data;
    },
  });

  useEffect(() => {
    if (data) setForm({ ...DEFAULTS, ...data } as Rules);
  }, [data]);

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        company_id: company!.id,
        ...form,
        early_leave_max_hours: Math.max(0.5, Math.min(8, Number(form.early_leave_max_hours) || 0.5)),
        early_leave_max_per_month: Math.max(0, Math.min(31, Number(form.early_leave_max_per_month) || 0)),
        regularization_max_per_month: Math.max(0, Math.min(31, Number(form.regularization_max_per_month) || 0)),
        regularization_backdate_days: Math.max(1, Math.min(90, Number(form.regularization_backdate_days) || 1)),
      };
      const { error } = await supabase.from("attendance_rules").upsert(payload, { onConflict: "company_id" });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Attendance rules saved");
      qc.invalidateQueries({ queryKey: ["attendance-rules"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const num = (k: keyof Rules) => ({
    value: String(form[k] ?? ""),
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value === "" ? 0 : Number(e.target.value) }),
  });

  return (
    <div className="space-y-6">
      <h1>Attendance rules</h1>
      <p className="text-muted-foreground -mt-4">Decide what employees can request and how often.</p>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><ClipboardCheck className="h-5 w-5" /> Early leave</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-md border border-border p-3">
            <div>
              <p className="font-medium text-sm">Allow early leave requests</p>
              <p className="text-xs text-muted-foreground">When off, employees will not see this option at all</p>
            </div>
            <Switch checked={form.early_leave_enabled} onCheckedChange={(v) => setForm({ ...form, early_leave_enabled: v })} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Maximum hours early, per request</Label>
              <Input type="number" step="0.5" min={0.5} max={8} disabled={!form.early_leave_enabled} {...num("early_leave_max_hours")} />
            </div>
            <div className="space-y-2">
              <Label>How many per month</Label>
              <Input type="number" min={0} max={31} disabled={!form.early_leave_enabled} {...num("early_leave_max_per_month")} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Attendance correction (missed check-in / check-out)</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-md border border-border p-3">
            <div>
              <p className="font-medium text-sm">Allow correction requests</p>
              <p className="text-xs text-muted-foreground">When off, employees must go to HR for any fix</p>
            </div>
            <Switch checked={form.regularization_enabled} onCheckedChange={(v) => setForm({ ...form, regularization_enabled: v })} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>How many per month</Label>
              <Input type="number" min={0} max={31} disabled={!form.regularization_enabled} {...num("regularization_max_per_month")} />
            </div>
            <div className="space-y-2">
              <Label>How far back a date can be corrected (days)</Label>
              <Input type="number" min={1} max={90} disabled={!form.regularization_enabled} {...num("regularization_backdate_days")} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Button disabled={save.isPending} onClick={() => save.mutate()}>Save rules</Button>
    </div>
  );
}
