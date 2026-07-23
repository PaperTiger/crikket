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
- push to **any other branch** → **preview** deploy of both projects (safe; use it to test)

---

## 2. The deploy procedure

Run these in order. Steps 2 and 3 are the ones that get skipped.

```bash
# 1. Preflight — both must be clean
bunx turbo run check-types
bunx biome check .
```

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

- Crikket's tables live in the **`crikket`** schema, not `public`. The connection sets
  `search_path=crikket`, so migrations use **unqualified** table names.
- `drizzle-kit generate` emits foreign keys as `REFERENCES "public"."x"`. **Strip the
  `public.` qualifier** before applying, or the FK points at the wrong schema.
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

## 6. Current known-broken state (2026-07-23)

`master` was merged and deployed, but **migrations `0004` and `0005` were never applied.**
Verified in production: the journal stops at migration 4, and neither
`crikket.project_guest_grant` nor `crikket.project_team_member` exists.

Live 500s:

| Endpoint | Missing table | User-visible effect |
| --- | --- | --- |
| `POST /rpc/project/list` | `project_team_member` | **Projects sidebar nav + project pages broken org-wide** |
| `POST /rpc/project/access/listOrgGuests` | `project_guest_grant` | Guest Management screen fails |

Auth, the bug-reports list, and report detail are unaffected.

**Fix — apply the two migrations to production:**

```bash
bun db:migrate   # with the production DATABASE_URL
```

- `0004_jazzy_wasp.sql` — creates `project_guest_grant`. Schema only.
- `0005_handy_vampiro.sql` — creates `project_team_member`, **then backfills it**: every
  current non-guest org member is added to every current project (a project = one with a
  capture key). `ON CONFLICT DO NOTHING`, so re-running inserts nothing the second time.

Then re-verify with the §3 queries and confirm the two endpoints stop 500ing. No redeploy is
needed — the running code picks the tables up immediately.

**Rollback:** there is no down migration. Both tables are additive and nothing else references
them, so `DROP TABLE IF EXISTS "project_team_member", "project_guest_grant";` reverses it, or
just roll the Vercel deployment back and leave the tables in place.

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
