import {
  cancelProjectGuestInvite,
  getGuestProject,
  inviteProjectGuest,
  listGuestProjects,
  listOrgGuests,
  listProjectAccess,
  removeOrgGuest,
  removeProjectGuest,
  resendProjectGuestInvite,
} from "@crikket/bug-reports/procedures/project-access"
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
  // Who can see a project: organization members (always) plus invited guests.
  access: {
    list: listProjectAccess,
    inviteGuest: inviteProjectGuest,
    removeGuest: removeProjectGuest,
    cancelGuestInvite: cancelProjectGuestInvite,
    resendGuestInvite: resendProjectGuestInvite,
    // Organization-wide view, for Settings -> Guest Management.
    listOrgGuests,
    removeOrgGuest,
  },
  // The guest portal's own views.
  listForGuest: listGuestProjects,
  getForGuest: getGuestProject,
}
