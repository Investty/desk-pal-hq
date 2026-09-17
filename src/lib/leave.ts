export interface LeaveLabelRow {
  leave_type?: string | null;
  leave_policies?: { label: string } | null;
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Display name of a leave type — the company's own label, falling back to legacy history. */
export const leaveLabel = (row: LeaveLabelRow): string =>
  row.leave_policies?.label ?? (row.leave_type ? `${cap(row.leave_type)} Leave` : "Leave");

export const slugify = (s: string) =>
  s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 40);
