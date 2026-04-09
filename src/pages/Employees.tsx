import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { Search, Users } from "lucide-react";

export default function Employees() {
  const [search, setSearch] = useState("");

  const { data: employees, isLoading } = useQuery({
    queryKey: ["employees"],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("*, departments:department_id(name)")
        .order("full_name");
      return data || [];
    },
  });

  const filtered = employees?.filter((e) =>
    e.full_name.toLowerCase().includes(search.toLowerCase()) ||
    e.email.toLowerCase().includes(search.toLowerCase()) ||
    e.employee_id.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Employees</h1>
          <p className="text-muted-foreground">Manage your team members</p>
        </div>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search employees..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse"><CardContent className="h-32" /></Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered?.map((emp) => {
            const initials = emp.full_name.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase();
            const dept = (emp as any).departments?.name;
            return (
              <Card key={emp.id} className="hover:shadow-md transition-shadow">
                <CardContent className="pt-6">
                  <div className="flex items-start gap-4">
                    <Avatar className="h-12 w-12">
                      <AvatarFallback className="bg-primary/10 text-primary font-semibold">{initials}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold truncate">{emp.full_name}</h3>
                      <p className="text-sm text-muted-foreground truncate">{emp.email}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <Badge variant="secondary" className="text-xs">{emp.employee_id}</Badge>
                        {dept && <Badge variant="outline" className="text-xs">{dept}</Badge>}
                      </div>
                      <Badge variant={emp.is_active ? "default" : "destructive"} className="mt-2 text-xs">
                        {emp.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
          {filtered?.length === 0 && (
            <div className="col-span-full text-center py-12 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No employees found</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
