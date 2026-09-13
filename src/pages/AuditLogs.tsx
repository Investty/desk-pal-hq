import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ListPager } from "@/components/ui/list-pager";
import { format } from "date-fns";
import { FileText, Search } from "lucide-react";

const PAGE_SIZE = 25;

export default function AuditLogs() {
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const { data } = useQuery({
    queryKey: ["audit-logs", page, search, from, to],
    queryFn: async () => {
      let q = supabase
        .from("audit_logs")
        .select("*", { count: "exact" })
        .order("created_at", { ascending: false });
      if (search.trim()) q = q.or(`action.ilike.%${search.trim()}%,entity_type.ilike.%${search.trim()}%`);
      if (from) q = q.gte("created_at", `${from}T00:00:00`);
      if (to) q = q.lte("created_at", `${to}T23:59:59`);
      const { data: rows, count } = await q.range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);
      return { rows: rows || [], count: count || 0 };
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><FileText className="h-6 w-6" /> Audit Logs</h1>
        <p className="text-muted-foreground">Track system changes and activities</p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-end gap-3 mb-4">
            <div className="space-y-1 flex-1 min-w-[200px]">
              <Label className="text-xs">Search</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  className="pl-9"
                  placeholder="Action or entity..."
                  value={search}
                  onChange={(e) => { setPage(0); setSearch(e.target.value); }}
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">From</Label>
              <Input type="date" value={from} onChange={(e) => { setPage(0); setFrom(e.target.value); }} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">To</Label>
              <Input type="date" value={to} onChange={(e) => { setPage(0); setTo(e.target.value); }} />
            </div>
            {(search || from || to) && (
              <Button variant="ghost" size="sm" onClick={() => { setSearch(""); setFrom(""); setTo(""); setPage(0); }}>Clear</Button>
            )}
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Action</TableHead>
                <TableHead>Entity</TableHead>
                <TableHead>Details</TableHead>
                <TableHead>Timestamp</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data?.rows.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="font-medium">{log.action}</TableCell>
                  <TableCell><Badge variant="outline">{log.entity_type}</Badge></TableCell>
                  <TableCell className="text-muted-foreground max-w-[300px] truncate">
                    {log.details ? JSON.stringify(log.details) : "—"}
                  </TableCell>
                  <TableCell>{format(new Date(log.created_at), "MMM d, yyyy hh:mm a")}</TableCell>
                </TableRow>
              ))}
              {data?.rows.length === 0 && (
                <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">No audit logs found</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
          <ListPager page={page} pageSize={PAGE_SIZE} total={data?.count ?? 0} onPage={setPage} />
        </CardContent>
      </Card>
    </div>
  );
}
