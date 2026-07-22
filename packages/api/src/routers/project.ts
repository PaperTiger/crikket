import {
  listCrikketProjects,
  searchProjects,
} from "@crikket/bug-reports/procedures/projects"

/**
 * Project Router
 * Projects are sourced from the Paper Tiger dashboard (public.projects); a
 * Crikket project is one that has a capture key assigned to it.
 */
export const projectRouter = {
  list: listCrikketProjects,
  search: searchProjects,
}
