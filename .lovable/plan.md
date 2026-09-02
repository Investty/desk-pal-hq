# Mini HRMS — Full Feature Expansion

Build 11 new modules in one batch, then review together.

## New Database Tables (with RLS + grants)

| Table | Purpose | Who can access |
|---|---|---|
| `holidays` | Company holiday list (name, date, optional recurring) | Everyone views; admin manages |
| `announcements` | Company-wide posts (title, body, pinned flag) | Everyone views; admin manages |
| `employee_documents` | Files per employee (type, title, storage path) | Owner + admin view; admin uploads |
| `onboarding_checklists` | Task lists per employee (task, done flag, type: join/exit) | Owner + admin + manager view; admin manages |
| `salary_structures` | Pay details per employee (basic, allowances, deductions, effective date) | Owner + admin view; admin manages |
| `payslips` | Monthly payroll records (month, year, gross, deductions, net) | Owner + admin view; admin generates |
| `performance_cycles` | Review periods (name, start/end, status) | Everyone views; admin manages |
| `performance_reviews` | Goals, self-rating, manager rating, feedback, status | Employee + their manager + admin |
| `profiles` (extend) | Add phone, address, emergency contact fields | Self-editable |

Storage bucket `employee-documents` (private) for document files.

## New Pages / Features

### Essentials
1. **Role Management** (admin only) — new "User Roles" page: list all users with current role, promote/demote to admin/manager/employee via dropdown.
2. **Holidays** — admin CRUD page for holidays; holidays listed on Dashboard; leave request day-count excludes holidays and weekends.
3. **Attendance Reports** — monthly summary per employee (present/absent/late days, total hours), admin/manager view, CSV export.
4. **Announcements** — admin creates/pins announcements; shown on Dashboard for everyone.

### Employee Experience
5. **Profile Self-Service** — "My Profile" page: edit phone, address, emergency contact, date of birth, avatar upload (new `avatars` storage bucket).
6. **Org Chart** — visual hierarchy tree built from manager relationships (auto-layout tree component).
7. **Documents** — per-employee document upload/download (admin uploads; employee sees own).
8. **Onboarding/Offboarding** — admin creates checklist per employee with join/exit tasks; employee/manager see progress.

### Advanced
9. **Payroll** — admin sets salary structure per employee; "Run Payroll" generates monthly payslips for all active employees; employees download their payslips as PDF (browser print view).
10. **Performance Reviews** — admin creates review cycles; employee adds goals + self-rating; manager adds rating + feedback; status flow: pending → self-review → manager-review → complete.
11. **Reports & Analytics** — admin dashboard page: headcount by department, attendance trend, leave type distribution, upcoming celebrations — charts via existing recharts.

## Navigation Updates
- Sidebar gains: My Profile, Org Chart, Documents, Announcements, Holidays, Payroll, Performance, Reports, User Roles (role-gated).
- Dashboard adds: holidays widget, announcements widget.

## Technical Notes
- All new tables: GRANT + RLS per the project's role model (`has_role`, `is_manager_of`).
- Leave day-count logic updated client-side to skip holidays/weekends.
- Payslip PDF via print-friendly page (no extra dependency).
- Charts use existing recharts; tree for org chart hand-rolled with recursive components.
- After schema changes, Supabase types regenerate; pages built against new types.
- One edge case: existing `notifications` table denies client INSERT — payroll/review events will use it only where policies allow, otherwise skipped.

## Build Order
1. Migration: all tables, buckets, RLS, profile fields
2. Essentials (roles, holidays, attendance reports, announcements)
3. Employee experience (profile, org chart, documents, onboarding)
4. Advanced (payroll, performance, reports)
5. Navigation + dashboard integration, final review
