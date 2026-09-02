import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ShieldCheck } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

type Role = "admin" | "manager" | "employee";

export default function UserRoles() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const { data: users } = useQuery({
    queryKey: ["all-user-roles"],
    queryFn: async () => {
      const { data: profiles } = await supabase.from("profiles").select("user_id, full_name, email, employee_id").order("full_name");
      const { data: roles } = await supabase.from("user_roles").select("user_id, role");
      return (profiles || []).map((p) => ({
        ...p,
        role: (roles?.find((r) => r.user_id === p.user_id)?.role || "employee") as Role,
      }));
    },
  });

  const changeRole = useMutation({
    mutationFn: async ({ userId, newRole }: { userId: string; newRole: Role }) => {
      const { error: delErr } = await supabase.from("user_roles").delete().eq("user_id", userId);
      if (delErr) throw delErr;
      const { error } = await supabase.from("user_roles").insert({ user_id: userId, role: newRole });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Role updated!");
      queryClient.invalidateQueries({ queryKey: ["all-user-roles"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><ShieldCheck className="h-6 w-6" /> User Roles</h1>
        <p className="text-muted-foreground">Promote or demote users between admin, manager, and employee</p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Current Role</TableHead>
                <TableHead className="w-48">Change Role</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users?.map((u) => (
                <TableRow key={u.user_id}>
                  <TableCell className="font-medium">{u.full_name} <span className="text-muted-foreground text-xs">({u.employee_id})</span></TableCell>
                  <TableCell className="text-muted-foreground">{u.email}</TableCell>
                  <TableCell><Badge variant={u.role === "admin" ? "default" : u.role === "manager" ? "secondary" : "outline"} className="capitalize">{u.role}</Badge></TableCell>
                  <TableCell>
                    <Select
                      value={u.role}
                      onValueChange={(v) => changeRole.mutate({ userId: u.user_id, newRole: v as Role })}
                      disabled={u.user_id === user?.id}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="employee">Employee</SelectItem>
                        <SelectItem value="manager">Manager</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <p className="text-xs text-muted-foreground">You cannot change your own role.</p>
    </div>
  );
}
