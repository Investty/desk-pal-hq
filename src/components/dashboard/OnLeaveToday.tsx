import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { PalmtreeIcon } from "lucide-react";
import { format } from "date-fns";

export default function OnLeaveToday() {
  const { data: people } = useQuery({
    queryKey: ["on-leave-today"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_people_on_leave_today");
      if (error) throw error;
      return data || [];
    },
  });

  const initials = (name: string) =>
    name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <PalmtreeIcon className="h-4 w-4" /> On Leave Today
          {people && people.length > 0 && (
            <Badge variant="secondary" className="ml-1">{people.length}</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {people?.map((p, i) => (
          <div key={`${p.full_name}-${i}`} className="flex items-center gap-3">
            <Avatar className="h-8 w-8">
              <AvatarFallback className="text-xs">{initials(p.full_name)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium truncate">{p.full_name}</p>
              <p className="text-xs text-muted-foreground">
                {format(new Date(p.start_date), "MMM d")} – {format(new Date(p.end_date), "MMM d")}
              </p>
            </div>
            <Badge variant="outline" className="capitalize shrink-0">{p.leave_type}</Badge>
          </div>
        ))}
        {people?.length === 0 && (
          <p className="text-sm text-muted-foreground">Everyone is in today 🎉</p>
        )}
      </CardContent>
    </Card>
  );
}
