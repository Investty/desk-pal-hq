# Per-employee leave configuration

Today every company shares one fixed list of leave types, and everyone in a company gets the same number of days. This plan makes leave types company-owned (including custom ones HR invents) and lets HR tune entitlement per person.

## 1. Company leave types (HR → Leave Types)

- HR can add, rename, edit and deactivate leave types for their own company, including custom ones (e.g. "Study Leave", "Sabbatical").
- Each type has: name, default days, enabled/disabled, carry-forward on/off and carry-forward cap.
- Types are always company-scoped — nothing created in one company appears in another.
- When creating a type, HR chooses who it applies to: **all employees** or **selected employees**. Selecting "all" makes it available to everyone using the company default; picking people makes it available only to them.
- Deactivating a type hides it from new requests but keeps every past request, balance and report row intact, still showing its name.
- At least one type must stay enabled (existing rule kept).

## 2. Per-employee leave setup (HR → Employees → employee → Leave)

A new Leave tab on the employee record shows one row per company leave type with:

- Leave type, on/off for this person
- Entitlement: "company default (12)" or a custom number
- Used, pending, available balance, carried-forward days
- A "Reset to company default" action

Changing the company default later updates only the people still on the default; anyone with a custom number keeps it.

## 3. Employee experience

- The apply-leave form and balance cards show only the types that are enabled for that person.
- Disabled or inapplicable types never appear, but past requests of a now-disabled type still show in history and reports.

## 4. Audit history

Every per-employee change (turned on/off, entitlement changed, reset to default) is written to the audit log with employee, leave type, old value, new value, who changed it, when, and an optional note HR can type.

## Technical notes

- `leave_policies` becomes the company leave-type table: add `code text` (slug, unique per company), `is_active boolean`, `applies_to text` ('all' | 'selected'); the `leave_type` enum column becomes nullable so custom types are possible. Existing rows get codes from their enum value.
- New `employee_leave_settings (company_id, user_id, policy_id, is_enabled, entitlement_override numeric null, note text)` — unique per user+policy; absence of a row means "follow company default applicability".
- `leave_balances` and `leave_requests` gain `policy_id uuid references leave_policies(id)`, backfilled by matching company + enum; enum columns stay for history and are made nullable. New writes set `policy_id`.
- Effective entitlement = `coalesce(override, policy.default_days)`; a security-definer `hr_set_employee_leave(...)` RPC applies the change, recalculates the balance row (keeping `used_days`), and writes the audit entry atomically.
- `applicable_leave_types()` security-definer function returns the types a given user may use (policy active + enabled, honouring per-employee override) — used by the apply form, balance cards and a `check_leave_balance` guard that rejects requests for non-applicable types.
- Functions touching leave types updated to work off `policy_id`: `check_leave_balance`, `apply_leave_balance`, `handle_leave_cancellation`, `apply_comp_off_grant`, `run_leave_carry_forward`, `get_leave_calendar`, `get_people_on_leave_today`, `handle_new_user` (seeds balances from the company's own types + per-employee settings), `restore_employee`.
- All new tables carry `company_id`, GRANTs and RLS scoped by `current_company_id()`; HR/admin write, employees read their own.
- UI: `LeaveTypes.tsx` gains create/edit/deactivate dialogs with an applicability picker; new `src/components/employees/EmployeeLeaveTab.tsx` opened from `Employees.tsx`; `Leave.tsx`, `Approvals.tsx`, `Team.tsx`, `Reports.tsx` read labels from the policy instead of the enum.
