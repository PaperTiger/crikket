"use client"

import type { authClient } from "@crikket/auth/client"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@crikket/ui/components/ui/sidebar"
import { Skeleton } from "@crikket/ui/components/ui/skeleton"
import { useQuery } from "@tanstack/react-query"
import {
  BookOpen,
  Building2,
  CreditCard,
  FolderKanban,
  KeyRound,
  UserRound,
  UsersRound,
  Video,
} from "lucide-react"
import type { Route } from "next"
import Link from "next/link"
import { usePathname } from "next/navigation"
import type * as React from "react"
import { TeamSwitcher } from "@/components/team-switcher"
import { UserNav } from "@/components/user-nav"
import { orpc } from "@/utils/orpc"

type Organization = typeof authClient.$Infer.Organization

interface AppSidebarProps extends React.ComponentProps<typeof Sidebar> {
  user: typeof authClient.$Infer.Session.user
  organizations: Organization[]
  activeOrganization?: Organization
}

const navPrimary = [
  {
    title: "Bug Reports",
    url: "/" as const,
    matchPrefix: "/" as const,
    icon: Video,
  },
]

const navSettings = [
  {
    title: "User",
    url: "/settings/user" as const,
    icon: UserRound,
  },
  {
    title: "Organization",
    url: "/settings/organization" as const,
    icon: Building2,
  },
  {
    title: "Guest Management",
    url: "/settings/guests" as const,
    icon: UsersRound,
  },
  {
    title: "Public Keys",
    url: "/settings/keys" as const,
    icon: KeyRound,
  },
  {
    title: "Billing",
    url: "/settings/billing" as const,
    icon: CreditCard,
  },
] as const

// The maintained technical overview + usage guide lives in the repo.
const DOCUMENTATION_URL =
  "https://github.com/PaperTiger/crikket/blob/master/docs/OVERVIEW.md"

const navSecondary = [
  {
    title: "Documentation",
    url: DOCUMENTATION_URL,
    icon: BookOpen,
  },
] as const

function ProjectsNavGroup({ pathname }: { pathname: string }) {
  const projectsQuery = useQuery(orpc.project.list.queryOptions())
  const projects = projectsQuery.data ?? []

  return (
    <SidebarGroup>
      <SidebarGroupLabel>Projects</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {projectsQuery.isLoading ? (
            ["p1", "p2", "p3"].map((skeletonKey) => (
              <SidebarMenuItem key={skeletonKey}>
                <div className="flex h-8 items-center gap-2 px-2">
                  <Skeleton className="size-4 rounded-sm" />
                  <Skeleton className="h-4 w-24" />
                </div>
              </SidebarMenuItem>
            ))
          ) : projects.length === 0 ? (
            <SidebarMenuItem>
              <span className="px-2 py-1.5 text-muted-foreground text-xs">
                No projects yet
              </span>
            </SidebarMenuItem>
          ) : (
            projects.map((project) => {
              const url = `/projects/${project.id}`

              return (
                <SidebarMenuItem key={project.id}>
                  <SidebarMenuButton
                    isActive={pathname === url}
                    render={(menuProps) => (
                      <Link href={url as Route} {...menuProps} />
                    )}
                    tooltip={project.name}
                  >
                    <FolderKanban />
                    <span className="truncate">{project.name}</span>
                    {project.keyCount > 0 ? (
                      <span className="ml-auto text-muted-foreground text-xs tabular-nums">
                        {project.keyCount}
                      </span>
                    ) : null}
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )
            })
          )}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}

export function AppSidebar({
  user,
  organizations,
  activeOrganization,
  ...props
}: AppSidebarProps) {
  const pathname = usePathname()

  return (
    <Sidebar collapsible="icon" variant="inset" {...props}>
      <SidebarHeader>
        <TeamSwitcher
          activeOrganization={activeOrganization}
          organizations={organizations}
          userId={user.id}
        />
      </SidebarHeader>
      <SidebarContent className="gap-0">
        <SidebarGroup>
          <SidebarGroupLabel>Platform</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navPrimary.map((item) => {
                const isActive =
                  item.matchPrefix === "/"
                    ? pathname === "/"
                    : pathname.startsWith(item.matchPrefix)

                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      isActive={isActive}
                      render={(props) => (
                        <Link href={item.url as Route} {...props} />
                      )}
                    >
                      <item.icon />
                      <span>{item.title}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <ProjectsNavGroup pathname={pathname} />
        <SidebarGroup>
          <SidebarGroupLabel>Settings</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navSettings.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton
                    isActive={pathname.startsWith(item.url)}
                    render={(props) => (
                      <Link href={item.url as Route} {...props} />
                    )}
                  >
                    <item.icon />
                    <span>{item.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup className="mt-auto">
          <SidebarGroupContent>
            <SidebarMenu>
              {navSecondary.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    render={(props) => (
                      <a
                        href={item.url}
                        rel="noopener noreferrer"
                        target="_blank"
                        {...props}
                      />
                    )}
                    size="sm"
                  >
                    <item.icon />
                    <span>{item.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <UserNav user={user} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
