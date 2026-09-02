import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { format } from "date-fns";
import { CalendarPlus, Trash2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

export default function Holidays() {
  const queryClient = useQueryClient();
  const { isAdmin } = useAuth();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [date, setDate] = useState("");
  const [recurring, setRecurring] = useState(false);

  const { data: holidays } = useQuery({
    queryKey: ["holidays"],
    queryFn: async () => {
      const { data } = await supabase.from("holidays").select("*").order("date");
      return data || [];
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      if (!name.trim() || !date) throw new Error("Name and date are required");
      const { error } = await supabase.from("holidays").insert({ name: name.trim(), date, is_recurring: recurring });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Holiday added!");
      setOpen(false); setName(""); setDate(""); setRecurring(false);
      queryClient.invalidateQueries({ queryKey: ["holidays"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("holidays").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Holiday removed");
      queryClient.invalidateQueries({ queryKey: ["holidays"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><CalendarPlus className="h-6 w-6" /> Holidays</h1>
          <p className="text-muted-foreground">Company holiday calendar</p>
        </div>
        {isAdmin && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button>Add Holiday</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>New Holiday</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Name</Label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., Diwali" />
                </div>
                <div className="space-y-2">
                  <Label>Date</Label>
                  <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox id="rec" checked={recurring} onCheckedChange={(c) => setRecurring(!!c)} />
                  <Label htmlFor="rec">Repeats every year</Label>
                </div>
                <Button onClick={() => create.mutate()} disabled={create.isPending} className="w-full">Add</Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Holiday</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Recurring</TableHead>
                {isAdmin && <TableHead className="w-16"></TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {holidays?.map((h) => (
                <TableRow key={h.id}>
                  <TableCell className="font-medium">{h.name}</TableCell>
                  <TableCell>{format(new Date(h.date), "EEEE, MMM d, yyyy")}</TableCell>
                  <TableCell>{h.is_recurring ? "Yes" : "No"}</TableCell>
                  {isAdmin && (
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={() => remove.mutate(h.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
              {holidays?.length === 0 && (
                <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">No holidays added yet</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
