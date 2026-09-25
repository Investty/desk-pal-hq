# Fix: setup screen keeps coming back after dropping out

## What's happening (confirmed)
- Your new company **A0200128** (created Sep 21) has setup marked as not finished. Survey finished normally.
- Any admin whose company hasn't finished setup gets sent back to the setup screen every time they open the app. That part is on purpose, but there's no way out of it.
- **Bug:** "Skip for now" goes to the dashboard, which sends you straight back to setup. So skipping never works, and the only way out is to finish every step.
- Progress isn't saved either, so after leaving you start again at step 1.

## Changes
1. **Skip for now really skips.** The company is marked "setup skipped" and the admin goes to the dashboard. Setup won't take over the app again.
2. **Resume where you left off.** Each finished step is saved, so reopening setup starts at the next unfinished step and keeps what you already entered.
3. **Reminder on the dashboard.** Admins of a company whose setup isn't finished see a small "Finish company setup" card with a Continue button. It goes away once setup is finished.
4. Only a first-time admin who hasn't skipped is sent to setup automatically. Skipped or finished companies never are.

## Technical details
- Migration: add `setup_skipped_at timestamptz` and `setup_step int default 1` to `companies`. Admins can update them through a SECURITY DEFINER RPC `save_setup_progress(_step, _skip)` scoped to `current_company_id()` and `has_role(admin)`.
- `WorkspaceRoute` (App.tsx): redirect only when `!setup_completed_at && !setup_skipped_at`.
- AuthContext `CompanyInfo` selects the new columns. Setup.tsx sets its first step from `setup_step`, saves after each step, calls skip and then `refresh()` before going to the dashboard.
- Dashboard: admin-only resume card linking to `/setup`.
- Check: sign in as the A0200128 admin, skip, reload, and confirm the dashboard stays. Then reopen setup and confirm it resumes at the right step.
