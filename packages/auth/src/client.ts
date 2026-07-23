import { env } from "@crikket/env/web"
import { polarClient } from "@polar-sh/better-auth"
import type { BetterAuthClientOptions } from "better-auth/client"
import {
  adminClient,
  emailOTPClient,
  organizationClient,
} from "better-auth/client/plugins"
import { createAuthClient } from "better-auth/react"

import { ac, roles } from "./lib/permissions"

const adminPlugin = adminClient()
const emailOtpPlugin = emailOTPClient()
// Mirrors the server's access control so `guest` is a role the client knows
// about — see packages/auth/src/lib/permissions.ts.
const organizationPlugin = organizationClient({ ac, roles })
const polarPlugin: ReturnType<typeof polarClient> = polarClient()

type AuthClientOptions = {
  baseURL: string
  plugins: [
    typeof adminPlugin,
    typeof emailOtpPlugin,
    typeof organizationPlugin,
    typeof polarPlugin,
  ]
}

type AuthClient<Option extends BetterAuthClientOptions> = ReturnType<
  typeof createAuthClient<Option>
>

export const authClient: AuthClient<AuthClientOptions> = createAuthClient({
  baseURL: env.NEXT_PUBLIC_SERVER_URL,
  plugins: [adminPlugin, emailOtpPlugin, organizationPlugin, polarPlugin],
})
