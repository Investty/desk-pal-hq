# Owner console: tenant governance, limits, support mode

Builds the super-admin layer on top of the existing `/owner` console. First round covers company lifecycle, hard limits, read-only support access, a global action log, and per-company usage. Revenue metrics, invoices and payments come later.

## 1. Company lifecycle

Replace the current active/suspended toggle with four states: **Trial**, **Active**, **Past due**, **Suspended**.

- Trial shows days remaining from the trial end date; expired trials are highlighted in the list.
- Past due and Suspended block sign-in to that company (existing suspended screen, with a message matched to the state).
- Delete a company: a two-step confirm that removes the company and all its data, recorded in the action log.
- Filter and search the company list by state and plan.

## 2. Resource limits per company

Each company gets limits the owner can set, with a soft warning threshold and a hard stop:

| Limit | Soft (warn) | Hard (block) |
|---|---|---|
| Employee seats | banner to their HR at 90% | invite/restore refused |
| Document storage | banner at 90% | new uploads refused |
| Monthly notifications | counted per month | stops sending beyond cap |

- Owner sets values per company; each plan carries defaults applied to new companies.
- Enforcement lives in the database so it cannot be bypassed from the app.
- Owner sees current usage against each limit inline in the company row.

## 3. Support mode (read-only impersonation)

- "Enter support mode" on any company opens the normal app viewed as that company, clearly banded with a top bar: company name, time remaining, "Exit support mode".
- Read-only: every create, edit and delete is refused while a session is active.
- Sessions expire automatically (default 30 minutes, owner-selectable up to 2 hours) and can be ended early.
- Start, end and every page reached is written to the action log.

## 4. Global action log

A new Owner tab listing every super-admin action: plan or limit changes, status changes, deletions, support sessions, feature toggles. Shows who, what, which company, when, and the before/after values. Filterable by company, action type and date; exportable as CSV.

## 5. Usage and storage per company

An Owner panel showing, per company: number of records by area (people, attendance, leave, payslips, documents), stored file size, and month-over-month growth. Sorted by heaviest tenant so you can see who drives load.

## Technical notes

- New tables: `company_limits`, `company_usage_counters` (monthly notification counts), `impersonation_sessions`, `platform_audit_logs`. All owner-facing tables readable only through `is_platform_admin()`.
- `companies.status` widens to `trial | active | past_due | suspended`; existing rows map to their current value.
- Support mode: a short-lived row in `impersonation_sessions` plus a `current_impersonation()` helper folded into `current_company_id()`, so all existing RLS policies keep working unchanged. A write-block clause on that helper enforces read-only.
- Limit enforcement: triggers on `profiles` insert/restore (seats), on `employee_documents` insert (storage), and inside the notification trigger functions (monthly cap).
- Owner audit writes happen inside the existing `owner_*` security-definer functions, so nothing is logged client-side.
- Frontend: `src/pages/Owner.tsx` gains tabs (Companies, Usage, Audit log); new support-mode banner component mounted in `AppLayout`; `AuthContext` exposes the active support session.

## Later (not in this round)

Revenue metrics (MRR/ARR/ARPU/churn), invoices and dunning, plan/pricing editor, background-job health, broadcasts, multi-region and GDPR deletion workflows.
