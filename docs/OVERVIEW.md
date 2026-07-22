# Crikket — Technical Overview & Usage Guide

> Living document. Keep it current as the system evolves. Last substantive
> update: 2026-07 (Paper Tiger internal build).

Crikket is Paper Tiger's self-hosted bug‑capture and issue‑tracking system. A
lightweight widget embedded on client sites lets people file issues with a
screenshot or screen recording plus console / network / action context; those
reports land in a dashboard where the team triages them.

---

## 1. Monorepo layout

Bun workspaces + Turborepo. Key packages:

| Path | What it is |
| --- | --- |
| `apps/web` | Next.js (App Router) **dashboard** — where reports are viewed/triaged. Serves the widget bundle at `/capture.js`. |
| `apps/server` | Hono + oRPC API. Hosts the embed ingest endpoints and the RPC API. |
| `apps/docs` | Fumadocs marketing/docs site (separate from this file). |
| `apps/extension` | Browser extension surface. |
| `sdks/capture` | The **embeddable widget** (`@crikket-io/capture`), TypeScript + React, built to an IIFE global bundle exposing `window.CrikketCapture`. |
| `packages/db` | Drizzle schema + migrations (Postgres). |
| `packages/bug-reports` | Bug‑report business logic: ingest, list, stats, update. |
| `packages/api` | oRPC routers exposed to the dashboard. |
| `packages/shared` | Cross‑cutting constants/types (statuses, categories, priorities, visibility). |
| `packages/ui` | `@crikket/ui` — shadcn‑style component library on Base UI, including a full data‑table suite. |
| `packages/auth`, `packages/billing`, `packages/env` | Auth (Better Auth), billing, env validation. |

---

## 2. Database

- Postgres, managed with **Drizzle**. Schema in `packages/db/src/schema/`,
  migrations in `packages/db/src/migrations/`.
- **The Crikket tables live in the `crikket` schema** (not `public`) of the
  shared "Paper Tiger Dashboard" Supabase project. Migrations use unqualified
  table names; the connection's `search_path` resolves them to `crikket`.
- Migrations are **applied manually** (`bun db:migrate` from `packages/db`
  with the Crikket `DATABASE_URL`) — there is no migrate‑on‑deploy hook.
  Drizzle tracks applied migrations in `drizzle.__drizzle_migrations` (the
  hash is the SHA‑256 of the migration file).

### Core entity: `bug_report`
Notable columns: `organization_id` (tenant), `reporter_id`, `assignee_id`,
`capture_public_key_id` (which key/domain submitted it), `title`,
`description`, `category`, `status`, `priority`, `tags`, `url` (page captured),
`attachment_type` (`video`|`screenshot`), capture/thumbnail/debugger artifact
keys, `submission_status`, `visibility`, `metadata`/`device_info` (jsonb).

`bug_report_upload_session` is the staging row written during ingest and
promoted into `bug_report` at finalize. Child tables hold rrweb/debugger
artifacts: `bug_report_log`, `bug_report_network_request`, `bug_report_action`.

### Enumerations (source of truth: `packages/shared/src/constants/bug-report.ts`)
- **Status:** `to_do`, `in_progress`, `client_review`, `blocked`, `done`,
  `closed`. Stored as free text (no DB enum). "Closed" is used as a filter.
- **Category:** `feature`, `bug`, `content`, `question`.
- **Priority** (`packages/shared/.../priorities.ts`): `none`, `low`, `medium`,
  `high`, `critical`.
- **Visibility:** `public`, `private` (defaults to `private`).

### Capture keys & projects
`capture_public_key` rows are **org‑scoped**, each with a `label` and an
`allowed_origins` list. A "project" corresponds to a capture key: reports
carry `capture_public_key_id` so they can be grouped by project.

---

## 3. The capture widget (`sdks/capture`)

### Embedding
The dashboard self‑hosts the built IIFE bundle at `/capture.js`
(`apps/web/public/capture.js`). Client snippet:

```html
<script src="https://<cp-host>/capture.js" defer
  onload="CrikketCapture.init({ key: 'crk_...', host: 'https://<api-host>' })"></script>
```

`CrikketCapture.init(options)` — key options: `key` (public capture key),
`host` (API origin), `screenshotMode` (`"dom"` default | `"display"`),
`submitTransport` (override the default upload flow), `zIndex`.

### Capture UX
- Clicking **Report Issue** opens the **New Issue** widget.
- **Screenshot (default `screenshotMode: "dom"`):** a crosshair overlay lets
  the user drag‑select a region; the page is rasterized **in‑browser with
  [snapdom](https://github.com/zumerlab/snapdom)** — no screen‑share
  permission prompt. Falls back to `getDisplayMedia` if rasterization fails.
- **Recording:** uses `getDisplayMedia` (tab share).
- **Annotation:** a **Konva**‑based editor with select/move/resize, arrow,
  rectangle, pen, highlight, text, blur, and emoji tools.
- **Form:** required **Description**, a **Category** select (default Bug), and
  **Priority**. Title is intentionally left blank (generated from content
  later). Console/network/action context is captured via `packages/capture-core`
  and attached to the report.

### Submission flow (`sdks/capture/src/transport/default-submit-transport.ts`)
Three steps against `host` + `submitPath` (default `/api/embed/bug-reports`):
1. `POST /api/embed/capture-token` — authorize the public key + origin (Turnstile).
2. `POST /api/embed/bug-report-upload-session` — create the staging row and get
   direct‑upload URLs; the client uploads the media + debugger artifacts.
3. `POST /api/embed/bug-report-finalize` — promote the session into `bug_report`.

Build: `bun run build` in `sdks/capture` (watch: `bun run dev`). **After any
SDK change, resync the served bundle:** `cp dist/capture.global.js
apps/web/public/capture.js`, then commit — that file is what `/capture.js`
serves.

---

## 4. The dashboard (`apps/web`)

- App Router; data via **oRPC + TanStack Query**; URL state via `nuqs`; auth
  via Better Auth organizations.
- UI from **`@crikket/ui`** (shadcn‑style on Base UI). Reusable **data‑table
  suite** at `@crikket/ui/components/data-table/*` + `useDataTable`.
- Bug reports list: `apps/web/src/app/(protected)/(dashboard)/` — the toolbar,
  filters, cards, and detail view (`/s/[id]`) live here. Stats come from
  `getBugReportDashboardStats` (`packages/bug-reports/src/procedures/list-bug-reports.ts`).
- Sidebar nav: `apps/web/src/components/app-sidebar.tsx` (grouped sections —
  "Platform", "Settings"; a "Projects" section is being added).

---

## 5. Common tasks

- **Run the dashboard:** `bun run dev:web` (needs env incl. `DATABASE_URL`,
  `NEXT_PUBLIC_*`).
- **Iterate on the widget:** `bun run dev` in `sdks/capture`; test on a plain
  HTML page that loads `dist/capture.global.js`.
- **Add/adjust a status or category:** edit the constant in
  `packages/shared/src/constants/bug-report.ts` and its label spots; migrate
  data if values change.
- **Apply a migration:** generate with `bun db:generate` (offline), review the
  SQL, then `bun db:migrate` with the Crikket `DATABASE_URL`.
- **Run SDK tests:** `bun test test` in `sdks/capture`.

---

## 6. Conventions

- Design system: **stock shadcn**, neutral palette, radius `0.625rem`, system
  font stack. Prefer `@crikket/ui`; don't invent variants/colors.
- Statuses/categories/priorities always resolve through
  `packages/shared/constants` — never hard‑code the string literals in UI.
- Keep migrations idempotent and record them in drizzle's journal when applied
  out of band.
