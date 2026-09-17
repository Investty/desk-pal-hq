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
- **Company-owned leave types** — HR creates, renames, edits and deactivates types, including custom ones (e.g. "Study Leave"). Compensatory and Bereavement are disabled by default. At least one type must stay enabled.
- **Per-employee leave configuration** — HR can turn each leave type on/off per person and give a custom entitlement that overrides the company default; every change is written to the audit log with an optional note.
- **Two-stage approvals** (manager → HR), half-day leave, overlap prevention, admin/HR cancellation with balance reallocation.
- **Comp-off credits** — managers/HR grant overtime-based compensatory days per employee; amounts vary person to person.
- **Yearly leave calendar** — full-year grid per company: holidays, weekly offs, approved leave ("My leave" / "Company" modes), year picker for planning.
- **Carry forward** — HR decides per leave type whether unused balance carries forward at year end (and a max), with a one-click year-end run.

### Payroll
- **Salary structures** per employee — Basic, DA, HRA, other allowances, PF rate, professional tax, TDS, effective from a date.
- **Pay periods** — every month/year is a period with a status: Draft → In progress → Paid. Marking a period paid **locks** its payslips against edits, re-runs and imports; HR/Admin can reopen it. A Pay periods table shows status, payslip count, net paid and pay date per month.
- **Payroll run** — generates payslips for everyone with a salary structure for the chosen month; PF is computed on Basic + DA.
- **Payslips** — Gross → Deductions → Net with the full earnings/deductions breakdown, printable/PDF view, CSV export and a year-to-date summary. Employees see only their own.

### Reports & analytics
- KPI cards (active headcount, attendance rate, approved leave days, monthly net payroll) with period (30/90/YTD) and department filters.
- Charts with legends, tooltips and empty states: headcount by department, approved leave by type, attendance trend (present/late/absent), monthly payroll composition — each linking through to the underlying records.
- Attendance reports with date ranges, search, paging and CSV export.

### Dashboard & communication
- Role-aware dashboard: quick check-in/out, pending approvals, balances, who's on leave today, announcements.
- **Celebrations** — only today's birthdays and work anniversaries are shown; anyone can send a wish with a message, the person is notified and can reply with a thank-you.
- **Notifications** for leave/attendance request events, approvals, rejections, flags and wishes. Platform-wide broadcasts from the owner console appear as banners.
- **Documents** — employee document storage with per-company access control and storage limits.

### Performance & Onboarding
- Review cycles with self-rating → manager rating → complete flow; joining/exit onboarding checklists.

### Manager view
- **My Team** — assigned team members, their attendance and leave, approvals and cancellations scoped to the team.

### Platform owner console (`/owner`)
- Cross-company overview, company list with plan (Free/Starter/Pro/Enterprise), status (Trial/Active/Past Due/Suspended), seat limits, trial dates, feature switches per company.
- Revenue dashboard (MRR/ARR/ARPU/churn from plan data), editable plans, broadcasts, usage/storage per company, support (read-only impersonation) sessions, global audit log.
- Resource limits: seats, document storage, monthly notifications — soft warnings at 90%, hard stops enforced in the database.
- Visible only to the platform owner — never shown to regular company users.

### Setup wizard
- New-company onboarding at `/setup`: company details + timezone, weekly offs, departments, HR invite codes, finish.

## Roles & access

| Role | Scope |
|---|---|
| **Employee** | Own attendance, leave, payslips, profile; dashboard; wishing celebrations |
| **Manager** | Employee + team view, team leave/attendance approvals and cancellation, comp-off grants |
| **HR** | Manager + employee records, departments, holidays, shifts, attendance rules, flags, reports, payroll, leave policies & per-employee leave setup, onboarding, performance, announcements |
| **Admin** | HR + User Roles management, company settings |
| **Platform owner** | `/owner` console only — invisible to regular users |

A user can belong to multiple companies; roles are **per company**, and all data follows the active company (switcher in the sidebar).

### Role permissions in detail

- **Employee**
  - Check in / check out; see own attendance history and today's shift.
  - Submit early-leave and missed-punch regularization requests (only if HR has enabled them for the company).
  - Apply for leave (types enabled for them), see own balances, cancel own pending requests.
  - View own payslips and download them.
  - Edit own profile (name, contact, avatar — sensitive employment fields are locked).
  - Wish colleagues on today's birthdays/anniversaries; thank well-wishers.
  - **Cannot:** see other employees' attendance/leave/payslips, approve anything, access reports, user roles, audit logs, or HR tools.

- **Manager** — everything an Employee can do, plus:
  - My Team page: team members' attendance and leave.
  - First-stage approval of team leave; cancel approved team leave (balance reallocated).
  - Approve/reject team attendance requests.
  - Grant comp-off days to team members.
  - **Cannot:** approve their own requests (self-approval blocked in the database), approve people outside their team, manage employees/payroll/policies, or access User Roles.

- **HR** — everything a Manager can do, plus:
  - Employee directory: invite, edit, remove/restore employees; per-employee leave configuration.
  - Departments, holidays, announcements, documents, onboarding checklists, performance cycles.
  - Shifts and monthly rosters; attendance rules; attendance period flags; attendance reports & export.
  - Leave types (create/edit/deactivate, carry-forward settings, year-end run).
  - Second-stage (final) leave approval; reject/cancel with notes.
  - Salary structures, monthly payroll run, payslip generation.
  - **Cannot:** manage User Roles or promote anyone to Admin, change company settings, or access the owner console.

- **Admin** — everything HR can do, plus:
  - User Roles management (promote/demote within the company).
  - Company settings (name, timezone, weekly offs, invite codes).

- **Platform owner**
  - `/owner` console only: companies, plans, lifecycle status, seat/storage/notification limits, feature switches, revenue metrics, broadcasts, read-only support sessions, global audit log.
  - Has no presence inside any company's day-to-day UI.

## Leave configuration

Leave is configured at two levels:

**1. Company leave types (HR → Leave Types)**
- Add, rename, edit, deactivate types — including fully custom ones.
- Each type: name, default days, enabled/disabled, applicability (all employees or selected), carry-forward on/off + cap.
- Compensatory and Bereavement ship **disabled** by default; HR enables them per company.
- At least one type must stay enabled — the database refuses to disable the last one.
- Deactivating a type hides it from new requests but keeps all history and reports intact.

**2. Per-employee setup (HR → Employees → employee → Leave)**
- One row per company leave type: on/off for this person, entitlement ("company default" or a custom number), used/pending/available, and a reset-to-default action.
- Changing the company default later only updates people still on the default; custom entitlements are kept.
- Every change is audit-logged (old value → new value, who, when, optional note).

**Year-end carry forward**
- Per leave type, HR chooses whether unused days carry forward and the maximum.
- HR runs the year-end carry forward manually (button on Leave Types); the run is audit-logged.

**Defaults seeded for a new company:** Casual 12, Sick 8, Paid 15 (enabled); Compensatory 0, Bereavement 3 (disabled).

## Data import (`/import`, HR & admin)

Bring existing records in from Excel, CSV or a Tally export instead of typing them. Every importer follows the same flow: **upload → pick sheet → check the column matching → preview with per-row problems → confirm → import**. Columns are matched automatically from a list of common header names, and skipped rows can be downloaded as a CSV with the reason for each.

**People** — name, email, employee code, phone, designation, department, joining date, date of birth, manager email, shift. Imported people go to a "waiting to join" list; missing departments are created. When someone signs up with the company invite code and the same email, their details, manager and shift are applied to their profile automatically.

**Shifts** — name, start time, end time, break minutes, grace minutes. A shift with the same name is updated, not duplicated.

**Attendance history** — email, date, check in, check out, working hours, status.
- Each row is matched to an employee by email within the current company.
- A day already recorded for that person is updated, never duplicated.
- Working hours are calculated from the times when the column is empty; a check-out earlier than the check-in is treated as a night shift ending the next morning.
- When status is blank it is decided from the employee's shift for that date: no check-in → absent, check-in after shift start plus grace → late, otherwise present.
- Rows are skipped with a reason when the email is unknown, the date is missing/invalid/in the future, a check-out has no check-in, the status is not present/absent/late, or hours fall outside 0–24.

**Leave history** — email, leave type, start date, end date, day portion, status, reason.
- Each row is matched to an employee by email and to one of the company's configured leave types by code, label or type name.
- Rows are skipped with a reason when the email is unknown, the leave type is not configured, dates are missing or the end is before the start, a half-day spans two dates, or the dates clash with leave already recorded.
- Balances are not touched and no notifications are sent — this is history, not new requests.

**Payroll history** — email, month, year, basic, DA, HRA, other allowances, PF, professional tax, TDS, gross, deductions, net.
- Each row is matched to an employee by email and to a pay period by month and year.
- Earnings and deductions are validated as numbers; gross, total deductions and net pay are calculated from the parts when those columns are left empty.
- An existing payslip for that person and month is updated rather than duplicated, and each imported month is recorded as a **paid** pay period so it is locked against accidental re-runs (HR can reopen it from Payroll).
- Rows are skipped with a reason when the email is unknown, the month is outside 1–12, the year is out of range, or any amount is not a valid number.

**Import history** — each run records the file, what was imported, and how many rows were added and skipped. Every import is written to the audit log.

## Tech stack

- **Frontend:** React 18, TypeScript 5, Vite 5, Tailwind CSS v3, shadcn/ui, Recharts, TanStack Query
- **Backend:** Lovable Cloud (Supabase) — Postgres with row-level security scoped per company, Auth (email; roles in a separate `user_roles` table), Edge Functions, Storage (avatars, employee documents, payslip files)
- **Design system:** Inter typography, primary blue `#2563EB`, secondary violet `#7C3AED`, page background `#F0F4FF`, dark sidebar `#111827`, tokenized statuses (Active green, Pending amber, Terminated red, On Leave info blue)

## Getting started

### Prerequisites
- Node.js 18+ (or Bun)
- A Lovable Cloud backend is already provisioned for this project — no external services or API keys are needed.

### Run locally

```bash
npm install        # or: bun install
npm run dev        # start the dev server (http://localhost:8080)
npm run build      # production build
npm run test       # unit tests
```

The frontend reads its backend URL and publishable key from `.env` (already committed per-project values — no secrets involved).

### First-run checklist
1. **Sign up** at `/signup` — choose "New company" to create a tenant, or "I have an invite code" to join one.
2. **Complete the setup wizard** (`/setup`): company details + timezone → weekly offs → departments → invite codes → finish.
3. **Invite HR first**, then have HR configure: leave types & carry-forward, shifts + monthly rosters, attendance rules (early leave / regularization toggles and caps), holidays, salary structures.
4. **Invite employees** from the Employees page (email + invite code required).
5. **Run payroll** monthly from the Payroll page after attendance is settled.

### Environment
| Variable | Purpose |
|---|---|
| `VITE_SUPABASE_URL` | Backend URL (auto-configured) |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Publishable anon key (safe for the browser) |

The service-role key is **not available** on Lovable Cloud by design — all privileged operations run through security-definer database functions.

## Security model

- Row-level security on every table, scoped by active company membership; roles checked server-side via a security-definer helper.
- Self-approval/self-edit guards on attendance, leave, performance reviews and profiles (enforced in the database, not just the UI).
- Tamper-proof audit logs; platform-owner actions logged server-side.
- Attendance-request and leave rules (caps, backdate windows, disabled types) validated by database triggers.
- Password breach (HIBP) check enabled; sessions managed by the auth service.

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

## The brutal truth: real-world fit

This section exists so nobody — including future maintainers — mistakes "feature-rich demo" for "sellable product". What is built here is the easy 40% dressed up to look like 90%. Multi-tenancy, RLS, shifts, approvals and payroll math are real work and done well — but none of that is why HRMS startups die. The honest gap list:

1. **Statutory compliance is the actual product.** The payroll here computes gross/deductions/net. Real payroll is PF, ESI, professional tax, TDS, LWF, gratuity, bonus-act rules, leave encashment, Form 16, challan files — per country, per state, changing every budget. Without this, no company can legally run payroll on this app. This alone is years of work and the reason incumbents exist.
2. **No integrations.** Real HRMS lives inside an ecosystem: biometric devices, biometric/GeoTagged attendance, bank files for salary disbursement, accounting (Tally/Zoho/QuickBooks), Slack/Teams, Google/Outlook calendars, SSO (SAML/OIDC). Zero of these exist here.
3. **No mobile app.** Field staff and frontline workers — the majority of attendance users — need a phone app with GPS/selfie punch. A responsive web app is not enough for this market.
4. **Data migration & onboarding.** Every real customer arrives with years of data in Excel or a competitor. Spreadsheet import with column mapping now covers people, shifts, attendance, leave and payroll history — but biometric-device exports and competitor-specific formats still need mapping by hand, and white-glove onboarding (the part that actually closes deals) is manual.
5. **Scale, reliability & trust.** Uptime SLAs, backups/DR, penetration tests, SOC 2 / ISO 27001, data-residency — enterprise buyers demand certifications before a pilot. A hosted MVP has none.
6. **The market is a red ocean.** greytHR, Keka, Zoho People, Darwinbox, BambooHR, HROne and dozens more — with compliance, mobile, integrations and certified security already built. "Me too but simpler" loses; you win only with a sharp wedge.

**The realistic path:** the foundations here (multi-tenancy, per-company roles, audit trail, tested RBAC) are genuinely better than most day-1 SaaS. But the moat in this market is boring enterprise work: compliance, migration, mobile, uptime, certifications. To sell this, pick **one** wedge — e.g. shift-based attendance + payroll for 20–100 employee companies — make that bulletproof, and ignore everything else until paying customers force it. Trying to build all of greytHR before the first paying customer is how this dies.
