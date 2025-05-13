"use client"

import { usePathname } from "next/navigation"
import Link from "next/link"
import { useOrganization } from "@/contexts/organization-context"
import { getOrganizationRoutes } from "@/config/routes"
import { 
  Sidebar, 
  SidebarHeader, 
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton
} from "@/components/ui/sidebar"
import { TeamSwitcher } from "@/components/team-switcher"

export function AppSidebar() {
  const pathname = usePathname()
  const { organization } = useOrganization()
  
  console.log('Organization:', organization)
  
  const routes = organization 
    ? getOrganizationRoutes(organization.uniqueId)
    : []

  console.log('Routes:', routes)
  console.log('Current pathname:', pathname)

  // Se não houver organização, mostra uma mensagem
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
      </Sidebar>
    )
  }

  return (
    <Sidebar>
      <SidebarHeader>
        <TeamSwitcher />
      </SidebarHeader>
      <SidebarMenu>
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
      </SidebarMenu>
    </Sidebar>
  )
}
