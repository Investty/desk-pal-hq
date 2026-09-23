# DeskPal HQ — Mini HRMS

A scalable, multi-company, role-based HRMS for employee management, attendance and leave workflows — built for HR/Admins, Managers, and Employees with simplicity and extensibility in mind.

**Live app:** https://desk-pal-hq.lovable.app

## Design system

The mandatory interface source of truth is [`docs/brand-tokens.html`](docs/brand-tokens.html), with implementation rules summarized in [`docs/DESIGN_SYSTEM.md`](docs/DESIGN_SYSTEM.md). All future interface work must use the shared semantic tokens and components described there; feature screens must not introduce direct palette colors, unrelated radii, or one-off button styles.

## What it does

### Core HR
- **Employees** — clean row-based list (10 per page) with search by name/email/employee code, department/status filters, paging and CSV export; invite people via email + invite code; former-employee (removed/restored) lifecycle.
- **Manager assignment** — HR/Admin set or change each person's reporting manager from the employee list; loop-creating choices are excluded so the hierarchy stays valid. This powers the Org Chart and each manager's team view.
- **Departments, Holidays, Announcements** — company-level lists managed by HR/Admin. Departments can be deleted once everyone assigned has been moved out (member count shown), and suggested defaults (Engineering, Sales, HR, …) can be added in one click.
- **My Profile** — self-service personal and employment details, avatar upload.

### Attendance
- Daily check-in / check-out with late marking based on the employee's **shift** (shift start + grace), not a fixed rule.
- **Shifts per employee, per month** — HR defines company shifts (e.g. General, Evening, Night crossing midnight) and sets a monthly roster per employee, with bulk-apply and copy-last-month.
- **Attendance requests** — early leave and missed check-in/out regularization, governed by per-company HR rules (toggle, max hours, monthly caps, backdate window). Reason is compulsory (min 10 chars). Requests go to the reporting manager and HR/Admin; when approved the attendance record is fixed automatically.
- **Leave and attendance work together** — approved full-day leave blocks check-in/out (enforced in the database), and approved leave days appear on the attendance calendar with the leave name.

- Night shifts crossing midnight record against the day the shift starts; check-in/out is stamped server-side so it cannot be faked from the browser.
- **Attendance flags** — HR flags a period for an employee; the employee sees a banner and submits corrections, which HR approves or rejects with a note.

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
- Role-aware dashboard: quick check-in/out, pending approvals, balances, who's on leave today, announcements. Every card is clickable and opens the matching section, and "Apply leave" / "Raise a request" quick actions sit at the top right.
- **Pending Approvals** counts both leave requests and attendance corrections waiting on you, broken down ("2 leave · 1 attendance"); managers see only their direct reports' items, while company-wide headcount cards are hidden from managers entirely.

- **Celebrations** — only today's birthdays and work anniversaries are shown; anyone can send a wish with a message, the person is notified and can reply with a thank-you.
- **Notifications** — a new leave request alerts the person's reporting manager and HR/Admin; every approval, rejection or cancellation notifies the employee, their manager and HR as relevant. Attendance-request events, flags and wishes also notify. Platform-wide broadcasts from the owner console appear as banners.
- **Profile-completion reminders** — a scheduled job (1st & 16th of each month) nudges employees whose personal details (phone, DOB, address, emergency contact) are missing, with no repeat within 14 days.
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
  - First-stage approval of team leave; cancel approved team leave (balance reallocated). Approvals are strictly scoped — a manager only sees requests from their direct reports, never the whole company.
  - Approve/reject team attendance requests.
  - Grant comp-off days to team members.
  - **Cannot:** approve their own requests (self-approval blocked in the database), approve people outside their team, manage employees/payroll/policies, or access User Roles.

- **HR** — everything a Manager can do, plus:
  - Employee directory: invite, edit, remove/restore employees; per-employee leave configuration.
  - Departments, holidays, announcements, documents, onboarding checklists, performance cycles.
  - Shifts and monthly rosters; attendance rules; attendance period flags; attendance reports & export.
  - Leave types (create/edit/deactivate, carry-forward settings, year-end run).
  - Second-stage (final) leave approval; reject/cancel with notes.
  - Salary structures, monthly payroll run, payslip generation, pay-period status (mark paid / lock / reopen).
  - Data import: people, shifts, attendance, leave and payroll history.
  - Reports & analytics with export.
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

## Screens & routes

| Route | Screen | Who can open it |
|---|---|---|
| `/login`, `/signup`, `/reset-password` | Sign in, sign up (new company or invite code), password reset | Signed-out visitors |
| `/join` | Join a company with an invite code / pick the active company | Signed-in users with no active company |
| `/setup` | Company setup wizard | Admin of a company that hasn't finished setup |
| `/` | Dashboard (role-aware) | Everyone |
| `/attendance` | Own attendance, check in/out, today's shift, requests | Everyone |
| `/leave` | Leave balances, apply, own requests, yearly calendar | Everyone |
| `/holidays` | Company holiday list | Everyone (managed by HR/Admin) |
| `/profile` | My profile — personal and employment details | Everyone |
| `/notifications` | Notification inbox | Everyone |
| `/announcements` | Company announcements | Everyone (feature flag) |
| `/org-chart` | Reporting structure | Everyone (feature flag) |
| `/documents` | Employee documents | Everyone (feature flag) |
| `/onboarding` | Joining/exit checklists | Everyone (feature flag) |
| `/performance` | Review cycles and ratings | Everyone (feature flag) |
| `/payroll` | Payslips; payroll run and pay periods for HR/Admin | Everyone (feature flag) |
| `/team` | My Team | Manager, HR, Admin |
| `/approvals` | Leave and attendance approvals | Manager, HR, Admin |
| `/employees` | Employee directory and records | Manager, HR, Admin |
| `/attendance-reports` | Attendance reporting and export | Manager, HR, Admin (feature flag) |
| `/reports` | Reports & analytics dashboard | HR, Admin (feature flag) |
| `/salary` | Salary structure entry | HR, Admin (feature flag) |
| `/leave-types` | Company leave types and carry forward | HR, Admin |
| `/shifts` | Shifts and monthly rosters | HR, Admin |
| `/attendance-rules` | Early-leave and regularization rules | HR, Admin |
| `/departments` | Departments | HR, Admin |
| `/import` | Data import | HR, Admin |
| `/audit-logs` | Audit log | HR, Admin (feature flag) |
| `/company` | Company settings (Departments and User Roles nested here for Admin) | HR, Admin |
| `/user-roles` | Role management | Admin |
| `/owner` | Platform owner console | Platform owner |
| `/suspended` | Shown when the company is suspended | Members of a suspended company |

## Feature flags & plans

Each company is on a plan (Free / Starter / Pro / Enterprise) and the platform owner can switch individual modules on or off per company: payroll, performance, onboarding, documents, attendance regularization, announcements, reports, org chart, audit logs. A disabled module disappears from the sidebar and its route is blocked. Seats, document storage and monthly notifications are limited per company — a banner warns at 90% and the database blocks the action at the limit.

## Data model overview

Company-scoped tables (every row carries `company_id`, and row-level security matches it against the signed-in user's active company):

- **People & access** — `companies` (name, timezone, weekly offs, setup state, plan/billing), `profiles`, `user_roles`, `departments`, `company_invites`, `pending_employees`.
- **Attendance** — `attendance`, `attendance_requests`, `attendance_flags`, `attendance_rules`, `shifts`, `employee_shifts`, `holidays`.
- **Leave** — `leave_policies`, `applicable_leave_types`, `employee_leave_settings`, `leave_balances`, `leave_requests`, `comp_off_grants`.
- **Payroll** — `salary_structures`, `pay_periods`, `payslips`.
- **Workplace** — `announcements`, `employee_documents`, `notifications`, `celebration_wishes`, `onboarding_checklists`, `performance_cycles`, `performance_reviews`, `audit_logs`, `import_batches`.
- **Platform (owner only)** — `plans`, `platform_admins`, `platform_audit_logs`, `company_features`, `company_limits`, `company_usage_counters`, `broadcasts`, `broadcast_reads`, `impersonation_sessions`.

Key rules live in the database rather than the UI: `has_role` / `is_hr` / `is_manager_of` / `is_platform_admin` / `current_company_id` (used inside RLS policies), `shift_for`, `clock_in` / `clock_out` / `close_attendance_day`, `apply_attendance_request`, `is_working_day` / `working_days_between`, `hr_set_employee_leave`, `run_leave_carry_forward`, `redeem_invite`, `remove_employee` / `restore_employee`, `set_active_company`, `link_pending_employee`, the owner RPCs (`owner_*`) and the five importers (`import_employees`, `import_shifts`, `import_attendance`, `import_leave`, `import_payroll`). Leave overlap, balance checks, locked pay periods, self-approval and "last leave type enabled" are enforced by triggers.

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
5. **Import existing records** (optional) from `/import`: people → shifts → attendance → leave → payroll history.
6. **Run payroll** monthly from the Payroll page after attendance is settled, then mark the pay period paid to lock it.

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
- Password breach (HIBP) check enabled; sessions managed by the auth service; password reset links never sign the user in.
- Paid pay periods are locked in the database — payslips cannot be created, edited or imported for a locked month.
- Imports run through security-definer functions restricted to HR/Admin of the active company, and every run is audit-logged.

### Testing done
69 scripted access-control scenarios have been run against the live app and all passed: 24 authentication/session tests, 12 employee, 15 manager and 18 HR permission tests, plus 14 attendance shift/rule scenarios (shift assignment, monthly changes, midnight crossing, early-leave and regularization limits).

## Project structure

```
src/
  components/      # Shared UI + feature components (attendance/, leave/, dashboard/, owner/...)
  pages/           # One file per screen (Dashboard, Employees, Leave, Attendance, Owner, ...)
  contexts/        # AuthContext — session, memberships, active company, feature flags
  integrations/    # Generated Supabase client (do not edit) + types
  lib/             # Salary math, leave helpers, spreadsheet import/mapping, CSV export, feature flags
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
