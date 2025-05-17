"use client"

import { usePathname } from "next/navigation"
import Link from "next/link"
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
import { useOrganization } from "@/contexts/organization-context"
import { getOrganizationRoutes } from "@/config/routes"
import type { Route, RouteItem } from "@/config/routes"
import { useMemo, memo } from "react"

// Componente memoizado para menu items
const MenuItem = memo(function MenuItem({ 
  route, 
  pathname 
}: { 
  route: Route; 
  pathname: string 
}) {
  const isActive = pathname === route.url || pathname.startsWith(`${route.url}/`);
  
  return (
    <SidebarMenuItem key={route.url}>
      <SidebarMenuButton
        asChild
        isActive={isActive}
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
            <SubMenuItem 
              key={item.url} 
              item={item} 
              pathname={pathname} 
            />
          ))}
        </SidebarMenuSub>
      )}
    </SidebarMenuItem>
  );
});

// Componente memoizado para sub-menu items
const SubMenuItem = memo(function SubMenuItem({ 
  item, 
  pathname 
}: { 
  item: RouteItem; 
  pathname: string 
}) {
  return (
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
  );
});

// Componente para quando não há organização selecionada
const NoOrganizationSidebar = memo(function NoOrganizationSidebar({ 
  user 
}: { 
  user: { 
    id: string;
    name?: string | null;
    email?: string | null;
    image?: string | null;
  } | undefined;
}) {
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
      {user && (
        <SidebarFooter>
          <NavUser user={user} />
        </SidebarFooter>
      )}
    </Sidebar>
  );
});

export function AppSidebar() {
  const pathname = usePathname()
  const { organization } = useOrganization()
  const { data: session } = useSession()
  
  // Memoiza a lista de rotas para evitar recálculos
  const routes = useMemo(() => 
    organization ? getOrganizationRoutes(organization.uniqueId) : [],
    [organization]
  );

  if (!organization) {
    return <NoOrganizationSidebar user={session?.user} />;
  }

  return (
    <Sidebar variant="inset" collapsible="icon">
      <SidebarHeader>
        <TeamSwitcher />
      </SidebarHeader>
      <SidebarContent>
        {routes.map((route) => (
          <MenuItem 
            key={route.url} 
            route={route} 
            pathname={pathname} 
          />
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
