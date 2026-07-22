import { listActivePeople } from "@crikket/bug-reports/procedures/people"

/**
 * People Router
 * People are sourced from the Paper Tiger dashboard (public.people) and used as
 * bug-report assignees.
 */
export const peopleRouter = {
  list: listActivePeople,
}
