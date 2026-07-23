import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@crikket/ui/components/ui/card"
import { ArrowLeft } from "lucide-react"
import type { Metadata, Route } from "next"
import Link from "next/link"
import { redirect } from "next/navigation"

import { getProtectedAuthData } from "@/app/(protected)/_lib/get-protected-auth-data"
import { UserSettingsNameForm } from "@/app/(protected)/(dashboard)/settings/_components/user-settings-name-form"
import { UserSettingsPasswordForm } from "@/app/(protected)/(dashboard)/settings/_components/user-settings-password-form"

export const metadata: Metadata = {
  title: "Settings",
  description: "Manage your name and password.",
}

export default async function PortalSettingsPage() {
  const { session } = await getProtectedAuthData()

  if (!session) {
    redirect("/login")
  }

  return (
    <div className="mx-auto w-full max-w-2xl space-y-4 pt-4">
      <Link
        className="inline-flex w-fit items-center gap-1.5 text-muted-foreground text-sm hover:text-foreground"
        href={"/portal" as Route}
      >
        <ArrowLeft className="size-4" />
        All projects
      </Link>
      <div>
        <h1 className="font-bold text-3xl tracking-tight">Settings</h1>
        <p className="mt-1 text-muted-foreground">
          Update your name and password.
        </p>
      </div>

      <div className="grid gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Name</CardTitle>
            <CardDescription>
              Change how your name appears across the app.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <UserSettingsNameForm initialName={session.user.name} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Password</CardTitle>
            <CardDescription>
              Keep your account secure with a strong password.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <UserSettingsPasswordForm />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
