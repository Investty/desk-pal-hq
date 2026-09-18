# Brand-system alignment

## Audit result

The project is **partially aligned**, not fully aligned.

Already correct:
- The complete blue, violet, neutral, status, sidebar, surface, spacing, radius, and transition token families are present globally.
- Tailwind exposes the uploaded palette, semantic app colors, Inter, radii, and card shadows.
- Inter is loaded in the document.
- Shared cards, inputs, tables, tabs, and most buttons already follow the intended visual language.
- The sidebar structure, page background, cards, and most role badges are close to the reference.

Gaps found:
- The global tight-letter-spacing token is `0em`, but the reference specifies `-0.025em` for page and section headings.
- Department badges use violet; the reference assigns departments to primary blue and reserves violet for roles, permissions, plans, and secondary highlights.
- Several overlays/toasts use direct black, red, or amber utilities rather than semantic brand tokens.
- A few dialogs and page elements use radii larger than their assigned token category.
- Some app controls use raw HTML buttons instead of the shared branded Button.
- The sidebar uses a brighter inactive text color and larger item radius than the reference.
- The printed payslip has separate unbranded typography and colors.
- The original Vite demo stylesheet remains in the repository, although it is currently unused.
- No permanent project design-system document currently defines usage rules for future development.

## Implementation chunks

### Chunk 1 — Canonical tokens and shared controls
- Correct the typography token and map every uploaded token exactly.
- Align shared Button, Badge, Card, Table, Input, Tabs, Dialog, Sheet, Drawer, Alert, Toast, and status treatments.
- Correct department badges to blue and keep roles/permissions violet.
- Replace direct overlay and notification colors with semantic tokens.
- Remove the unused starter stylesheet.

### Chunk 2 — Navigation and account screens
- Align sidebar inactive/active states, borders, spacing, and radii to the reference.
- Replace raw sidebar actions with shared icon-button styling and accessible labels/tooltips.
- Align Login, Signup, Reset Password, Join Company, and Setup controls and radii.

### Chunk 3 — Product pages
- Sweep all operational pages in small groups: Dashboard/Employees, Attendance/Shifts, Leave, Payroll, Reports, Company/Admin, Owner.
- Replace remaining one-off visual classes with semantic tokens.
- Standardize page headings, card titles, status pills, tables, empty states, and filters.
- Preserve all existing workflows and business logic.

### Chunk 4 — Payroll print and visual verification
- Brand the printable salary slip using the same Inter hierarchy, neutral palette, borders, and spacing.
- Verify representative employee, manager, HR/admin, and owner screens at desktop and mobile widths.
- Check contrast, clipping, and consistency of badges, tables, dialogs, and navigation.

### Chunk 5 — Future-development guardrail
- Add a project design-system document containing the canonical tokens, component rules, color responsibilities, typography hierarchy, radii, status mappings, and prohibited patterns.
- Reference it from the README as the mandatory source for future interface work.
- Record the same rule in persistent project guidance so later work must follow it.

## Completion criteria
- Primary actions, links, focus rings, and active navigation use Primary Blue.
- Roles/permissions/plans use Secondary Violet; departments use Primary Blue.
- Active, Pending, Terminated, and On Leave use only the specified semantic status colors.
- Inter and the specified type hierarchy are consistent.
- Inputs/buttons use medium radius, cards use large radius, dialogs use extra-large radius, and pills/avatars use full radius.
- Feature files contain no avoidable direct palette colors or unstyled raw action buttons.
- The design-system document is the declared source of truth for future development.
