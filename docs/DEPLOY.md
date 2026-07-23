# Deploying Crikket (Paper Tiger)

> Canonical deploy reference. If any other doc contradicts this one, this one wins.
> Last verified against production: 2026-07-23.

**Production runs on Vercel.** It does **not** run the Docker images this repo can
build — see [Not our deploy path](#8-things-that-look-like-deploy-tooling-but-arent).

---

## TL;DR

1. **Deploying = getting commits onto `master`.** Vercel auto-builds and promotes
   both apps within ~1 minute. There is no deploy script, no CI deploy job, no manual promote.
2. **Migrations are NOT part of the deploy.** Nothing runs them for you. Apply them
   to production **before** merging, or the new code 500s the moment it goes live.
3. **After changing `sdks/capture`,** rebuild and re-copy the served bundle, or `/capture.js`
   keeps serving the old widget.

---

## 1. What runs where

| Vercel project | App | Framework | Production URL |
| --- | --- | --- | --- |
| `crikket-web` | `apps/web` | Next.js | https://tickets.papertiger.agency |
| `crikket-server` | `apps/server` | Hono | https://tickets-api.papertiger.agency |

- Vercel team: `paper-tiger-133e76e3` (`team_NhKCEaVdUJ9uL5uONGOim63y`)
- Project IDs: web `prj_9rZwYHR8iWELnhBwhyeuJ565Ar6r`, server `prj_mrszK2Ci0YsEJPVNP5TH0xGduZ81`
- `apps/server/vercel.json` pins `outputDirectory: dist` — the server serves the tsdown
  bundle. Without it Vercel runs `src/index.ts` and Node dies on the raw-TS workspace imports.

**Branch behaviour** (Vercel Git integration, configured in the Vercel dashboard — *not* in
this repo, which is why it isn't greppable):

- push/merge to **`master`** → **production** deploy of both projects
- push to **any other branch** → **preview** deploy of both projects

### ⚠️ Preview deploys are NOT a sandbox

`DATABASE_URL` on `crikket-server` is scoped to **"Production and Preview"** — one value,
both environments. **Every preview deploy talks to the production database.** Verified
2026-07-23.

A preview is built from *any* pushed branch, i.e. unreviewed work-in-progress code, and it
**reads and writes live production data**. So:

- Treat a preview URL as production. Clicking around one is not "just testing."
- Never exercise destructive or bulk actions in a preview — deletes, bulk status changes,
  seeding, invite sends — they hit real rows and real inboxes.
- A preview is genuinely useful for **UI and read-path review**. It is not a safe place to
  try out a risky mutation.

To make previews genuinely isolated, add a **Preview-scoped** `DATABASE_URL` in Vercel →
project → Settings → Environment Variables pointing at a separate branch/staging database.
Until that exists, the warning above stands.

---

## 2. The deploy procedure

Run these in order. Steps 2 and 3 are the ones that get skipped.

```bash
# 1. Preflight — typecheck must be clean repo-wide
bunx turbo run check-types

# Lint only what you changed (see the note below before running a repo-wide lint)
git diff --name-only --diff-filter=d origin/master...HEAD -- '*.ts' '*.tsx' '*.css' \
  | xargs -r bunx ultracite check
```

> **Do not gate on `biome check .`** — the tree carries ~13k pre-existing lint errors, so a
> repo-wide run always fails and tells you nothing about your change. The `.husky/pre-commit`
> hook already runs `ultracite fix` on **staged files only** via `lint-staged`; that is the
> real gate. (An earlier whole-repo version of that hook rejected every commit for exactly
> this reason.)

**2. If this change adds or edits anything in `packages/db/src/migrations/` — apply the
migrations to production NOW, before merging.** See [§3](#3-migrations-the-step-that-gets-missed).

**3. If this change touches `sdks/capture/` — resync the served widget bundle:**

```bash
cd sdks/capture && bun run build && cp dist/capture.global.js ../../apps/web/public/capture.js
```

`apps/web/public/capture.js` is a **checked-in static copy** — it is what `/capture.js` serves
to every client site. Commit it.

**4. Merge to `master`** (PR or direct push). That is the deploy.

**5. Watch the build.** Vercel dashboard, or the Vercel MCP (`list_deployments` →
`get_deployment` until `readyState: "READY"`). Both projects build on every master push.

**6. Smoke test** — see [§7](#7-smoke-test).

---

## 3. Migrations (the step that gets missed)

Drizzle. Files in `packages/db/src/migrations/`. **There is no migrate-on-deploy hook.**

### Why order matters here specifically

On a container host you control when the new image starts serving, so you get a window to
migrate after shipping. **On Vercel you do not** — merging to `master` puts the new code live
automatically. If the new code queries a table the migration hasn't created yet, every request
touching it returns 500 until you migrate.

So: **migrate first, then merge.** Additive migrations (new tables/nullable columns) are safe
to apply ahead of the code — the old code simply ignores them.

### Applying

```bash
# with the PRODUCTION DATABASE_URL in the environment
bun db:migrate
```

### Verifying (do this — don't assume it worked)

```sql
-- which migrations are recorded as applied
select id, hash, to_timestamp(created_at/1000) as applied_at
from drizzle.__drizzle_migrations order by created_at desc;

-- and confirm the tables the new code needs actually exist
select table_name from information_schema.tables
where table_schema = 'crikket' and table_name in ('<new_table>');
```

The journal row count should equal the number of `.sql` files in
`packages/db/src/migrations/`. If the repo has 6 files and the journal has 4 rows, two
migrations are unapplied.

### Schema conventions (important)

Both rules below guard the same failure: **SQL that succeeds but lands in the wrong schema.**
Nothing errors at the time — you find out when the app gets `permission denied` or an empty
result.

- Crikket's tables live in the **`crikket`** schema, not `public`. The connection sets
  `search_path=crikket`, so migrations use **unqualified** table names.
- `drizzle-kit generate` emits foreign keys as `REFERENCES "public"."x"`. **Strip the
  `public.` qualifier** before applying, or the FK points at the wrong schema.
- **Applying migrations out of band? Set the role and schema first.** The Supabase SQL editor
  and MCP run as a privileged role with `search_path=public`. Paste migration SQL as-is and
  the tables are created **in `public`, owned by `postgres`** — leaving `crikket_app` with no
  privileges and production broken in a new, more confusing way. Always prefix:

  ```sql
  set role crikket_app;
  set search_path to crikket;
  -- ...the migration SQL...
  ```

  Then verify placement **and** ownership before moving on:

  ```sql
  select schemaname, tablename, tableowner from pg_tables where tablename = '<new_table>';
  -- expect: crikket | <new_table> | crikket_app
  ```

  And record it in the journal, or `bun db:migrate` will try to re-apply it later:

  ```sql
  insert into drizzle.__drizzle_migrations (hash, created_at)
  values ('<sha256 of the .sql file>', <"when" from meta/_journal.json>);
  ```
- Keep migrations idempotent (`IF NOT EXISTS`, `ON CONFLICT DO NOTHING`) — they sometimes get
  applied out of band and re-run.
- New tables in `crikket` need **no extra grants**: the app role `crikket_app` owns every
  table in that schema and will own new ones too. (This is *not* true of `public.*` — see §4.)

---

## 4. Reading the dashboard's `public.*` tables

Projects and people are the Paper Tiger dashboard's own tables (`public.projects`,
`public.people`) in the same database. To read a `public.*` table the app role needs **two**
things — miss either and it fails differently:

| Missing | Symptom |
| --- | --- |
| `GRANT SELECT ... TO crikket_app` | `permission denied for table <t>` → HTTP 500 |
| An RLS policy for `crikket_app` | **Query succeeds, returns 0 rows** (silent, no error) |

```sql
grant select on table public.<t> to crikket_app;
create policy "crikket_app read" on public.<t>
  for select to crikket_app using (true);
```

⚠️ **Testing trap:** the Supabase SQL editor / MCP runs as a privileged role that bypasses
both. A query that works there can still fail for the app. Always re-test as the real role:

```sql
set role crikket_app;
set local search_path to crikket;
-- ...your query...
```

Also: **never** use Drizzle's `pgSchema("public")` to reach these tables. It throws at module
load, which crashes the entire server function — including `/api/auth/*`, taking down login.
Read `public.*` with raw, explicitly-qualified SQL instead.

---

## 5. Environment variables that gate features

Set on the Vercel projects, not in the repo. Missing ones tend to fail **silently**:

| Var | Project | If wrong |
| --- | --- | --- |
| `DATABASE_URL` | server | Everything DB-backed fails |
| `RESEND_API_KEY` | server | Guest invitations: row is created, email is skipped with a log line, client never hears anything |
| `ALLOWED_SIGNUP_DOMAINS` | server | If restricted to `papertiger.com`, guests on their own domain can't create an account |

---

## 6. Post-mortem: the guest-access release (2026-07-23) — RESOLVED

A worked example of the failure this doc exists to prevent.

**What happened.** `master` was merged and Vercel deployed it, but migrations `0004` and
`0005` were never applied — `bun db:migrate` failed before it ran any SQL. The new code
queried tables that didn't exist:

| Endpoint | Missing table | Effect |
| --- | --- | --- |
| `POST /rpc/project/list` | `project_team_member` | Projects sidebar + project pages broken org-wide |
| `POST /rpc/project/access/listOrgGuests` | `project_guest_grant` | Guest Management failed |

Auth, the bug-reports list, and report detail were unaffected throughout.

**Resolved** by applying both migrations. Journal now has 6 rows matching the 6 files;
`project_team_member` backfilled 2 rows; both endpoints verified working as `crikket_app`;
no 500s in production. No redeploy was needed — the running code picked the tables up
immediately.

### Two lessons worth keeping

**1. `bun db:migrate` may not reach the DB from a laptop.** The failure was connectivity, not
SQL — the migration SQL was sound. Supabase *direct* connections
(`db.<ref>.supabase.co:5432`) often fail without IPv6/the IPv4 add-on. Use the **transaction
pooler** connection string (port `6543`) from Supabase → Project Settings → Database.

**2. Applying migrations out of band is how you create a *second* incident.** The fix here was
applied through the Supabase MCP, which runs privileged with `search_path=public` — pasting the
DDL as-is would have created both tables in `public` owned by `postgres`, leaving `crikket_app`
without privileges. The `set role` / `set search_path` / verify-ownership / record-the-journal
procedure is in [§3 Schema conventions](#schema-conventions-important). Follow it every time.

**Rollback (unused, kept for reference):** there is no down migration. Both tables are
additive and nothing else references them, so
`DROP TABLE IF EXISTS "project_team_member", "project_guest_grant";` reverses it.

---

## 7. Smoke test

After any production deploy:

1. `curl -s -o /dev/null -w "%{http_code}" https://tickets-api.papertiger.agency/api/auth/get-session`
   → **200** (body `null` when unauthenticated). A 500 here means the server function is
   crashing at module load and **login is down** — treat as sev-1.
2. Load https://tickets.papertiger.agency — bug reports list renders.
3. Sidebar **Projects** lists projects and a project link opens its issues table.
4. Open a report detail (`/s/<id>`).
5. Check Vercel runtime logs for 500s (filter by `statusCode`) on both projects.

### Guest access + project teams

Only needed when touching those features. Steps 6–7 are the ones that catch a bad
`RESEND_API_KEY` or `ALLOWED_SIGNUP_DOMAINS` (see §5) — both fail *silently* otherwise.

1. Signed in as an org owner, the sidebar shows **My Projects** and **All Projects**.
2. Open a project → **Manage access** — the dialog lists a Team section and a Guests section.
3. Type a teammate's name in the invite field; they appear as a suggestion with "Add to team".
4. **Settings → Guest Management** loads and lists guests (empty is correct on day one).
5. **Settings → Organization** members list shows teammates only, no guests.
6. Invite a guest using a real address you control and confirm the email actually arrives.
7. Accept the invite in a private window; confirm it lands on `/portal` and that **only** the
   granted project is listed.

---

## 8. Things that look like deploy tooling but aren't

This repo is a fork of the open-source `redpangilinan/crikket` (`git remote -v` → `upstream`).
Several artifacts belong to that project's **self-hosting** story and have **nothing to do with
how Paper Tiger deploys**:

- `.github/workflows/docker-publish.yml` — builds/pushes `web` + `server` images to GHCR on
  master push. Those images are **not** what production runs. Publishing them deploys nothing.
- `docker-compose.yml`, `docker-compose.caddy.yml`, `docker-compose.external-db.yml`
- The README's "Production deployment guide" link → upstream `crikket.io` docs
- `.github/workflows/publish.yml` / `version-packages.yml` — npm/changesets for the OSS package

Do not follow any of them to deploy this app. Deploying is: **merge to `master`.**
