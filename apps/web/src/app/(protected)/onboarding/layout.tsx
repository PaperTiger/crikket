import type { Route } from "next"
import { redirect } from "next/navigation"

import { getProtectedAuthData } from "@/app/(protected)/_lib/get-protected-auth-data"

export default async function OnboardingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { session, isGuest } = await getProtectedAuthData()

  if (!session) {
    redirect("/login")
  }

  // Guests belong in the portal, not the organization onboarding flow.
  if (isGuest) {
    redirect("/portal" as Route)
  }

  // No org-count redirect: this page is the organization chooser. A member who
  // lands here (however they got here) should see their organizations and a way
  // out, not be bounced. The dashboard still sends org-less users here.
  return children
}
