export interface FeatureDef {
  key: string;
  label: string;
  description: string;
  paths: string[];
}

export const FEATURES: FeatureDef[] = [
  { key: "payroll", label: "Payroll & Payslips", description: "Salary structures, payslip generation", paths: ["/payroll", "/salary"] },
  { key: "performance", label: "Performance Reviews", description: "Review cycles, self and manager ratings", paths: ["/performance"] },
  { key: "onboarding", label: "Onboarding Checklists", description: "Joining and exit task lists", paths: ["/onboarding"] },
  { key: "documents", label: "Employee Documents", description: "Document upload and storage", paths: ["/documents"] },
  { key: "attendance_regularization", label: "Attendance Regularization", description: "Correction and early-leave requests", paths: [] },
  { key: "announcements", label: "Announcements", description: "Company-wide announcements", paths: ["/announcements"] },
  { key: "reports", label: "Reports & Analytics", description: "HR reports and attendance reports", paths: ["/reports", "/attendance-reports"] },
  { key: "org_chart", label: "Org Chart", description: "Reporting structure view", paths: ["/org-chart"] },
  { key: "audit_logs", label: "Audit Logs", description: "Activity history for admins", paths: ["/audit-logs"] },
];

export const PLANS = ["free", "starter", "pro", "enterprise"] as const;

export function featureForPath(path: string): string | null {
  const found = FEATURES.find((f) => f.paths.includes(path));
  return found ? found.key : null;
}
