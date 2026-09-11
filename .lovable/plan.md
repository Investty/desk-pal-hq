# Offboarding, rejoining, and a product-owner control panel

Two things get built: the ability to remove someone from a company (and let them join again later, or join a different company), and a top-level owner area where you manage every company, their plan, and which features they get.

## 1. Removing an employee

- HR and Admin get a "Remove from company" action on each person in Employees, with a reason and last working day.
- Removing marks the person as removed in that company: they lose their role, their sidebar and data access for that company stop immediately, and their records (attendance, leave, payslips) stay for reporting.
- Removed people are shown in a separate "Former employees" tab, with who removed them and when.
- The last remaining Admin of a company cannot be removed.
- HR/Admin can restore a removed person back into the same company in one click, which brings back their role and leave balances.

## 2. Joining another company (or rejoining)

- A person's account is no longer locked to one company. They can belong to several.
- A signed-in user can enter an invite code from a "Join a company" screen; that adds them to the new company with the role on the invite. If they were previously removed from that company, the old record is reactivated instead of duplicated.
- When someone belongs to more than one company, a company switcher appears at the top of the sidebar. Everything they see (people, attendance, leave, payroll) follows the company they are currently in.
- If a person belongs to no active company, they see the "Join a company" screen instead of an empty dashboard.

## 3. Product-owner view (across all companies)

- A separate owner area at `/owner`, visible only to accounts you mark as product owner. Regular admins and HR cannot see or reach it.
- Overview: total companies, total people, active vs suspended, signups over time.
- Company list with people count, plan, status, created date, and search.
- Per company you can:
  - Change plan (Free / Starter / Pro / Enterprise) and seat limit.
  - Suspend or reactivate a company. Suspended companies see a "account suspended" screen instead of the app.
  - Turn individual features on or off: Payroll, Performance, Onboarding, Documents, Attendance regularization, Announcements, Reports, Org chart, Audit logs.
  - Rename the company, set a trial end date, and leave internal billing notes.
- Feature switches take effect in the app: hidden from the sidebar and blocked if the URL is entered directly. Seat limit blocks new invites from being redeemed once reached.

## Technical notes

- Database: `profiles` gains `status`, `removed_at`, `removed_by`, `last_working_day`, and drops the one-profile-per-user assumption (unique on `user_id, company_id`). New tables: `platform_admins`, `company_features`; `companies` gains `plan`, `status`, `seat_limit`, `trial_ends_at`, `notes`.
- New table `user_active_company` drives `current_company_id()`, falling back to the newest active membership. `has_role`/`is_hr` become company-scoped so a manager in company A is not a manager in company B.
- Security-definer RPCs: `remove_employee`, `restore_employee`, `redeem_invite`, `set_active_company`, plus owner-only `owner_list_companies`, `owner_update_company`, `owner_set_feature`. Every owner RPC checks `is_platform_admin()`; RLS on the new tables blocks non-owners.
- Frontend: `AuthContext` exposes memberships, active company, enabled features, and `isPlatformAdmin`; route guards read feature flags and company status; new pages `Owner.tsx` and `JoinCompany.tsx`; Employees page gains remove/restore.
- Your account (`varunagoyal98@gmail.com`) is seeded as the first product owner.
