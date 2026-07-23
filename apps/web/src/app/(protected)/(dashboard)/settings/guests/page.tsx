import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { getProtectedAuthData } from "@/app/(protected)/_lib/get-protected-auth-data"

import { GuestManagementSection } from "../_components/guests/guest-management-section"

export const metadata: Metadata = {
  title: "Guest Management",
  description:
    "Invite clients to follow specific projects and manage what they can see.",
}

export default async function GuestManagementPage() {
  const { session, organizations, activeRole } = await getProtectedAuthData()

  if (!session) {
    redirect("/login")
  }

  if (organizations.length === 0) {
    redirect("/onboarding")
  }

  const canManage = activeRole === "owner" || activeRole === "admin"

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-semibold text-xl tracking-tight">
          Guest Management
        </h2>
        <p className="mt-1 text-muted-foreground text-sm">
          Guests are clients you invite to follow specific projects. They can
          read those projects' issues and change status and priority — nothing
          else.
        </p>
      </div>

      <GuestManagementSection canManage={canManage} />
    </div>
  )
}
