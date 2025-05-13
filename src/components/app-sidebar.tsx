"use client"

import { usePathname } from "next/navigation"
import Link from "next/link"
import { useOrganization } from "@/contexts/organization-context"
import { getOrganizationRoutes } from "@/config/routes"
import { useSession } from "next-auth/react"
import { 
  Sidebar, 
  SidebarHeader, 
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
  SidebarFooter,
  SidebarContent
} from "@/components/ui/sidebar"
import { TeamSwitcher } from "@/components/team-switcher"
import { NavUser } from "@/components/nav-user"

export function AppSidebar() {
  const pathname = usePathname()
  const { organization } = useOrganization()
  const { data: session } = useSession()
  
  
  const routes = organization 
    ? getOrganizationRoutes(organization.uniqueId)
    : []

  
  if (!organization) {
    return (
      <Sidebar>
        <SidebarHeader>
          <TeamSwitcher />
        </SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton disabled>
              <span>Selecione uma organização</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        {session?.user && (
          <SidebarFooter>
            <NavUser user={session.user} />
          </SidebarFooter>
        )}
      </Sidebar>
    )
  }

  return (
    <Sidebar variant="inset" collapsible="icon">
      <SidebarHeader>
        <TeamSwitcher />
      </SidebarHeader>
      <SidebarContent>
        {routes.map((route) => (
          <SidebarMenuItem key={route.url}>
            <SidebarMenuButton
              asChild
              isActive={pathname === route.url}
              tooltip={route.title}
            >
              <Link href={route.url}>
                {route.icon && <route.icon />}
                <span>{route.title}</span>
              </Link>
            </SidebarMenuButton>
            {route.items && route.items.length > 0 && (
              <SidebarMenuSub>
                {route.items.map((item) => (
                  <SidebarMenuSubItem key={item.url}>
                    <SidebarMenuSubButton
                      asChild
                      isActive={pathname === item.url}
                    >
                      <Link href={item.url}>
                        {item.title}
                      </Link>
                    </SidebarMenuSubButton>
                  </SidebarMenuSubItem>
                ))}
              </SidebarMenuSub>
            )}
          </SidebarMenuItem>
        ))}
      </SidebarContent>
      {session?.user && (
        <SidebarFooter>
          <NavUser user={session.user} />
        </SidebarFooter>
      )}
    </Sidebar>
  )
}
