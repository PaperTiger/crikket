import { redirect } from "next/navigation"

import { getProtectedAuthData } from "@/app/(protected)/_lib/get-protected-auth-data"
import { OnboardingView } from "@/app/(protected)/onboarding/_components/onboarding-view"

export default async function OnboardingPage() {
  const { session, organizations } = await getProtectedAuthData()

  if (!session) {
    redirect("/login")
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <OnboardingView
        organizations={organizations.map((organization) => ({
          id: organization.id,
          name: organization.name,
          slug: organization.slug,
        }))}
        userEmail={session.user.email}
      />
    </div>
  )
}
