"use client"

import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from "@/components/ui/sidebar"
import { Building2, Users, Mail, Settings, Package } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { ReactNode } from "react"

interface OrganizationSidebarProps {
  org_unique_id: string
  teamSwitcher?: ReactNode
}

export function OrganizationSidebar({ org_unique_id, teamSwitcher }: OrganizationSidebarProps) {
  const pathname = usePathname()

  return (
    <Sidebar>
      <SidebarHeader>
        {teamSwitcher}
      </SidebarHeader>
      <SidebarContent>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              tooltip="Visão Geral"
              isActive={pathname === `/organizations/${org_unique_id}`}
            >
              <Link href={`/organizations/${org_unique_id}`}>
                <Building2 className="h-4 w-4" />
                <span>Visão Geral</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              tooltip="Membros"
              isActive={pathname === `/organizations/${org_unique_id}/config/members`}
            >
              <Link href={`/organizations/${org_unique_id}/config/members`}>
                <Users className="h-4 w-4" />
                <span>Membros</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              tooltip="Convites"
              isActive={pathname === `/organizations/${org_unique_id}/invites`}
            >
              <Link href={`/organizations/${org_unique_id}/invites`}>
                <Mail className="h-4 w-4" />
                <span>Convites</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              tooltip="Itens"
              isActive={pathname === `/organizations/${org_unique_id}/items`}
            >
              <Link href={`/organizations/${org_unique_id}/items`}>
                <Package className="h-4 w-4" />
                <span>Itens</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              tooltip="Configurações"
              isActive={pathname === `/organizations/${org_unique_id}/settings`}
            >
              <Link href={`/organizations/${org_unique_id}/settings`}>
                <Settings className="h-4 w-4" />
                <span>Configurações</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarContent>
    </Sidebar>
  )
} 