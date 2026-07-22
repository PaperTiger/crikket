import { db } from "@crikket/db"
import { sql } from "drizzle-orm"
import { protectedProcedure } from "./context"

export interface PersonOption {
  id: string
  name: string
  discipline: string | null
  avatarUrl: string | null
}

/**
 * Active Paper Tiger people (public.people) — used as the assignee options for
 * bug reports. Excludes former team members.
 *
 * Uses raw SQL with an explicit `public.` qualifier: the app connects with
 * search_path=crikket, so this is the reliable way to read the dashboard's
 * public-schema tables without a cross-schema drizzle table (pgSchema("public")
 * throws at import).
 */
export const listActivePeople = protectedProcedure.handler(
  async (): Promise<PersonOption[]> => {
    const result = await db.execute(sql`
      select "id", "name", "discipline", "avatar_url" as "avatarUrl"
      from "public"."people"
      where coalesce("former", false) = false and "name" is not null
      order by "name" asc
    `)

    return result.rows as unknown as PersonOption[]
  }
)
