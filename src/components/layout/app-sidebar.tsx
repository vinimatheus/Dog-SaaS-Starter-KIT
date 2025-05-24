"use client"


import { useSession } from "next-auth/react"
import { 
  Sidebar, 
  SidebarHeader, 
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarFooter,
  SidebarContent
} from "@/components/ui/sidebar"
import { TeamSwitcher } from "@/components/navigation/team-switcher"
import { NavUser } from "@/components/navigation/nav-user"
import { NavMain } from "@/components/navigation/nav-main"
import { useOrganization } from "@/contexts/organization-context"
import { getOrganizationRoutes } from "@/config/routes"
import { useMemo, memo } from "react"


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
  const { organization } = useOrganization()
  const { data: session } = useSession()
  
  
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
        <NavMain routes={routes} groupLabel="Plataforma" />
      </SidebarContent>
      {session?.user && (
        <SidebarFooter>
          <NavUser user={session.user} />
        </SidebarFooter>
      )}
    </Sidebar>
  )
}
