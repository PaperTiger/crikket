# Deploying guest access + project teams

Two features are ready on `feat/guest-access`: **guest accounts** (clients log in and follow
specific projects) and **project teams** (org members pick which projects they're working on).

This release includes **two database migrations, one of which writes rows**. Read the ordering
section before starting.

Nothing here can be run from a developer laptop — it needs the production `DATABASE_URL` and
access to whatever host runs the images.

---

## Before you start

Two settings decide whether guest onboarding works at all in production. Neither can be checked
from the repo, and **if either is wrong the feature fails silently rather than loudly** — invites
appear to send and nothing arrives.

| Check | Why | If it's wrong |
| --- | --- | --- |
| `ALLOWED_SIGNUP_DOMAINS` on the server | If restricted to `papertiger.com`, clients signing up on their own domain get rejected | Invited guests can't create an account. There's a bypass for anyone holding a live invitation, but it has only run against the permissive local value |
| `RESEND_API_KEY` on the server | Guest invitations are emails; that's the whole onboarding path | The invitation row is created, the email is skipped with a log line, and the client never hears anything |

Confirm both before inviting a real client. Deploying without them doesn't break anything that
exists today — it just means the new guest flow doesn't work end to end.

---

## 1. Merge, in this order

The branch is stacked. `feat/guest-access` edits three files the breadcrumb work owns
(`bug-report-breadcrumbs.tsx`, `bug-report-view.tsx`, `get-bug-report.ts`), so it must not be
rebased onto `master` on its own.

1. Merge `feat/ticket-breadcrumbs` → `master`
2. Merge `feat/guest-access` → `master`

Pushing to `master` triggers `.github/workflows/docker-publish.yml`, which builds and pushes the
`web` and `server` images to GHCR. **That workflow publishes images; it does not deploy them.**

## 2. Run the migrations — before the new images serve traffic

The new code queries tables that don't exist yet. If the containers come up first, every request
touching projects or guests returns a 500 until the migrations land. Take the short window in this
order:

```
bun --filter @crikket/db db:migrate
```

Run with the production `DATABASE_URL` in the environment. It applies:

- `0004_jazzy_wasp.sql` — creates `project_guest_grant`. Schema only, no data.
- `0005_handy_vampiro.sql` — creates `project_team_member`, **then backfills it**: every current
  non-guest organization member is put on every current project (a project being one with a capture
  key). This is so nobody silently loses sight of work they were already following.

The backfill is `ON CONFLICT DO NOTHING`, so re-running it is safe and inserts nothing the second
time.

### What was verified, and what wasn't

Both migrations were applied to a scratch database built to match production's layout — a `crikket`
schema with `search_path=crikket` — and all six migrations applied cleanly. Both new tables landed
in `crikket`, and all seven foreign keys resolved to `crikket.*` rather than `public.*`. The
backfill was exercised against fixture data and behaved correctly: guests excluded, a project with
two capture keys producing one row per person rather than two, unassigned keys ignored, and each
organization's members confined to its own projects.

What has **not** happened: neither migration has run against real production data.

### Rolling back

There is no down migration. Both tables are additive and nothing else references them, so if you
need to reverse it:

```sql
DROP TABLE IF EXISTS "project_team_member";
DROP TABLE IF EXISTS "project_guest_grant";
```

Then redeploy the previous images. No existing table is altered by this release, so the old code
runs fine against the new schema — you can also just roll the images back and leave the tables in
place.

## 3. Deploy the images

Pull the new `web` and `server` tags from GHCR onto the host and restart, however that's normally
done here. The compose files in the repo root (`docker-compose.yml`,
`docker-compose.caddy.yml`, `docker-compose.external-db.yml`) describe the service shape.

## 4. Smoke test

1. Sign in as an org owner. The sidebar shows **My Projects** and **All Projects**.
2. Open a project → **Manage access**. The dialog lists a Team section and a Guests section.
3. Type a teammate's name in the invite field — they should appear as a suggestion with
   "Add to team".
4. **Settings → Guest Management** loads and lists guests (empty is correct on day one).
5. **Settings → Organization** members list shows teammates only, no guests.
6. Invite a guest to a project using a real address you control, and confirm the email arrives.
   This is the step that catches a bad `RESEND_API_KEY` or `ALLOWED_SIGNUP_DOMAINS`.
7. Accept the invite in a private window, confirm it lands on `/portal`, and that only the granted
   project is listed.

## What this release does not include

- **Any notification system.** Project teams exist so notifications can eventually be targeted;
  nothing sends email on ticket activity today.
- **A link between ticket assignees and Crikket logins.** Assignees come from the dashboard's
  people table, which has no email column. An assigned person cannot currently be notified.
