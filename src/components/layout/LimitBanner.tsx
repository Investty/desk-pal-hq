import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { AlertTriangle } from "lucide-react";

export default function LimitBanner() {
  const { company, isHR, supportSession } = useAuth();

  const { data } = useQuery({
    queryKey: ["company-limit-usage", company?.id],
    enabled: !!company && isHR && !supportSession,
    queryFn: async () => {
      const [limits, people, docs] = await Promise.all([
        supabase.from("company_limits").select("*").eq("company_id", company!.id).maybeSingle(),
        supabase.from("profiles").select("id", { count: "exact", head: true }).eq("status", "active"),
        supabase.from("employee_documents").select("file_size_bytes"),
      ]);
      const usedBytes = (docs.data ?? []).reduce((s, d) => s + Number(d.file_size_bytes || 0), 0);
      return {
        warnPct: limits.data?.soft_warn_pct ?? 90,
        storageLimitMb: limits.data?.storage_mb_limit ?? 1024,
        usedMb: usedBytes / 1048576,
        seats: company!.seat_limit,
        seatsUsed: people.count ?? 0,
      };
    },
  });

  if (!data) return null;

  const messages: string[] = [];
  const seatPct = data.seats ? (data.seatsUsed / data.seats) * 100 : 0;
  const storagePct = data.storageLimitMb ? (data.usedMb / data.storageLimitMb) * 100 : 0;

  if (seatPct >= data.warnPct) {
    messages.push(`${data.seatsUsed} of ${data.seats} employee seats used`);
  }
  if (storagePct >= data.warnPct) {
    messages.push(`${data.usedMb.toFixed(0)} MB of ${data.storageLimitMb} MB document storage used`);
  }
  if (messages.length === 0) return null;

  return (
    <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm">
      <AlertTriangle className="h-4 w-4 mt-0.5 text-destructive" />
      <p>You are close to your plan limits: {messages.join(" · ")}. Contact support to raise them.</p>
    </div>
  );
}
