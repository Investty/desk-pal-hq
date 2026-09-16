# Apply the HRMS brand system across the app

## Goal
Use the attached `brand-tokens.html` as the styling source of truth while preserving all existing HRMS behavior and role access.

## What will change

### 1. Install the global brand foundation
- Copy the complete token set into the global stylesheet: blue and violet scales, neutrals, status colors, sidebar colors, surfaces, shadows, typography, radii, spacing, and transitions.
- Map the app's existing semantic theme roles (`background`, `foreground`, `primary`, `secondary`, `card`, `border`, statuses, and sidebar roles) onto those exact brand values.
- Set the page background to `#F0F4FF`, primary actions to `#2563EB`, secondary highlights to `#7C3AED`, and the sidebar to `#111827`.
- Load Inter locally through the app package rather than a remote CSS import, then apply the supplied type sizes and weights to headings, body text, labels, and metadata.

### 2. Expose the tokens consistently in Tailwind
- Extend Tailwind with the full primary, secondary, neutral, success, warning, danger, info, surface, and sidebar token families.
- Map the supplied small, medium, large, extra-large, and pill radii to the corresponding Tailwind radius utilities.
- Add token-backed shadows, font family, spacing, and transitions where the app needs named utilities.
- Keep existing semantic utility names working so current screens inherit the new brand without business-logic changes.

### 3. Restyle shared UI controls
- Update shared Buttons to match the preview: blue primary, violet secondary, outlined blue, neutral ghost, and red destructive styles with medium radii.
- Expand Badges with explicit role/department and status variants. Per the request, both role and department tags will use violet; Active uses green, Pending amber, Terminated red, and On Leave info blue.
- Update Cards to use the exact white surface, border, large radius, and supplied shadow; add reusable blue, violet, green, and amber accent treatments for stat cards.
- Update Data Tables with the supplied typography, neutral headers and dividers, compact spacing, and restrained row interaction.
- Align inputs, dialogs, dropdowns, tabs, and other shared controls with the supplied radius and focus rules so the system is visually consistent beyond the five named components.

### 4. Apply the rules to the HRMS screens
- Update the main sidebar to use the exact dark background, muted text, blue active tint, and blue active border from the reference.
- Update dashboard stat cards to use the branded accent treatments and typography hierarchy.
- Replace generic badge choices on employee, role, attendance, leave, onboarding, performance, owner, and approval screens with the correct semantic role/department/status variants.
- Keep primary links and CTAs blue and reserve violet for secondary actions, roles, departments, and secondary highlights.
- Remove remaining conflicting one-off status colors in application code where they bypass the shared design system.

### 5. Verify the result
- Check the login screen, dashboard/sidebar, employee table, leave statuses, and role-management views at desktop and mobile widths.
- Confirm typography, colors, radii, shadows, focus states, and status meanings match the supplied preview without text clipping or layout overlap.
- Run the relevant automated checks and inspect the rendered pages for regressions.

## Technical notes
- The uploaded HTML remains a reference file; its preview-only layout styles will not be copied into the production app.
- Exact brand custom properties will be retained in CSS, with semantic aliases added for the existing component system.
- No permissions, workflows, data, or backend behavior will change.
