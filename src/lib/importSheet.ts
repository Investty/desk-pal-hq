import * as XLSX from "xlsx";

export type SheetRow = Record<string, string>;

export interface FieldDef {
  key: string;
  label: string;
  required?: boolean;
  hint?: string;
  aliases: string[];
  kind?: "date" | "time" | "number" | "email" | "text";
}

export const employeeFields: FieldDef[] = [
  { key: "full_name", label: "Full name", required: true, aliases: ["name", "full name", "employee name", "employeename", "particulars"] },
  { key: "email", label: "Email", required: true, kind: "email", aliases: ["email", "email id", "e-mail", "official email", "work email"] },
  { key: "employee_code", label: "Employee code", aliases: ["employee id", "emp id", "empcode", "employee code", "code", "emp no", "employee number"] },
  { key: "phone", label: "Phone", aliases: ["phone", "mobile", "contact", "mobile no", "phone number"] },
  { key: "designation", label: "Designation", aliases: ["designation", "title", "job title", "role", "position"] },
  { key: "department", label: "Department", hint: "Created automatically if new", aliases: ["department", "dept", "cost centre", "cost center"] },
  { key: "joining_date", label: "Joining date", kind: "date", aliases: ["joining date", "date of joining", "doj", "join date", "start date"] },
  { key: "date_of_birth", label: "Date of birth", kind: "date", aliases: ["date of birth", "dob", "birth date", "birthday"] },
  { key: "manager_email", label: "Manager email", kind: "email", aliases: ["manager email", "reporting manager email", "manager", "reports to"] },
  { key: "shift_name", label: "Shift", hint: "Must match a shift name", aliases: ["shift", "shift name", "work shift"] },
];

export const shiftFields: FieldDef[] = [
  { key: "name", label: "Shift name", required: true, aliases: ["shift", "shift name", "name"] },
  { key: "start_time", label: "Start time", required: true, kind: "time", aliases: ["start", "start time", "in time", "from"] },
  { key: "end_time", label: "End time", required: true, kind: "time", aliases: ["end", "end time", "out time", "to"] },
  { key: "break_minutes", label: "Break (minutes)", kind: "number", aliases: ["break", "break minutes", "break mins", "lunch"] },
  { key: "grace_minutes", label: "Grace (minutes)", kind: "number", aliases: ["grace", "grace minutes", "grace mins", "late allowance"] },
];

const pad = (n: number) => String(n).padStart(2, "0");

function fromDate(d: Date, kind: "date" | "time") {
  return kind === "date"
    ? `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
    : `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function normalizeValue(raw: string, kind: FieldDef["kind"]): string {
  const v = (raw ?? "").toString().trim();
  if (!v) return "";
  if (kind === "number") return v.replace(/[^\d-]/g, "");
  if (kind === "email") return v.toLowerCase();
  if (kind === "date") {
    const iso = v.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (iso) return `${iso[1]}-${pad(+iso[2])}-${pad(+iso[3])}`;
    const dmy = v.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/);
    if (dmy) {
      const year = dmy[3].length === 2 ? 2000 + +dmy[3] : +dmy[3];
      return `${year}-${pad(+dmy[2])}-${pad(+dmy[1])}`;
    }
    const parsed = new Date(v);
    return isNaN(parsed.getTime()) ? "" : fromDate(parsed, "date");
  }
  if (kind === "time") {
    const m = v.match(/^(\d{1,2})[:.](\d{2})\s*(am|pm)?/i);
    if (!m) return "";
    let h = +m[1];
    const suffix = m[3]?.toLowerCase();
    if (suffix === "pm" && h < 12) h += 12;
    if (suffix === "am" && h === 12) h = 0;
    return `${pad(h)}:${m[2]}`;
  }
  return v;
}

export function readWorkbook(data: ArrayBuffer) {
  return XLSX.read(data, { cellDates: true });
}

export function sheetToRows(wb: XLSX.WorkBook, sheetName: string): { headers: string[]; rows: SheetRow[] } {
  const sheet = wb.Sheets[sheetName];
  if (!sheet) return { headers: [], rows: [] };
  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "", raw: false, dateNF: "yyyy-mm-dd" });
  const rows = raw.map((r) => {
    const out: SheetRow = {};
    Object.entries(r).forEach(([k, v]) => {
      out[k.toString().trim()] = v instanceof Date ? fromDate(v, "date") : (v ?? "").toString().trim();
    });
    return out;
  });
  const headers = rows.length ? Object.keys(rows[0]) : [];
  return { headers, rows: rows.filter((r) => Object.values(r).some((v) => v !== "")) };
}

export function autoMap(headers: string[], fields: FieldDef[]): Record<string, string> {
  const map: Record<string, string> = {};
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, " ").replace(/\s+/g, " ").trim();
  fields.forEach((f) => {
    const match = headers.find((h) => {
      const n = norm(h);
      return n === norm(f.label) || f.aliases.some((a) => norm(a) === n);
    });
    if (match) map[f.key] = match;
  });
  return map;
}

export function buildRows(rows: SheetRow[], mapping: Record<string, string>, fields: FieldDef[]) {
  return rows.map((r) => {
    const out: SheetRow = {};
    fields.forEach((f) => {
      const header = mapping[f.key];
      if (header) out[f.key] = normalizeValue(r[header] ?? "", f.kind);
    });
    return out;
  });
}

export function rowProblems(row: SheetRow, fields: FieldDef[]): string[] {
  const issues: string[] = [];
  fields.forEach((f) => {
    const value = row[f.key] ?? "";
    if (f.required && !value) issues.push(`${f.label} is missing`);
    if (value && f.kind === "email" && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value)) issues.push(`${f.label} is not a valid email`);
    if (value && f.kind === "time" && !/^\d{2}:\d{2}$/.test(value)) issues.push(`${f.label} is not a valid time`);
  });
  return issues;
}
