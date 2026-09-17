import { useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Upload, FileSpreadsheet, Download, CheckCircle2, AlertTriangle, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { downloadCsv } from "@/lib/csv";
import {
  autoMap, buildRows, readWorkbook, rowProblems, sheetToRows,
  type FieldDef, type SheetRow,
} from "@/lib/importSheet";
import type * as XLSX from "xlsx";

interface Props {
  title: string;
  description: string;
  fields: FieldDef[];
  rpc: "import_employees" | "import_shifts" | "import_attendance";
  templateName: string;
  sampleRow: string[];
  onDone?: () => void;
}

interface ImportResult {
  imported: number;
  skipped: number;
  errors: { row: number; reason: string; email?: string; name?: string }[];
}

const NONE = "__none__";

export default function SheetImporter({ title, description, fields, rpc, templateName, sampleRow, onDone }: Props) {
  const fileInput = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const [fileName, setFileName] = useState("");
  const [workbook, setWorkbook] = useState<XLSX.WorkBook | null>(null);
  const [sheetName, setSheetName] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<SheetRow[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  const loadSheet = (wb: XLSX.WorkBook, name: string) => {
    const { headers: h, rows: r } = sheetToRows(wb, name);
    setSheetName(name);
    setHeaders(h);
    setRows(r);
    setMapping(autoMap(h, fields));
    setResult(null);
  };

  const onFile = async (file: File) => {
    try {
      const wb = readWorkbook(await file.arrayBuffer());
      if (!wb.SheetNames.length) return toast.error("That file has no sheets");
      setFileName(file.name);
      setWorkbook(wb);
      loadSheet(wb, wb.SheetNames[0]);
    } catch {
      toast.error("Could not read that file. Please upload an Excel or CSV file.");
    }
  };

  const mapped = useMemo(() => buildRows(rows, mapping, fields), [rows, mapping, fields]);
  const problems = useMemo(() => mapped.map((r) => rowProblems(r, fields)), [mapped, fields]);
  const validRows = useMemo(() => mapped.filter((_, i) => problems[i].length === 0), [mapped, problems]);
  const badCount = mapped.length - validRows.length;
  const missingRequired = fields.filter((f) => f.required && !mapping[f.key]);

  const reset = () => {
    setWorkbook(null); setRows([]); setHeaders([]); setMapping({});
    setFileName(""); setSheetName(""); setResult(null);
    if (fileInput.current) fileInput.current.value = "";
  };

  const runImport = async () => {
    if (!validRows.length) return toast.error("There are no valid rows to import");
    setBusy(true);
    const { data, error } = await supabase.rpc(rpc, { _rows: validRows, _filename: fileName });
    setBusy(false);
    if (error) return toast.error(error.message);
    const res = data as unknown as ImportResult;
    setResult(res);
    toast.success(`${res.imported} row${res.imported === 1 ? "" : "s"} imported`);
    queryClient.invalidateQueries();
    onDone?.();
  };

  const downloadTemplate = () =>
    downloadCsv(templateName, fields.map((f) => f.label), [sampleRow]);

  const downloadSkipped = () => {
    if (!result?.errors?.length) return;
    downloadCsv("rows-not-imported.csv", ["Row", "Who", "Why it was skipped"],
      result.errors.map((e) => [e.row, e.email ?? e.name ?? "", e.reason]));
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex-row items-start justify-between gap-4 space-y-0">
          <div>
            <CardTitle>{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={downloadTemplate}>
            <Download className="h-4 w-4 mr-2" /> Download template
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <input
            ref={fileInput}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
          />
          {!workbook ? (
            <button
              onClick={() => fileInput.current?.click()}
              className="w-full border-2 border-dashed rounded-lg py-12 flex flex-col items-center gap-2 text-muted-foreground hover:border-primary hover:text-primary transition-colors"
            >
              <Upload className="h-8 w-8" />
              <span className="font-medium">Choose an Excel or CSV file</span>
              <span className="text-xs">Exports from Tally or any payroll sheet work fine</span>
            </button>
          ) : (
            <div className="flex flex-wrap items-center gap-3">
              <Badge variant="secondary" className="gap-2 py-1.5 px-3">
                <FileSpreadsheet className="h-4 w-4" /> {fileName}
              </Badge>
              {workbook.SheetNames.length > 1 && (
                <Select value={sheetName} onValueChange={(v) => loadSheet(workbook, v)}>
                  <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {workbook.SheetNames.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
              <span className="text-sm text-muted-foreground">{rows.length} rows found</span>
              <Button variant="ghost" size="sm" onClick={reset}><RotateCcw className="h-4 w-4 mr-2" /> Start over</Button>
            </div>
          )}
        </CardContent>
      </Card>

      {workbook && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Match your columns</CardTitle>
            <CardDescription>We matched what we could. Change anything that looks wrong.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {fields.map((f) => (
              <div key={f.key} className="space-y-1.5">
                <Label className="flex items-center gap-2">
                  {f.label}
                  {f.required && <span className="text-destructive">*</span>}
                </Label>
                <Select
                  value={mapping[f.key] ?? NONE}
                  onValueChange={(v) => setMapping((m) => ({ ...m, [f.key]: v === NONE ? "" : v }))}
                >
                  <SelectTrigger><SelectValue placeholder="Not in my file" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>Not in my file</SelectItem>
                    {headers.map((h) => <SelectItem key={h} value={h}>{h}</SelectItem>)}
                  </SelectContent>
                </Select>
                {f.hint && <p className="text-xs text-muted-foreground">{f.hint}</p>}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {workbook && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Preview</CardTitle>
            <CardDescription>
              {missingRequired.length
                ? `Match ${missingRequired.map((f) => f.label).join(" and ")} to continue.`
                : `${validRows.length} ready to import${badCount ? `, ${badCount} need attention` : ""}.`}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">#</TableHead>
                    {fields.map((f) => <TableHead key={f.key}>{f.label}</TableHead>)}
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mapped.slice(0, 8).map((r, i) => (
                    <TableRow key={i}>
                      <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                      {fields.map((f) => <TableCell key={f.key}>{r[f.key] || "—"}</TableCell>)}
                      <TableCell>
                        {problems[i].length ? (
                          <span className="text-xs text-destructive">{problems[i].join(", ")}</span>
                        ) : (
                          <Badge variant="secondary" className="text-xs">Ready</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {!mapped.length && (
                    <TableRow><TableCell colSpan={fields.length + 2} className="text-center text-muted-foreground py-8">
                      This sheet has no rows
                    </TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
            {mapped.length > 8 && <p className="text-xs text-muted-foreground">Showing the first 8 of {mapped.length} rows.</p>}
            <Button onClick={runImport} disabled={busy || !validRows.length || missingRequired.length > 0}>
              {busy ? "Importing..." : `Import ${validRows.length} row${validRows.length === 1 ? "" : "s"}`}
            </Button>
          </CardContent>
        </Card>
      )}

      {result && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-success" /> Import finished
            </CardTitle>
            <CardDescription>
              {result.imported} added or updated · {result.skipped} skipped
            </CardDescription>
          </CardHeader>
          {!!result.errors?.length && (
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <AlertTriangle className="h-4 w-4 text-warning" /> Some rows were skipped:
              </div>
              <ul className="text-sm space-y-1">
                {result.errors.slice(0, 5).map((e, i) => (
                  <li key={i}>Row {e.row}{e.email ? ` (${e.email})` : ""} — {e.reason}</li>
                ))}
              </ul>
              <Button variant="outline" size="sm" onClick={downloadSkipped}>
                <Download className="h-4 w-4 mr-2" /> Download skipped rows
              </Button>
            </CardContent>
          )}
        </Card>
      )}
    </div>
  );
}
