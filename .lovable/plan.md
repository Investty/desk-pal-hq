# Bigger lists, company work week, yearly leave calendar, new leave types

Focused on the four things you named. Bereavement leave already exists today (sick, casual, paid, compensatory, bereavement), so only maternity and paternity are new.

## 1. Paging, date range and search on every long list

Today: attendance stops at the last 30 days, approvals at 50, audit log at 100, team at 100, and the employee list loads everyone at once with only a name search. Older records cannot be reached at all.

- **Attendance**: month/date-range picker plus paging, so any past month can be opened.
- **Approvals**: filter by status, type and date range, with paging; pending stays the default view.
- **Audit log**: search by action or entity, date range, paging.
- **Team**: name search and paging.
- **Employees**: keep the search, add department and status filters, and page the results instead of loading everyone.

Counts shown ("showing 1-25 of 340") on each list.

## 2. Work week per company

- A company setting for weekly offs (tick the days that are non-working; default Saturday and Sunday).
- Used by the nightly absent marking, leave day counting and attendance reports, so a six-day or Friday-off company is no longer marked absent wrongly.
- Editable on the Company screen by HR and admin.

## 3. Yearly leave calendar, per company

- A new Calendar view on the Leave screen: full-year grid for the selected year showing company holidays, weekly offs, and approved leave.
- Two modes: "My leave" and "Company" (everyone's approved public leave), half-days marked.
- Year picker, so next year can be planned once holidays are set.

## 4. Maternity and paternity leave

- Added as leave types alongside the existing ones.
- Both appear in Leave Types where HR sets the days allowed and turns them on or off per company, same as the current types, and are picked up automatically by balances and the apply form.

## Technical notes

- `companies.weekly_offs smallint[] not null default '{0,6}'`; helper `is_working_day(_company uuid, _date date)` used by `close_attendance_day()`, `leave_days()` and `request_days()`.
- Leave-day counting changes from a plain date difference to skipping weekly offs and holidays; existing balances are not recalculated retroactively.
- Enum `leave_type` gains `maternity` and `paternity`; `leave_policies` rows seeded per existing company (disabled by default) so HR opts in.
- Lists move to Supabase `range()` paging with `count: "exact"`; filter state held in URL params and in the React Query key.
- Calendar data from a new security-definer `get_leave_calendar(_from date, _to date)` scoped by `current_company_id()`, returning approved leave (own always, others only when public), holidays and weekly offs.
