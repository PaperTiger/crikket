import { authClient } from "@crikket/auth/client"
import { headers } from "next/headers"
import { cache } from "react"

export const getProtectedAuthData = cache(async () => {
  const requestHeaders = await headers()

  const { data: session } = await authClient.getSession({
    fetchOptions: {
      headers: requestHeaders,
    },
  })

  if (!session) {
    return {
      organizations: [],
      session: null,
      activeRole: null,
      isGuest: false,
    }
  }

  const { data: organizations } = await authClient.organization.list({
    fetchOptions: {
      headers: requestHeaders,
    },
  })

  const activeOrganization =
    organizations?.find(
      (organization) => organization.id === session.session.activeOrganizationId
    ) ?? organizations?.[0]

  const { data: activeMembership } = activeOrganization
    ? await authClient.organization.getActiveMemberRole({
        query: {
          organizationId: activeOrganization.id,
        },
        fetchOptions: {
          headers: requestHeaders,
        },
      })
    : { data: null }

  const activeRole = activeMembership?.role ?? null

  return {
    organizations: organizations ?? [],
    session,
    activeRole,
    // Guests are clients invited to follow specific projects. They get the
    // portal at /portal, not the organization dashboard.
    isGuest: activeRole === "guest",
  }
})
