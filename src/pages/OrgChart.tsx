import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Network } from "lucide-react";

interface Node {
  id: string;
  full_name: string;
  employee_id: string;
  manager_id: string | null;
  department: string | null;
  children: Node[];
}

function OrgNode({ node }: { node: Node }) {
  const initials = node.full_name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
  return (
    <div className="flex flex-col items-center">
      <Card className="w-52 shrink-0">
        <CardContent className="p-4 flex items-center gap-3">
          <Avatar className="h-9 w-9 shrink-0">
            <AvatarFallback className="bg-primary/10 text-primary text-xs">{initials}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">{node.full_name}</p>
            <p className="text-xs text-muted-foreground truncate">{node.department || node.employee_id}</p>
          </div>
        </CardContent>
      </Card>
      {node.children.length > 0 && (
        <>
          <div className="w-px h-6 bg-border" />
          <div className="flex gap-6 items-start relative">
            {node.children.length > 1 && (
              <div className="absolute top-0 left-[104px] right-[104px] h-px bg-border" />
            )}
            {node.children.map((c) => (
              <div key={c.id} className="flex flex-col items-center">
                {node.children.length > 1 && <div className="w-px h-6 bg-border" />}
                <OrgNode node={c} />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default function OrgChart() {
  const { data: roots } = useQuery({
    queryKey: ["org-chart"],
    queryFn: async () => {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, employee_id, manager_id, departments(name)")
        .eq("is_active", true);
      const nodes: Node[] = (profiles || []).map((p) => ({
        id: p.id,
        full_name: p.full_name,
        employee_id: p.employee_id,
        manager_id: p.manager_id,
        department: (p.departments as { name?: string } | null)?.name || null,
        children: [],
      }));
      const byId = new Map(nodes.map((n) => [n.id, n]));
      const roots: Node[] = [];
      nodes.forEach((n) => {
        if (n.manager_id && byId.has(n.manager_id)) {
          byId.get(n.manager_id)!.children.push(n);
        } else {
          roots.push(n);
        }
      });
      return roots;
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><Network className="h-6 w-6" /> Org Chart</h1>
        <p className="text-muted-foreground">Reporting hierarchy based on manager assignments</p>
      </div>
      <div className="overflow-x-auto pb-6">
        <div className="flex gap-10 justify-center min-w-max px-4">
          {roots?.map((r) => <OrgNode key={r.id} node={r} />)}
          {roots?.length === 0 && <p className="text-muted-foreground py-12">No organization data available</p>}
        </div>
      </div>
    </div>
  );
}
