import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Info, Megaphone, X } from "lucide-react";

interface BroadcastItem {
  id: string; title: string; body: string; severity: string;
}

const STYLES: Record<string, { wrap: string; icon: typeof Info }> = {
  info: { wrap: "border-primary/40 bg-primary/10", icon: Megaphone },
  warning: { wrap: "border-warning/50 bg-warning/10", icon: Info },
  critical: { wrap: "border-destructive/50 bg-destructive/10", icon: AlertTriangle },
};

export default function BroadcastBanner() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data } = useQuery({
    queryKey: ["my-broadcasts", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("my_broadcasts");
      if (error) throw error;
      return (data ?? []) as unknown as BroadcastItem[];
    },
  });

  const dismiss = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("broadcast_reads").insert({ broadcast_id: id, user_id: user!.id });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["my-broadcasts", user?.id] }),
  });

  if (!data || data.length === 0) return null;

  return (
    <div className="space-y-2">
      {data.map((b) => {
        const style = STYLES[b.severity] ?? STYLES.info;
        const Icon = style.icon;
        return (
          <div key={b.id} className={`flex items-start gap-3 rounded-md border px-4 py-3 text-sm ${style.wrap}`}>
            <Icon className="h-4 w-4 mt-0.5 shrink-0" />
            <div className="flex-1">
              <p className="font-medium">{b.title}</p>
              <p className="text-muted-foreground whitespace-pre-line">{b.body}</p>
            </div>
            <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => dismiss.mutate(b.id)} aria-label="Dismiss message">
              <X className="h-4 w-4" />
            </Button>
          </div>
        );
      })}
    </div>
  );
}
