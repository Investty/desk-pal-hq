# Fix cross-account attendance status and dashboard card alignment

## Changes
- Scope every personal attendance query and cache key to the signed-in user, including today's status, history, calendar, requests, usage, rules, and shifts.
- Add an explicit employee filter to attendance reads so a previous account's record can never populate another account's screen.
- Keep Admin's company summary row unchanged, but place a Manager's Pending Approvals card in the same grid as Today's Status and leave balances.
- Ensure personal queries wait until the current account is available.

## Validation
- Switch from the checked-in employee to an unchecked-in HR/Manager without refreshing and confirm the dashboard and Attendance page both show the correct status immediately.
- Confirm the Manager approval card aligns with the other dashboard cards and still opens Approvals.
