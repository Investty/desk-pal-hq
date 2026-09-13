# Product review: issues found and what to fix first

I went through the whole product — attendance, leave, approvals, profiles, payroll, company setup and the owner console. Below is everything I found, grouped by how much it hurts, followed by exactly what I'd fix now.

## Critical (fix now)

1. **Nobody is ever marked absent.** Attendance rows only exist if a person clicks Check In. Anyone who simply doesn't show up leaves no record, so attendance reports, the "Yesterday's attendance" panel and any monthly count are wrong. There is no end-of-day process that closes the day.
2. **Overlapping leave can be applied twice.** A person can apply for the same dates again and again — including a full day on top of two half days — and every request can be approved, double-spending the balance.
3. **Forgotten passwords have no way out.** The sign-in screen has no "Forgot password" link and there is no reset screen, so a locked-out person needs an administrator every time.
4. **Attendance uses the browser's clock and date.** Someone can change their device clock or travel time zones and check in for the wrong day, or avoid being marked late. The day and time should be decided by the server.
5. **People never leave a day open forever.** If someone checks in and never checks out, the record stays half-finished with no working hours and no way for anyone to close it except a correction request.
6. **The app still shows the default name.** The browser tab, search results and link previews say "Lovable App" / "Lovable Generated Project" instead of the product name.

## Important (next round)

7. All alerts are inside the app only — no email when leave is applied, approved, rejected or when an account is invited.
8. Long lists (employees, attendance history, audit log, approvals) are capped at 30–100 rows with no paging, filters or date range, so older data is simply unreachable.
9. No leave calendar view — managers cannot see who is off across a month before approving.
10. Payslips cannot be downloaded as a file; printing is the only option, and there is no year-to-date summary.
11. No weekly-off or shift settings, so weekends and holidays are treated like ordinary working days in attendance counts.
12. No bulk import of employees — onboarding a company of 200 means 200 manual entries.

## Nice to have (later)

13. Export to Excel/CSV on reports, attendance and payroll.
14. Employee search/filter on the manager team view.
15. Mobile layout polish on the wide tables.
16. Duplicate concepts: Announcements (inside a company) and platform Messages look similar to people; worth merging the presentation.

## What I will build in this pass

- **Absent day closing.** A scheduled job runs each night and, for every active person in every company, writes an absent record for the previous working day when there is no check-in, skipping holidays, weekends and approved leave.
- **Open shift closing.** The same job closes forgotten check-outs and records the hours as zero, flagged so the person can raise a correction.
- **Overlap protection.** Applying for leave that clashes with an existing pending or approved request is refused, with a clear message naming the clashing dates. Half-day plus half-day on the same date stays allowed; anything beyond a full day is refused.
- **Server-decided attendance time.** Check-in and check-out go through the backend, which sets the date, time and late status, so the device clock no longer matters.
- **Password reset.** A "Forgot password" link on sign-in that emails a reset link, plus the screen to set a new password.
- **Product identity.** Real page title, description and link-preview text.

## Technical notes

- New edge function `attendance-rollover` invoked by a `pg_cron` schedule (daily, 20:00 UTC) using the service role; iterates companies, excludes `holidays`, weekends and approved `leave_requests`, inserts `attendance` rows with status `absent`, and closes `check_out IS NULL` rows.
- New edge function `attendance-clock` for check-in/out; client stops sending `date`/`check_in`. Existing insert policies tightened so `date` must equal the server's current date.
- Overlap enforced by a `BEFORE INSERT OR UPDATE` trigger on `leave_requests` summing `request_days` for overlapping non-cancelled/non-rejected rows per user per date, rejecting when the total exceeds 1 day.
- Password reset via `supabase.auth.resetPasswordForEmail` with `redirectTo = ${window.location.origin}/reset-password`, plus a new `/reset-password` route handling the recovery session.
- Metadata edits in `index.html` only.
