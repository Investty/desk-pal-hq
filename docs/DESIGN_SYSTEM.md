# MiniHRMS Design System

## Authority

`docs/brand-tokens.html` is the canonical visual reference for this project. This document translates that reference into enforceable implementation rules for every future screen and component.

If a new design request conflicts with the canonical reference, update the reference and this guide together before changing the product UI.

## Brand character

- Professional, clear enterprise HR software.
- Inter is the only product typeface.
- Primary blue drives navigation and action.
- Secondary violet identifies roles, permissions, plans, and limited secondary highlights.
- Surfaces stay neutral and use the faint blue page background.
- Status meaning never changes between modules.

## Color responsibilities

### Primary blue

Main: `#2563EB`.

Use for:
- Primary actions
- Links
- Active navigation and tab indicators
- Focus rings
- Department badges
- Primary chart series

### Secondary violet

Main: `#7C3AED`.

Use for:
- Roles and permissions
- Subscription plans and tiers
- Secondary actions
- Secondary chart series
- Onboarding highlights and feature flags

Never use violet for a primary action. Never use blue for role or permission badges. Avoid using violet in more than three places on one screen.

### Status colors

Use only these mappings:

| Meaning | Token family | Example |
|---|---|---|
| Active / success / approved | `success` | Green |
| Pending / warning / late | `warning` | Amber |
| Terminated / danger / rejected | `danger` or `destructive` | Red |
| On leave / informational | `info` | Blue |

Do not create module-specific status colors.

### Neutral and surface colors

- Page: `surface-page` / `background`
- Card: `surface-card` / `card`
- Borders: `surface-border` / `border`
- Primary text: `neutral-900` or semantic `foreground`
- Body text: `neutral-700`
- Secondary text: `neutral-600` or `muted-foreground`
- Metadata: `neutral-500`
- Sidebar: sidebar semantic tokens only

## Typography

| Purpose | Size | Weight |
|---|---:|---:|
| Page heading | 1.875rem | 800 |
| Section title | 1.5rem | 700 |
| Card heading | 1.25rem | 600 |
| Subheading | 1.125rem | 500 |
| Body | 1rem | 400 |
| Secondary/form/table text | 0.875rem | 400 |
| Caption/meta/badge | 0.75rem | 500 |

Letter spacing remains `0` throughout the application for readability and platform consistency. Do not add negative tracking in feature code.

## Shape, elevation, and spacing

| Element | Radius |
|---|---|
| Small chips and compact marks | `rounded-sm` / 0.25rem |
| Inputs, buttons, dropdowns | `rounded-md` / 0.375rem |
| Cards and panels | `rounded-lg` / 0.5rem |
| Dialogs and modals | `rounded-xl` / 0.75rem |
| Status pills and avatars | `rounded-full` |

- Cards use `shadow-card`; elevated/hovered cards use `shadow-card-hover`.
- Use the shared spacing scale only.
- Do not use `rounded-2xl`, `rounded-3xl`, arbitrary radii, decorative orbs, or unrelated shadows.

## Shared components

- Use `Button` for every action. Use `default` for primary actions, `secondary` only for role/category actions, `outline` for secondary commands, `ghost` for low-emphasis actions, and `destructive` for destructive actions.
- Use `Badge` variants: `department` for blue department tags, `role` for violet role tags, and semantic status variants for state.
- Use shared Card, Input, Select, Table, Tabs, Dialog, Alert, and Toast components instead of recreating their styling on a page.
- Icon-only actions require an accessible label and a visible browser tooltip/title.
- Charts use semantic CSS variables, never literal color values.

## Prohibited patterns

- Direct Tailwind palette colors such as `bg-blue-600`, `text-red-500`, `border-gray-200`, `bg-black`, or `text-white` in product components.
- Hex, RGB, or HSL values in feature components.
- Raw HTML action buttons when the shared Button can be used.
- Violet primary calls to action or violet department badges.
- New status colors or inconsistent status meanings.
- One-off typography, shadows, gradients, or radii in feature pages.

Print/export documents may use literal values because they render outside the application CSS, but those values must match the canonical Inter, neutral, primary, and border palette.

## Review checklist

Before completing any interface change:
1. Confirm colors come from semantic tokens.
2. Confirm the color's purpose matches the responsibility above.
3. Confirm typography follows the hierarchy.
4. Confirm radius matches the element category.
5. Confirm actions use shared controls.
6. Check desktop and mobile layouts for clipping and overlap.
7. Check empty, loading, error, disabled, and focus states.