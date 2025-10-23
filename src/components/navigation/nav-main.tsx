"use client"

import { usePathname } from "next/navigation"
import Link from "next/link"
import { memo } from "react"
import { ChevronRight } from "lucide-react"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
  SidebarGroup,
  SidebarGroupLabel,
  useSidebar
} from "@/components/ui/sidebar"
import type { Route, RouteItem } from "@/config/routes"
import { HydrationBoundary } from "@/components/ui/hydration-boundary"


const MenuItem = memo(function MenuItem({ 
  route, 
  pathname 
}: { 
  route: Route; 
  pathname: string 
}) {
  const isActive = pathname === route.url || pathname.startsWith(`${route.url}/`);
  const hasSubItems = route.items && route.items.length > 0;
  const { state, setOpen } = useSidebar();
  
  if (!hasSubItems) {
    
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
      </SidebarMenuItem>
    );
  }
  
  
  return (
    <Collapsible
      key={route.title}
      asChild
      defaultOpen={isActive}
      className="group/collapsible"
    >
      <SidebarMenuItem>
        <CollapsibleTrigger asChild>
          <SidebarMenuButton 
            tooltip={route.title}
            onClick={() => {
              
              if (state === "collapsed") {
                setOpen(true);
              }
            }}
          >
            {route.icon && <route.icon />}
            <span>{route.title}</span>
            <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
          </SidebarMenuButton>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <SidebarMenuSub>
            {route.items?.map((item) => (
              <SubMenuItem 
                key={item.url} 
                item={item} 
                pathname={pathname} 
              />
            ))}
          </SidebarMenuSub>
        </CollapsibleContent>
      </SidebarMenuItem>
    </Collapsible>
  );
});


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

export function NavMain({
  routes,
  groupLabel = "Plataforma"
}: {
  routes: Route[];
  groupLabel?: string;
}) {
  const pathname = usePathname();

  return (
    <HydrationBoundary fallback={
      <SidebarGroup>
        <SidebarGroupLabel>{groupLabel}</SidebarGroupLabel>
        <SidebarMenu>
          {routes.map((route) => (
            <SidebarMenuItem key={route.url}>
              <SidebarMenuButton asChild>
                <Link href={route.url}>
                  <route.icon />
                  <span>{route.title}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroup>
    }>
      <SidebarGroup>
        <SidebarGroupLabel>{groupLabel}</SidebarGroupLabel>
        <SidebarMenu>
          {routes.map((route) => (
            <MenuItem 
              key={route.url} 
              route={route} 
              pathname={pathname} 
            />
          ))}
        </SidebarMenu>
      </SidebarGroup>
    </HydrationBoundary>
  );
}
