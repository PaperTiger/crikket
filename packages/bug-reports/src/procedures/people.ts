import { db } from "@crikket/db"
import { ptPeople } from "@crikket/db/external/paper-tiger"
import { asc, eq, isNull, or } from "drizzle-orm"
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
 */
export const listActivePeople = protectedProcedure.handler(
  async (): Promise<PersonOption[]> => {
    const rows = await db
      .select({
        id: ptPeople.id,
        name: ptPeople.name,
        discipline: ptPeople.discipline,
        avatarUrl: ptPeople.avatarUrl,
      })
      .from(ptPeople)
      .where(or(eq(ptPeople.former, false), isNull(ptPeople.former)))
      .orderBy(asc(ptPeople.name))

    return rows
      .filter((row) => Boolean(row.name))
      .map((row) => ({
        id: row.id,
        name: row.name ?? "",
        discipline: row.discipline,
        avatarUrl: row.avatarUrl,
      }))
  }
)
