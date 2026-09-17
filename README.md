# DeskPal HQ — Mini HRMS

A scalable, multi-company, role-based HRMS for employee management, attendance and leave workflows — built for HR/Admins, Managers, and Employees with simplicity and extensibility in mind.

**Live app:** https://desk-pal-hq.lovable.app

## What it does

### Core HR
- **Employees** — directory with search, department/status filters, paging and CSV export; invite people via email + invite code; former-employee (removed/restored) lifecycle.
- **Departments, Holidays, Announcements** — company-level lists managed by HR/Admin.
- **My Profile** — self-service personal and employment details, avatar upload.

### Attendance
- Daily check-in / check-out with late marking based on the employee's **shift** (shift start + grace), not a fixed rule.
- **Shifts per employee, per month** — HR defines company shifts (e.g. General, Evening, Night crossing midnight) and sets a monthly roster per employee, with bulk-apply and copy-last-month.
- **Attendance requests** — early leave and missed check-in/out regularization, governed by per-company HR rules (toggle, max hours, monthly caps, backdate window). Reason is compulsory (min 10 chars).
- Night shifts crossing midnight record against the day the shift starts.

### Leave
- Leave types: Casual, Sick, Paid, Compensatory, Bereavement, Maternity, Paternity. Compensatory and Bereavement are disabled by default; HR enables them per company. At least one type must stay enabled.
- **Two-stage approvals** (manager → HR), half-day leave, overlap prevention, admin/HR cancellation with balance reallocation.
- **Comp-off credits** — managers/HR grant overtime-based compensatory days per employee.
- **Yearly leave calendar** — full-year grid per company: holidays, weekly offs, approved leave ("My leave" / "Company" modes), year picker for planning.
- **Carry forward** — HR decides per leave type whether unused balance carries forward at year end (and a max), with a one-click year-end run.

### Payroll
- Salary structures per employee; monthly payroll run; payslips (Gross → Deductions → Net) with printable/PDF view and CSV export.

### Performance & Onboarding
- Review cycles with self-rating → manager rating → complete flow; joining/exit onboarding checklists.

### Manager view
- **My Team** — assigned team members, their attendance and leave, approvals and cancellations scoped to the team.

### Platform owner console (`/owner`)
- Cross-company overview, company list with plan (Free/Starter/Pro/Enterprise), status (Trial/Active/Past Due/Suspended), seat limits, trial dates, feature switches per company.
- Revenue dashboard (MRR/ARR/ARPU/churn from plan data), editable plans, broadcasts, usage/storage per company, support (read-only impersonation) sessions, global audit log.
- Resource limits: seats, document storage, monthly notifications — soft warnings at 90%, hard stops enforced in the database.

### Setup wizard
- New-company onboarding at `/setup`: company details + timezone, weekly offs, departments, HR invite codes, finish.

## Roles & access

| Role | Scope |
|---|---|
| **Employee** | Own attendance, leave, payslips, profile; dashboard; wishing celebrations |
| **Manager** | Employee + team view, team leave/attendance approvals and cancellation |
| **HR** | Manager + employee records, departments, holidays, shifts, attendance rules, flags, reports, payroll, leave policies, onboarding, performance, announcements |
| **Admin** | HR + User Roles management, company settings |
| **Platform owner** | `/owner` console only — invisible to regular users |

A user can belong to multiple companies; roles are **per company**, and all data follows the active company (switcher in the sidebar).

## Tech stack

- **Frontend:** React 18, TypeScript 5, Vite 5, Tailwind CSS v3, shadcn/ui, Recharts, TanStack Query
- **Backend:** Lovable Cloud (Supabase) — Postgres with row-level security scoped per company, Auth (email; roles in a separate `user_roles` table), Edge Functions, Storage (avatars, employee documents, payslip files)
- **Design system:** Inter typography, primary blue `#2563EB`, secondary violet `#7C3AED`, page background `#F0F4FF`, dark sidebar `#111827`, tokenized statuses (Active green, Pending amber, Terminated red, On Leave info blue)

## Security model

- Row-level security on every table, scoped by active company membership; roles checked server-side via a security-definer helper.
- Self-approval/self-edit guards on attendance, leave, performance reviews and profiles (enforced in the database, not just the UI).
- Tamper-proof audit logs; platform-owner actions logged server-side.
- Attendance-request and leave rules (caps, backdate windows, disabled types) validated by database triggers.

## Project structure

```
src/
  components/      # Shared UI + feature components (attendance/, leave/, dashboard/, owner/...)
  pages/           # One file per screen (Dashboard, Employees, Leave, Attendance, Owner, ...)
  contexts/        # AuthContext — session, memberships, active company, feature flags
  integrations/    # Generated Supabase client (do not edit) + types
  lib/             # Salary math, leave helpers, CSV export, feature flags
supabase/          # Database schema (config is auto-generated — don't edit)
```

## Development

```bash
npm install
npm run dev      # local dev server
npm run build    # production build
npm run test     # unit tests
```

The database schema lives in Lovable Cloud; migrations are applied from this project. The publishable key and URL are the only env values used by the frontend.
