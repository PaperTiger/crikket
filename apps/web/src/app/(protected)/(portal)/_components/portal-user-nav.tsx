"use client"

import type { authClient as authClientType } from "@crikket/auth/client"
import { authClient } from "@crikket/auth/client"
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@crikket/ui/components/ui/avatar"
import { Button } from "@crikket/ui/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@crikket/ui/components/ui/dropdown-menu"
import { ChevronsUpDown, LogOut, Settings } from "lucide-react"
import type { Route } from "next"
import { useRouter } from "nextjs-toploader/app"

interface PortalUserNavProps {
  user: typeof authClientType.$Infer.Session.user
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)
}

/**
 * The portal's own user menu. The dashboard's UserNav can't be reused here —
 * it reads sidebar context, and the portal has no sidebar.
 */
export function PortalUserNav({ user }: PortalUserNavProps) {
  const router = useRouter()

  const handleSignOut = async () => {
    await authClient.signOut({
      fetchOptions: {
        onSuccess: () => {
          window.location.href = "/login"
        },
      },
    })
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={(props) => (
          <Button className="h-auto gap-2 px-2 py-1.5" variant="ghost" {...props}>
            <Avatar className="size-7 rounded-lg">
              <AvatarImage alt={user.name} src={user.image ?? undefined} />
              <AvatarFallback className="rounded-lg text-xs">
                {getInitials(user.name)}
              </AvatarFallback>
            </Avatar>
            <span className="hidden max-w-32 truncate font-medium text-sm sm:inline">
              {user.name}
            </span>
            <ChevronsUpDown className="size-4 text-muted-foreground" />
          </Button>
        )}
      />
      <DropdownMenuContent align="end" className="min-w-56">
        <DropdownMenuLabel className="p-0 font-normal">
          <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
            <Avatar className="size-8 rounded-lg">
              <AvatarImage alt={user.name} src={user.image ?? undefined} />
              <AvatarFallback className="rounded-lg">
                {getInitials(user.name)}
              </AvatarFallback>
            </Avatar>
            <div className="grid flex-1 leading-tight">
              <span className="truncate font-semibold">{user.name}</span>
              <span className="truncate text-muted-foreground text-xs">
                {user.email}
              </span>
            </div>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => router.push("/portal/settings" as Route)}
        >
          <Settings className="mr-2 size-4" />
          Settings
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleSignOut}>
          <LogOut className="mr-2 size-4" />
          Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
