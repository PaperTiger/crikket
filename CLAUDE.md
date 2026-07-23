# Working in this repo

Read this before making changes. It is the operating protocol for this codebase — for
humans and coding agents alike.

**This is Paper Tiger's private fork of the open-source Crikket project.** It is deployed
by Paper Tiger, on Vercel, against a shared production database. It is *not* run the way
the upstream project documents.

---

## 🛑 Stop and ask the user before any of these

These are not judgement calls. Do the work, then **stop and ask for explicit approval**:

| Action | Why it needs approval |
| --- | --- |
| **Merging or pushing to `master`** | `master` **is** production. Vercel auto-deploys both apps within ~1 min. There is no staging gate and no manual promote step. |
| **Applying a database migration** | Runs against the **shared production database**. Some migrations write rows. |
| **Any write to the production DB** (backfills, `UPDATE`, `DELETE`, grants, RLS policies) | Same database the live dashboard uses. Often irreversible. |
| **Changing Vercel project settings, env vars, or domains** | Config lives in the Vercel dashboard, not this repo — changes are invisible in git. |
| **Deleting data, dropping tables, rotating keys** | Irreversible. |

Working on a branch, committing, pushing **a non-`master` branch**, and opening a PR are all
fine without asking. The gate is on *merging* and on *production*.

---

## Branch protocol

- **Never commit directly to `master`.** Branch from it: `feat/…`, `fix/…`, `docs/…`.
- Push the branch and open a PR. Every branch gets an automatic **Vercel preview deploy** of
  both apps — use it to verify before proposing a merge.
- When the work is ready, **summarize what changed and ask the user to approve the merge.**
  Say explicitly whether the change needs a migration (see below).
- `master` is the only production branch. Merging to it deploys. Treat every merge as a
  release.

---

## Migrations: apply BEFORE merging

Drizzle. Files in `packages/db/src/migrations/`. **Nothing runs them automatically** — not the
deploy, not CI, not a container hook.

Because merging to `master` deploys immediately, there is **no window** to migrate afterwards.
If the new code queries a table the migration hasn't created, every request touching it
returns 500 the moment it goes live. This has already caused one production incident.

**The order is always:**

1. Get the migration reviewed and **approved by the user**.
2. Apply it to production.
3. Verify it (below).
4. *Then* merge to `master`.

Additive migrations (new tables, nullable columns) are safe to apply ahead of the code — the
running production code simply ignores them.

**Verify — never assume it worked:**

```sql
select id, hash, to_timestamp(created_at/1000) as applied_at
from drizzle.__drizzle_migrations order by created_at desc;
```

The journal row count must equal the number of `.sql` files in
`packages/db/src/migrations/`. If the repo has 6 files and the journal has 4 rows, two
migrations are unapplied.

Full procedure, including the out-of-band and connectivity gotchas:
**[docs/DEPLOY.md](docs/DEPLOY.md)**.

---

## Before proposing a merge

```bash
bunx turbo run check-types   # must be clean
bunx biome check .           # must be clean
```

If you touched `sdks/capture/`, resync the served widget bundle — `apps/web/public/capture.js`
is a **checked-in copy** and is what every client site loads:

```bash
cd sdks/capture && bun run build && cp dist/capture.global.js ../../apps/web/public/capture.js
```

---

## Traps that have already caused outages

Read these before touching the areas involved.

- **`pgSchema("public")` crashes the whole server.** Drizzle throws on it at *module load*,
  which takes down every route including `/api/auth/*` — i.e. login goes down, not just the
  feature. Read the dashboard's `public.*` tables with raw, explicitly-qualified SQL instead.
- **Reading a `public.*` table needs TWO grants.** A `GRANT SELECT` *and* an RLS policy for
  `crikket_app`. Missing the grant → `permission denied` (500). Missing the policy → the query
  **succeeds and silently returns 0 rows**.
- **Testing in the Supabase SQL editor/MCP lies.** It runs as a privileged role that bypasses
  grants and RLS. Always re-test as the app's role:
  `set role crikket_app; set local search_path to crikket;`
- **Crikket's tables live in the `crikket` schema**, not `public` (`search_path=crikket`).
  Migrations use unqualified names. `drizzle-kit generate` emits `REFERENCES "public"."x"` —
  **strip the `public.` qualifier** or the FK points at the wrong schema.
- **The dashboard's active theme is `packages/ui/src/styles/dashboard.css`**, not
  `globals.css` (which only `apps/extension` and `apps/docs` use). Theme edits to
  `globals.css` will appear to do nothing. Keep it stock shadcn (neutral, radius `0.625rem`,
  system font).

---

## Authoritative docs

| Question | Read |
| --- | --- |
| How do I deploy? What broke? | **[docs/DEPLOY.md](docs/DEPLOY.md)** |
| How does the system fit together? | [docs/OVERVIEW.md](docs/OVERVIEW.md) |

## Ignore these — they are upstream artifacts, not our process

This repo is a fork (`git remote -v` → `upstream` = `redpangilinan/crikket`). The following
describe the *open-source project's* self-hosting and contribution story and **do not apply
here**. Following them wastes time and deploys nothing:

- `.github/workflows/docker-publish.yml` — pushes images to GHCR. Production does not run
  them.
- `docker-compose.yml`, `docker-compose.caddy.yml`, `docker-compose.external-db.yml`
- `CONTRIBUTING.md` — the upstream OSS contribution guide
- The README's "Production deployment guide" link → upstream `crikket.io` docs

**Deploying is: merge to `master` (with approval).** Nothing else.
