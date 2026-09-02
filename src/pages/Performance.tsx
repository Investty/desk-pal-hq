import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { format } from "date-fns";
import { Target, Plus, Star } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

const statusColor: Record<string, "outline" | "secondary" | "default"> = {
  pending: "outline", self_review: "secondary", manager_review: "secondary", complete: "default",
};

function Stars({ value, onChange, readOnly }: { value: number; onChange?: (v: number) => void; readOnly?: boolean }) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={`h-5 w-5 ${i <= value ? "fill-warning text-warning" : "text-muted-foreground"} ${readOnly ? "" : "cursor-pointer"}`}
          onClick={() => !readOnly && onChange?.(i)}
        />
      ))}
    </div>
  );
}

export default function Performance() {
  const queryClient = useQueryClient();
  const { isAdmin, isManager, user } = useAuth();
  const [cycleOpen, setCycleOpen] = useState(false);
  const [cycleName, setCycleName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [selectedCycle, setSelectedCycle] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [goals, setGoals] = useState("");
  const [selfRating, setSelfRating] = useState(0);
  const [selfComments, setSelfComments] = useState("");
  const [mgrRating, setMgrRating] = useState(0);
  const [mgrFeedback, setMgrFeedback] = useState("");

  const { data: cycles } = useQuery({
    queryKey: ["performance-cycles"],
    queryFn: async () => {
      const { data } = await supabase.from("performance_cycles").select("*").order("start_date", { ascending: false });
      if (data?.length && !selectedCycle) setSelectedCycle(data[0].id);
      return data || [];
    },
  });

  const { data: reviews } = useQuery({
    queryKey: ["performance-reviews", selectedCycle],
    queryFn: async () => {
      const { data } = await supabase.from("performance_reviews").select("*, profiles:user_id(full_name, employee_id)").eq("cycle_id", selectedCycle);
      return data || [];
    },
    enabled: !!selectedCycle,
  });

  const createCycle = useMutation({
    mutationFn: async () => {
      if (!cycleName.trim() || !startDate || !endDate) throw new Error("All fields required");
      const { error } = await supabase.from("performance_cycles").insert({ name: cycleName.trim(), start_date: startDate, end_date: endDate });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Review cycle created!");
      setCycleOpen(false); setCycleName(""); setStartDate(""); setEndDate("");
      queryClient.invalidateQueries({ queryKey: ["performance-cycles"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const enrollAll = useMutation({
    mutationFn: async () => {
      const { data: profiles } = await supabase.from("profiles").select("user_id").eq("is_active", true);
      const existing = new Set((reviews || []).map((r) => r.user_id));
      const rows = (profiles || []).filter((p) => !existing.has(p.user_id)).map((p) => ({ cycle_id: selectedCycle, user_id: p.user_id }));
      if (!rows.length) throw new Error("Everyone is already enrolled");
      const { error } = await supabase.from("performance_reviews").insert(rows);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Employees enrolled!");
      queryClient.invalidateQueries({ queryKey: ["performance-reviews"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const submitSelfReview = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("performance_reviews").update({
        goals, self_rating: selfRating || null, self_comments, status: "manager_review",
      }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Self review submitted!");
      setEditing(null);
      queryClient.invalidateQueries({ queryKey: ["performance-reviews"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const submitManagerReview = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("performance_reviews").update({
        manager_rating: mgrRating || null, manager_feedback: mgrFeedback, status: "complete",
      }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Review completed!");
      setEditing(null);
      queryClient.invalidateQueries({ queryKey: ["performance-reviews"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Target className="h-6 w-6" /> Performance Reviews</h1>
          <p className="text-muted-foreground">Goals, self-reviews, and manager feedback</p>
        </div>
        <div className="flex gap-3 items-end">
          <div className="space-y-1">
            <Label>Cycle</Label>
            <Select value={selectedCycle} onValueChange={setSelectedCycle}>
              <SelectTrigger className="w-56"><SelectValue placeholder="Select cycle" /></SelectTrigger>
              <SelectContent>
                {cycles?.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {isAdmin && (
            <>
              <Button variant="outline" onClick={() => enrollAll.mutate()} disabled={!selectedCycle || enrollAll.isPending}>Enroll All Employees</Button>
              <Dialog open={cycleOpen} onOpenChange={setCycleOpen}>
                <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" /> New Cycle</Button></DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>New Review Cycle</DialogTitle></DialogHeader>
                  <div className="space-y-4">
                    <div className="space-y-2"><Label>Name</Label><Input value={cycleName} onChange={(e) => setCycleName(e.target.value)} placeholder="e.g., H2 2026 Review" /></div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2"><Label>Start</Label><Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></div>
                      <div className="space-y-2"><Label>End</Label><Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} /></div>
                    </div>
                    <Button onClick={() => createCycle.mutate()} disabled={createCycle.isPending} className="w-full">Create</Button>
                  </div>
                </DialogContent>
              </Dialog>
            </>
          )}
        </div>
      </div>

      <div className="space-y-4">
        {reviews?.map((r) => {
          const prof = r.profiles as { full_name?: string; employee_id?: string } | null;
          const isOwn = r.user_id === user?.id;
          const canManagerReview = (isManager || isAdmin) && !isOwn;
          const isEditing = editing === r.id;
          return (
            <Card key={r.id}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-base">{prof?.full_name || "You"} <span className="text-xs text-muted-foreground">({prof?.employee_id})</span></CardTitle>
                <Badge variant={statusColor[r.status] || "outline"} className="capitalize">{r.status.replace("_", " ")}</Badge>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                {!isEditing && (
                  <>
                    <div><p className="font-medium">Goals</p><p className="text-muted-foreground whitespace-pre-wrap">{r.goals || "Not set"}</p></div>
                    <div className="flex gap-10 flex-wrap">
                      <div><p className="font-medium">Self Rating</p><Stars value={r.self_rating || 0} readOnly /></div>
                      <div><p className="font-medium">Manager Rating</p><Stars value={r.manager_rating || 0} readOnly /></div>
                    </div>
                    {r.self_comments && <div><p className="font-medium">Self Comments</p><p className="text-muted-foreground">{r.self_comments}</p></div>}
                    {r.manager_feedback && <div><p className="font-medium">Manager Feedback</p><p className="text-muted-foreground">{r.manager_feedback}</p></div>}
                    <div className="flex gap-2">
                      {isOwn && r.status !== "complete" && (
                        <Button size="sm" variant="outline" onClick={() => {
                          setEditing(r.id); setGoals(r.goals || ""); setSelfRating(r.self_rating || 0); setSelfComments(r.self_comments || "");
                        }}>Write Self Review</Button>
                      )}
                      {canManagerReview && (r.status === "manager_review" || r.status === "self_review" || r.status === "pending") && r.status !== "complete" && (
                        <Button size="sm" variant="outline" onClick={() => {
                          setEditing(r.id); setMgrRating(r.manager_rating || 0); setMgrFeedback(r.manager_feedback || "");
                        }}>Add Manager Review</Button>
                      )}
                    </div>
                  </>
                )}
                {isEditing && isOwn && (
                  <div className="space-y-3">
                    <div className="space-y-1"><Label>Goals</Label><Textarea value={goals} onChange={(e) => setGoals(e.target.value)} rows={3} /></div>
                    <div className="space-y-1"><Label>Self Rating</Label><Stars value={selfRating} onChange={setSelfRating} /></div>
                    <div className="space-y-1"><Label>Comments</Label><Textarea value={selfComments} onChange={(e) => setSelfComments(e.target.value)} rows={2} /></div>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => submitSelfReview.mutate(r.id)} disabled={submitSelfReview.isPending}>Submit</Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
                    </div>
                  </div>
                )}
                {isEditing && !isOwn && (
                  <div className="space-y-3">
                    <div className="space-y-1"><Label>Manager Rating</Label><Stars value={mgrRating} onChange={setMgrRating} /></div>
                    <div className="space-y-1"><Label>Feedback</Label><Textarea value={mgrFeedback} onChange={(e) => setMgrFeedback(e.target.value)} rows={3} /></div>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => submitManagerReview.mutate(r.id)} disabled={submitManagerReview.isPending}>Complete Review</Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
        {selectedCycle && reviews?.length === 0 && (
          <Card><CardContent className="py-12 text-center text-muted-foreground">
            No reviews in this cycle yet{isAdmin ? " — click Enroll All Employees" : ""}
          </CardContent></Card>
        )}
        {!selectedCycle && (
          <Card><CardContent className="py-12 text-center text-muted-foreground">No review cycles yet</CardContent></Card>
        )}
      </div>
    </div>
  );
}
