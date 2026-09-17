import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Trash2 } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import SheetImporter from "@/components/import/SheetImporter";
import { attendanceFields, employeeFields, leaveFields, shiftFields } from "@/lib/importSheet";

interface PendingRow {
  id: string;
  full_name: string;
  email: string;
  employee_code: string | null;
  designation: string | null;
  shift_name: string | null;
  status: string;
  created_at: string;
}

interface BatchRow {
  id: string;
  kind: string;
  filename: string | null;
  imported_rows: number;
  skipped_rows: number;
  created_at: string;
}

export default function DataImport() {
  const queryClient = useQueryClient();

  const { data: pending } = useQuery({
    queryKey: ["pending-employees"],
    queryFn: async () => {
      const { data } = await supabase
        .from("pending_employees")
        .select("id, full_name, email, employee_code, designation, shift_name, status, created_at")
        .order("created_at", { ascending: false })
        .limit(100);
      return (data || []) as PendingRow[];
    },
  });

  const { data: batches } = useQuery({
    queryKey: ["import-batches"],
    queryFn: async () => {
      const { data } = await supabase
        .from("import_batches")
        .select("id, kind, filename, imported_rows, skipped_rows, created_at")
        .order("created_at", { ascending: false })
        .limit(10);
      return (data || []) as BatchRow[];
    },
  });

  const removePending = async (id: string) => {
    const { error } = await supabase.from("pending_employees").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Removed from the waiting list");
    queryClient.invalidateQueries({ queryKey: ["pending-employees"] });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Import data</h1>
        <p className="text-muted-foreground">
          Bring your people and working hours in from an Excel, CSV or Tally export instead of typing them one by one.
        </p>
      </div>

      <Tabs defaultValue="people">
        <TabsList>
          <TabsTrigger value="people">People</TabsTrigger>
          <TabsTrigger value="shifts">Shifts</TabsTrigger>
          <TabsTrigger value="attendance">Attendance</TabsTrigger>
          <TabsTrigger value="leave">Leave</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        <TabsContent value="people" className="mt-4 space-y-6">
          <SheetImporter
            title="Import people"
            description="Each person is added to a waiting list with their details. When they sign up with the company code, everything is filled in for them automatically."
            fields={employeeFields}
            rpc="import_employees"
            templateName="employee-import-template.csv"
            sampleRow={["Asha Nair", "asha.nair@example.com", "EMP001", "9876543210", "Accounts Executive", "Finance", "2024-04-01", "1995-08-12", "manager@example.com", "General"]}
          />

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Waiting to join ({pending?.length ?? 0})</CardTitle>
              <CardDescription>Imported people who have not signed in yet.</CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Code</TableHead>
                    <TableHead>Designation</TableHead>
                    <TableHead>Shift</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(pending ?? []).map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{p.full_name}</TableCell>
                      <TableCell>{p.email}</TableCell>
                      <TableCell>{p.employee_code || "—"}</TableCell>
                      <TableCell>{p.designation || "—"}</TableCell>
                      <TableCell>{p.shift_name || "—"}</TableCell>
                      <TableCell>
                        <Badge variant={p.status === "joined" ? "secondary" : "outline"}>
                          {p.status === "joined" ? "Joined" : "Waiting"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {p.status !== "joined" && (
                          <Button variant="ghost" size="sm" onClick={() => removePending(p.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {!pending?.length && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                        Nobody imported yet
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="shifts" className="mt-4">
          <SheetImporter
            title="Import shifts"
            description="Create or update the company's working-hour patterns. A shift with the same name is updated rather than duplicated."
            fields={shiftFields}
            rpc="import_shifts"
            templateName="shift-import-template.csv"
            sampleRow={["General", "09:30", "18:30", "60", "15"]}
          />
        </TabsContent>

        <TabsContent value="attendance" className="mt-4">
          <SheetImporter
            title="Import past attendance"
            description="Load previous months' attendance. Each row is matched to an employee by email; a day already recorded is updated rather than duplicated. Hours are worked out from the times when not given, including night shifts that end the next morning."
            fields={attendanceFields}
            rpc="import_attendance"
            templateName="attendance-import-template.csv"
            sampleRow={["asha.nair@example.com", "2026-08-04", "09:28", "18:35", "", "present"]}
            onDone={() => queryClient.invalidateQueries({ queryKey: ["import-batches"] })}
          />
        </TabsContent>

        <TabsContent value="leave" className="mt-4">
          <SheetImporter
            title="Import past leave"
            description="Load leave already taken in earlier months. Each row is matched to an employee by email and to one of your leave types by name. Historical leave does not send notifications and does not change this year's leave balances."
            fields={leaveFields}
            rpc="import_leave"
            templateName="leave-import-template.csv"
            sampleRow={["asha.nair@example.com", "Casual", "2026-06-10", "2026-06-12", "full day", "approved", "Family function"]}
            onDone={() => queryClient.invalidateQueries({ queryKey: ["import-batches"] })}
          />
        </TabsContent>

        <TabsContent value="history" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Recent imports</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>When</TableHead>
                    <TableHead>What</TableHead>
                    <TableHead>File</TableHead>
                    <TableHead>Added</TableHead>
                    <TableHead>Skipped</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(batches ?? []).map((b) => (
                    <TableRow key={b.id}>
                      <TableCell>{format(new Date(b.created_at), "dd MMM yyyy, HH:mm")}</TableCell>
                      <TableCell className="capitalize">{b.kind}</TableCell>
                      <TableCell>{b.filename || "—"}</TableCell>
                      <TableCell>{b.imported_rows}</TableCell>
                      <TableCell>{b.skipped_rows}</TableCell>
                    </TableRow>
                  ))}
                  {!batches?.length && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                        No imports yet
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
