# Product review: what is still weak, and what I will fix now

The critical items from the last review (absent marking, forgotten check-outs, clashing leave, server clock, password reset, app name) are live and working. Here is what is left.

## Issues found

### High impact
1. **No email alerts.** Every notification is in-app only. Someone who does not open the app never learns a leave request is waiting, approved or rejected.
2. **Long lists are cut off.** Attendance shows the last 30 days, approvals 50 items, audit log 100, team 100 — with no paging, no date range and no search. Once a company grows past a few months, older records simply cannot be reached from the app.
3. **No work-week or holiday-week setup.** The system treats Saturday and Sunday as the weekend for every company. A company working six days, or resting on Friday, is marked absent wrongly every week.
4. **Employee list has no search, filter or paging**, so finding one person in a large company means scrolling.

### Medium impact
5. **No leave calendar** — no month view of who is away, so planning cover is guesswork.
6. **Payslips can only be printed**, not downloaded as a file to email or archive.
7. **No bulk employee import**, so onboarding a company of 200 means 200 manual forms.
8. **Announcements and platform Messages are two separate inboxes** showing in the same place, which is confusing.

### Low impact
9. No export to CSV outside the attendance report.
10. Mobile layout is usable but cramped on approval and report tables.

## What I will build in this round

**1. Email alerts for leave and attendance decisions**
Send an email alongside each existing in-app notification: request submitted (to the manager), manager approved (to HR and the employee), final approval, rejection, and cancellation with the note. Uses the built-in email sending; each person can turn emails off from their profile.

**2. Work-week and holiday settings per company**
Add a weekly-off setting on the company (default Saturday and Sunday) and use it everywhere the system decides "is this a working day": the nightly absent marking, leave day counting and attendance reports.

**3. Paging, date range and search on the long lists**
Attendance history, approvals, audit log, team view and the employee list get a page control, a date range where it applies, and a name search. Nothing is silently cut off any more.

**4. Leave calendar**
A month view on the leave screen showing approved leave and holidays for the whole company, with half-days marked.

## Technical notes

- New `companies.weekly_offs` (array of weekday numbers, default `{0,6}`), plus a `is_working_day(company, date)` helper used by `close_attendance_day()`, `leave_days()` and `request_days()`.
- New edge function `send-notification-email`, called from the existing notification triggers through `pg_net`, reading recipients from `profiles.email`; add `profiles.email_notifications boolean default true`.
- Client lists move to `range()` based paging with a total count, filters held in URL params so a view can be shared.
- Leave calendar reuses `get_people_on_leave_today` logic generalised to a date range as `get_company_leave_calendar(_from, _to)`, security definer, company scoped.
- All new tables/columns follow the existing tenancy rule: `company_id` plus RLS through `current_company_id()`.

Items 6 to 10 stay open for a later round.
