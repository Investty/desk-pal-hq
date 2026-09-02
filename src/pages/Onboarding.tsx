import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ClipboardList, Plus, Trash2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

export default function Onboarding() {
  const queryClient = useQueryClient();
  const { isAdmin, isManager, user } = useAuth();
  const [task, setTask] = useState("");
  const [targetUser, setTargetUser] = useState("");
  const [checklistType, setChecklistType] = useState("joining");

  const { data: employees } = useQuery({
    queryKey: ["onboarding-employees"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("user_id, full_name, employee_id").eq("is_active", true).order("full_name");
      return data || [];
    },
    enabled: isAdmin,
  });

  const { data: tasks } = useQuery({
    queryKey: ["onboarding-tasks", isAdmin],
    queryFn: async () => {
      const { data } = await supabase.from("onboarding_checklists").select("*").order("created_at");
      return data || [];
    },
  });

  const addTask = useMutation({
    mutationFn: async () => {
      if (!task.trim() || !targetUser) throw new Error("Task and employee are required");
      const { error } = await supabase.from("onboarding_checklists").insert({
        user_id: targetUser, task: task.trim(), checklist_type: checklistType,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Task added!");
      setTask("");
      queryClient.invalidateQueries({ queryKey: ["onboarding-tasks"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggle = useMutation({
    mutationFn: async ({ id, is_done }: { id: string; is_done: boolean }) => {
      const { error } = await supabase.from("onboarding_checklists").update({ is_done }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["onboarding-tasks"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("onboarding_checklists").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["onboarding-tasks"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  // Group tasks by user
  const byUser = (tasks || []).reduce<Record<string, typeof tasks>>((acc, t) => {
    (acc[t.user_id] = acc[t.user_id] || []).push(t);
    return acc;
  }, {});

  const employeeName = (uid: string) =>
    employees?.find((e) => e.user_id === uid)?.full_name || (uid === user?.id ? "You" : "Employee");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><ClipboardList className="h-6 w-6" /> Onboarding & Offboarding</h1>
        <p className="text-muted-foreground">Track joining and exit checklists</p>
      </div>

      {isAdmin && (
        <Card>
          <CardHeader><CardTitle className="text-base">Add Task</CardTitle></CardHeader>
          <CardContent className="flex flex-wrap items-end gap-3">
            <div className="space-y-1 min-w-48">
              <Label>Employee</Label>
              <Select value={targetUser} onValueChange={setTargetUser}>
                <SelectTrigger><SelectValue placeholder="Select employee" /></SelectTrigger>
                <SelectContent>
                  {employees?.map((e) => <SelectItem key={e.user_id} value={e.user_id}>{e.full_name} ({e.employee_id})</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1 w-36">
              <Label>Type</Label>
              <Select value={checklistType} onValueChange={setChecklistType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="joining">Joining</SelectItem>
                  <SelectItem value="exit">Exit</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1 flex-1 min-w-48">
              <Label>Task</Label>
              <Input value={task} onChange={(e) => setTask(e.target.value)} placeholder="e.g., Submit ID proof" />
            </div>
            <Button onClick={() => addTask.mutate()} disabled={addTask.isPending}><Plus className="h-4 w-4 mr-2" /> Add</Button>
          </CardContent>
        </Card>
      )}

      {Object.entries(byUser).map(([uid, userTasks]) => {
        const done = userTasks!.filter((t) => t.is_done).length;
        const pct = userTasks!.length ? Math.round((done / userTasks!.length) * 100) : 0;
        const canToggle = uid === user?.id || isAdmin;
        return (
          <Card key={uid}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">{employeeName(uid)}</CardTitle>
                <span className="text-sm text-muted-foreground">{done}/{userTasks!.length} done</span>
              </div>
              <Progress value={pct} className="h-2" />
            </CardHeader>
            <CardContent className="space-y-2">
              {userTasks!.map((t) => (
                <div key={t.id} className="flex items-center gap-3 py-1">
                  <Checkbox
                    checked={t.is_done}
                    onCheckedChange={(c) => toggle.mutate({ id: t.id, is_done: !!c })}
                    disabled={!canToggle}
                  />
                  <span className={`flex-1 text-sm ${t.is_done ? "line-through text-muted-foreground" : ""}`}>{t.task}</span>
                  <Badge variant={t.checklist_type === "exit" ? "destructive" : "secondary"} className="capitalize">{t.checklist_type}</Badge>
                  {isAdmin && (
                    <Button variant="ghost" size="icon" onClick={() => remove.mutate(t.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        );
      })}
      {tasks?.length === 0 && (
        <Card><CardContent className="py-12 text-center text-muted-foreground">
          {isAdmin ? "No checklist tasks yet — add one above" : isManager ? "No checklists for your team" : "No checklist assigned to you yet"}
        </CardContent></Card>
      )}
    </div>
  );
}
