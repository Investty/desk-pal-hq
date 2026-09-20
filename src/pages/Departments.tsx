import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/components/ui/sonner";
import { format } from "date-fns";
import { Building2, Plus, Sparkles, Trash2 } from "lucide-react";

const suggestedDepartments = ["Engineering", "Sales", "Marketing", "Human Resources", "Finance", "Operations", "Support"];

export default function Departments() {
  const queryClient = useQueryClient();
  const { isHR } = useAuth();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [deleting, setDeleting] = useState<{ id: string; name: string } | null>(null);

  const { data: departments } = useQuery({
    queryKey: ["departments"],
    queryFn: async () => {
      const { data } = await supabase.from("departments").select("*").order("name");
      return data || [];
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      const clean = name.trim();
      if (clean.length < 2) throw new Error("Name must be at least 2 characters");
      if (clean.length > 50) throw new Error("Name must be 50 characters or less");
      if (description.trim().length > 200) throw new Error("Description must be 200 characters or less");
      const { error } = await supabase.from("departments").insert({ name: clean, description: description.trim() || null });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Department created!");
      setOpen(false);
      setName("");
      setDescription("");
      queryClient.invalidateQueries({ queryKey: ["departments"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const addSuggested = useMutation({
    mutationFn: async (deptName: string) => {
      const { error } = await supabase.from("departments").insert({ name: deptName });
      if (error) throw error;
    },
    onSuccess: (_d, deptName) => {
      toast.success(`${deptName} added!`);
      queryClient.invalidateQueries({ queryKey: ["departments"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const addAllSuggested = useMutation({
    mutationFn: async (names: string[]) => {
      const { error } = await supabase.from("departments").insert(names.map((n) => ({ name: n })));
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Suggested departments added!");
      queryClient.invalidateQueries({ queryKey: ["departments"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const { data: deptCounts } = useQuery({
    queryKey: ["department-member-counts"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("department_id").neq("status", "removed");
      const counts: Record<string, number> = {};
      (data || []).forEach((p) => {
        if (p.department_id) counts[p.department_id] = (counts[p.department_id] || 0) + 1;
      });
      return counts;
    },
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("departments").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Department deleted");
      setDeleting(null);
      queryClient.invalidateQueries({ queryKey: ["departments"] });
      queryClient.invalidateQueries({ queryKey: ["department-member-counts"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const existingNames = new Set((departments || []).map((d) => d.name.trim().toLowerCase()));
  const missingSuggestions = suggestedDepartments.filter((s) => !existingNames.has(s.toLowerCase()));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Building2 className="h-6 w-6" /> Departments</h1>
          <p className="text-muted-foreground">Manage organizational structure</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" /> Add Department</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New Department</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input value={name} maxLength={50} onChange={(e) => setName(e.target.value)} placeholder="e.g., Engineering" />
                <p className="text-xs text-muted-foreground">{name.trim().length}/50 characters</p>
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea value={description} maxLength={200} onChange={(e) => setDescription(e.target.value)} placeholder="Optional description..." />
                <p className="text-xs text-muted-foreground">{description.trim().length}/200 characters</p>
              </div>
              <Button onClick={() => create.mutate()} disabled={create.isPending} className="w-full">Create</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {missingSuggestions.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" /> Suggested departments
            </CardTitle>
            <p className="text-sm text-muted-foreground">Quick-start with common departments — click to add, or add all at once.</p>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-2">
            {missingSuggestions.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => addSuggested.mutate(s)}
                disabled={addSuggested.isPending || addAllSuggested.isPending}
                className="inline-flex items-center gap-1 rounded-full border border-border bg-secondary/50 px-3 py-1.5 text-sm hover:bg-secondary transition-colors disabled:opacity-50"
              >
                <Plus className="h-3.5 w-3.5" /> {s}
              </button>
            ))}
            <Button
              variant="outline"
              size="sm"
              onClick={() => addAllSuggested.mutate(missingSuggestions)}
              disabled={addSuggested.isPending || addAllSuggested.isPending}
            >
              Add all ({missingSuggestions.length})
            </Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Members</TableHead>
                <TableHead>Created</TableHead>
                {isHR && <TableHead className="text-right">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {departments?.map((d) => (
                <TableRow key={d.id}>
                  <TableCell className="font-medium">{d.name}</TableCell>
                  <TableCell className="text-muted-foreground">{d.description || "—"}</TableCell>
                  <TableCell>{deptCounts?.[d.id] ?? 0}</TableCell>
                  <TableCell>{format(new Date(d.created_at), "MMM d, yyyy")}</TableCell>
                  {isHR && (
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setDeleting({ id: d.id, name: d.name })}
                      >
                        <Trash2 className="h-4 w-4 mr-1" /> Delete
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
              {departments?.length === 0 && (
                <TableRow><TableCell colSpan={isHR ? 5 : 4} className="text-center text-muted-foreground py-8">No departments yet</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
