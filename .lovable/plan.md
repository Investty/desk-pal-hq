# Brand every platform notification

## Goal
Make every toast notification follow the established MiniHRMS design system while preserving its existing message and behavior.

## What will change

### 1. Create one branded notification system
- Keep Sonner as the single notification renderer and remove the unused duplicate legacy renderer from the app shell.
- Style the toast surface with Inter, the shared border, medium radius, card shadow, compact spacing, and responsive desktop/mobile placement.
- Add consistent Lucide icons and semantic treatments: green success, red error, amber warning, and blue information/loading.
- Brand close, action, and cancel controls with the existing shared color and focus tokens.

### 2. Route every notification through it
- Replace direct package imports across pages and feature components with the project notification wrapper.
- Preserve current success/error copy and workflows; this change is visual and structural only.
- Set consistent timing and accessibility defaults so messages remain readable without lingering unnecessarily.

### 3. Make it a permanent design-system rule
- Document toast meaning, anatomy, duration, position, and prohibited one-off styling in the project design guide.
- Record the completed work in the project roadmap.

### 4. Verify
- Run automated checks.
- Trigger representative success and error notifications in the live preview and inspect desktop and mobile presentation, stacking, dismissal, focus, and text wrapping.

## Technical notes
- No database, permission, workflow, or notification wording changes are included.
- Existing legacy toast files may remain for compatibility, but they will no longer be mounted or used by application features.
