# UI/UX Component Rules

## General Rules

Use existing Next.js, Tailwind CSS, and shadcn/ui patterns.

Prefer:

```text
tabs for major modes
tables for dense operational history
cards for individual repeated items or grouped context
badges for statuses
stepper/progress for imports
dialogs for confirmation
forms with visible labels
```

Do not create nested card-heavy layouts or decorative dashboard shells.

## Attendance Operations Components

Future Attendance Data Operations should include:

```text
file selector
period from
period to
upload mode selector
preflight summary
processing stepper
polling status area
final summary
warnings/issues table
import history table
maintenance impact preview
typed confirmation dialog
audit-aware final summary
```

## Upload Modes

Represent upload modes as clear controls:

```text
Daily MTD Override
Historical Backfill
Recalculate Only
```

Each mode should display concise operational impact before submit.

## Dangerous Operations

Dangerous operations must not be one-click.

Required UI states:

```text
impact preview
typed confirmation
processing state
completion summary
error recovery state
```

## Data Display

Attendance metrics should use dense, scannable layouts.

Tables must handle:

```text
long names
large issue lists
mobile widths
empty states
loading states
error states
```

Do not add fake metrics or placeholder users in production UI.
