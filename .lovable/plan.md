# Shifts per employee + HR-controlled attendance requests

## 1. Shift timings per employee, changeable each month

- New company-level **shift list** (name, start time, end time, break minutes, grace minutes for late marking). Defaults created for a company: General (09:30–18:30), Evening, Night.
- New **shift assignment** per employee with a month (e.g. Oct 2026). HR picks a shift for an employee for a given month; next month can be different. If no assignment exists for a month, the company default shift applies.
- HR screen: a new **Shifts** section under Company with two parts —
  - Manage shifts: add, edit, remove a shift; one marked as default.
  - Monthly roster: pick a month, see every active employee with a dropdown of shifts, set them individually or apply one shift to selected people in bulk. Copy last month's roster in one click.
- Attendance now uses the employee's shift for that day instead of the fixed 10:00 rule: late = check-in after shift start + grace. Night shifts that cross midnight are recorded against the day the shift starts.
- Employee's own Attendance page shows today's shift timings, and the history table shows the shift for each day.

## 2. Reason made compulsory

- Reason is already required for corrections/early leave; the field will be labelled required, trimmed, given a minimum of 10 characters and a visible error, and the same minimum enforced in the database so it cannot be bypassed.
- Approve/reject notes stay optional, except reject, which will require a note.

## 3. HR controls for early leave and regularization

New **Attendance rules** settings page for HR, per company:

- Early leave: on/off; maximum hours allowed early per instance; maximum number of early leaves per month.
- Regularization (missed check-in/check-out): on/off; maximum requests per month; how far back a date can be corrected (days).
- When a type is switched off, employees don't see that option at all.
- When a monthly cap is reached, the request is refused with a clear message ("You have used 3 of 3 corrections for October"), enforced both in the form and in the database.
- The request dialog shows the remaining allowance for the month.

## Technical notes

- Tables: `shifts` (company_id, name, start_time, end_time, break_minutes, grace_minutes, is_default, is_active), `employee_shifts` (company_id, user_id, period_month date, shift_id, unique per user+month), `attendance_rules` (company_id one row: early_leave_enabled, early_leave_max_hours, early_leave_max_per_month, regularization_enabled, regularization_max_per_month, regularization_backdate_days). All with GRANTs, RLS scoped by `current_company_id()`, HR/admin write, all members read, and `updated_at` triggers.
- Helper `public.shift_for(_user uuid, _date date)` returns the effective shift row; `clock_in()` replaces the hardcoded `10:00` late test with shift start + grace.
- Trigger on `attendance_requests` insert: reject when the type is disabled, when reason length < 10, when backdate window exceeded, and when the monthly count of non-rejected/non-cancelled requests of that type is at or above the cap.
- New pages `src/pages/Shifts.tsx` and `src/pages/AttendanceRules.tsx`, routed under Company for HR/admin; sidebar entries added. `AttendanceRequests.tsx` reads the rules to hide disabled types and show remaining allowance.
