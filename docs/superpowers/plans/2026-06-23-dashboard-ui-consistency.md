# Dashboard UI Consistency Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Admin, Area Manager, Champ, and Picker dashboard-only UI patterns visually consistent without changing data contracts or backend logic.

**Architecture:** Add a small shared dashboard UI layer under `apps/web/components/workspaces/dashboard-ui/`, then migrate existing dashboard cards, section headers, rank marks, status badges, table/mobile row patterns, and empty/unavailable states to those primitives. Existing role-specific components keep their data mapping responsibilities.

**Tech Stack:** Next.js, React, TypeScript, Tailwind CSS, lucide-react, existing SuperNova CSS tokens.

---

### Task 1: Shared style helpers

**Files:**
- Create: `apps/web/components/workspaces/dashboard-ui/dashboard-style-utils.ts`
- Test: `apps/web/components/workspaces/dashboard-ui/dashboard-style-utils.test.ts`

- [ ] Write failing tests for `dashboardStatusLabel`, `dashboardStatusToneClass`, and `dashboardRankToneClass`.
- [ ] Run `npx tsx apps/web/components/workspaces/dashboard-ui/dashboard-style-utils.test.ts` and confirm it fails because the module does not exist.
- [ ] Implement the helper module with shared status labels and rank tone classes.
- [ ] Re-run the focused test and confirm it passes.

### Task 2: Shared dashboard primitives

**Files:**
- Create: `apps/web/components/workspaces/dashboard-ui/dashboard-primitives.tsx`

- [ ] Create `DashboardCard`, `DashboardSectionHeader`, `DashboardSectionFooter`, `DashboardEmptyState`, `DashboardUnavailableState`, `DashboardPerformanceStatusBadge`, `DashboardRankMark`, `DashboardMetricGrid`, and `DashboardMetricItem`.
- [ ] Keep props simple and typed; do not add role-specific data mapping to shared primitives.

### Task 3: Admin dashboard migration

**Files:**
- Modify: `apps/web/components/workspaces/admin-dashboard/admin-dashboard-metric-card.tsx`
- Modify: `apps/web/components/workspaces/admin-dashboard/admin-dashboard-ranking-table.tsx`
- Modify: `apps/web/components/workspaces/admin-dashboard/admin-dashboard-branches-table.tsx`
- Modify: `apps/web/components/workspaces/admin-dashboard/admin-dashboard-top-pickers-table.tsx`

- [ ] Re-export shared card/header/state/status primitives from the existing Admin metric file for minimal call-site churn.
- [ ] Replace Admin ranking marks with `DashboardRankMark`.
- [ ] Replace duplicated mobile metric cells with `DashboardMetricGrid` and `DashboardMetricItem`.
- [ ] Keep Admin data, labels, and limits unchanged.

### Task 4: Area Manager dashboard migration

**Files:**
- Modify: `apps/web/components/workspaces/area-manager-dashboard/area-manager-metric-card.tsx`
- Modify: `apps/web/components/workspaces/area-manager-dashboard/area-manager-ranking-card.tsx`
- Modify: `apps/web/components/workspaces/area-manager-dashboard/area-manager-champs-table.tsx`
- Modify: `apps/web/components/workspaces/area-manager-dashboard/area-manager-branches-table.tsx`

- [ ] Re-export shared card/header/state/status primitives from the existing Area Manager metric file.
- [ ] Remove the redundant `UHO only` header pill from the dashboard ranking card.
- [ ] Replace local rank and mobile metric patterns with shared dashboard primitives.
- [ ] Keep all Area Manager data and role scope unchanged.

### Task 5: Champ and Picker dashboard migration

**Files:**
- Modify: `apps/web/components/workspaces/champ/champ-performance-dashboard.tsx`
- Modify: `apps/web/components/workspaces/role-workspaces.tsx`

- [ ] Replace Champ picker rank marks with `DashboardRankMark`.
- [ ] Align Champ panel/card/header/footer/empty-state visual primitives where safe.
- [ ] Align Picker rank scope cards with the shared rank mark and metric-grid visual language.
- [ ] Do not change request workflow actions, modals, or data loading.

### Task 6: Verification

**Commands:**
- `npx tsx apps/web/components/workspaces/dashboard-ui/dashboard-style-utils.test.ts`
- `npx tsx apps/web/components/workspaces/admin-dashboard/admin-dashboard-utils.test.ts`
- `npm run typecheck`
- `npm run lint`

- [ ] Run focused tests.
- [ ] Run typecheck and lint.
- [ ] Open dashboard pages on desktop and mobile widths if dev servers are running.
- [ ] Check for no horizontal overflow and visually consistent rank/status/table/card treatments.
