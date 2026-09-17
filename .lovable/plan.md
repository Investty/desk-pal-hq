# Upgrade Reports & Analytics

## Goal
Turn Reports & Analytics into a responsive decision dashboard where HR and Admin users can quickly understand workforce, attendance, leave, and payroll trends.

## What will change

### 1. Add useful filters and summary metrics
- Add a clear reporting-period selector and department filter at the top of the page.
- Show KPI cards for active headcount, attendance rate, approved leave days, and estimated monthly payroll.
- Include short contextual comparisons or coverage details so each number is understandable.

### 2. Improve each analytics section
- Workforce: use a horizontal department headcount chart so long department names remain readable.
- Attendance: show present, late, and absent trends across the selected period with a clear legend and formatted dates.
- Leave: show approved leave days by type using a compact distribution chart and readable labels.
- Payroll: show gross pay, deductions, and net payout using calculated salary data already available to authorized users.

### 3. Add clear states and drill-downs
- Show polished loading placeholders while data is being retrieved.
- Display meaningful empty states for sections without records instead of blank charts.
- Add direct links from each section to the relevant employee, attendance, leave, or payroll detail page.
- Surface data-loading errors without hiding the rest of the page.

### 4. Make the dashboard responsive and consistent
- Follow the existing blue/violet HRMS brand tokens, typography, card radii, status colors, and shared controls.
- Keep labels, legends, and tooltips readable on narrow screens, with stable chart heights and no clipping.
- Preserve existing HR/Admin access rules and company-scoped data behavior.

### 5. Verify
- Check calculations and filtering against the existing company data.
- Verify desktop and mobile layouts, chart labels, empty states, links, and loading behavior.
- Run the relevant type and automated checks.

## Technical notes
- This is a presentation and reporting-query upgrade; no HR workflows or database schema will change.
- Existing company-scoped access rules continue to determine which records each authorized user can see.
- Payroll figures use the established salary calculation utility rather than duplicated formulas.
