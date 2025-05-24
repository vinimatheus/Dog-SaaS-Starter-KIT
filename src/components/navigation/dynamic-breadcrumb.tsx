"use client";

import React from "react";
import { usePathname } from "next/navigation";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { getOrganizationRoutes, type Route, type RouteItem } from "@/config/routes";
import { useMemo } from "react";

interface DynamicBreadcrumbProps {
  organizationName: string;
  organizationId: string;
}

type BreadcrumbSegment = {
  title: string;
  url: string;
  isActive: boolean;
  isClickable: boolean;
};


const NON_CLICKABLE_ROUTES = ["/config"];

export function DynamicBreadcrumb({ 
  organizationName, 
  organizationId 
}: DynamicBreadcrumbProps) {
  const pathname = usePathname();
  
  
  const routes = useMemo(() => getOrganizationRoutes(organizationId), [organizationId]);
  
  
  const breadcrumbSegments = useMemo(() => {
    
    const isRouteClickable = (path: string): boolean => {
      
      for (const nonClickable of NON_CLICKABLE_ROUTES) {
        
        if (path === `/${organizationId}${nonClickable}`) {
          return false;
        }
      }
      return true;
    };

    
    const segments: BreadcrumbSegment[] = [
      {
        title: organizationName,
        url: `/${organizationId}`,
        isActive: pathname === `/${organizationId}`,
        isClickable: true
      }
    ];
    
    
    if (pathname === `/${organizationId}`) {
      return segments;
    }
    
    
    let currentRoute: Route | undefined;
    let currentSubRoute: RouteItem | undefined;
    
    for (const route of routes) {
      
      if (pathname.startsWith(route.url) && route.url !== `/${organizationId}`) {
        currentRoute = route;
        
        
        if (pathname !== route.url && route.items && route.items.length > 0) {
          
          for (const item of route.items) {
            if (pathname === item.url || pathname.startsWith(`${item.url}/`)) {
              currentSubRoute = item;
              break;
            }
          }
        }
        
        break;
      }
    }
    
    
    if (currentRoute) {
      segments.push({
        title: currentRoute.title,
        url: currentRoute.url,
        isActive: pathname === currentRoute.url,
        isClickable: isRouteClickable(currentRoute.url)
      });
      
      
      if (currentSubRoute) {
        segments.push({
          title: currentSubRoute.title,
          url: currentSubRoute.url,
          isActive: pathname === currentSubRoute.url || pathname.startsWith(`${currentSubRoute.url}/`),
          isClickable: true 
        });
      } else if (pathname.includes("/config/members")) {
        
        segments.push({
          title: "Membros",
          url: `/${organizationId}/config/members`,
          isActive: true,
          isClickable: true
        });
      } else if (pathname.includes("/config/profile")) {
        
        segments.push({
          title: "Perfil",
          url: `/${organizationId}/config/profile`,
          isActive: true,
          isClickable: true
        });
      }
    }
    
    return segments;
  }, [pathname, organizationId, organizationName, routes]);
  
  return (
    <Breadcrumb>
      <BreadcrumbList>
        {breadcrumbSegments.map((segment, index) => (
          <React.Fragment key={`breadcrumb-${index}-${segment.title}`}>
            {index > 0 && <BreadcrumbSeparator className="hidden md:block" />}
            <BreadcrumbItem className="hidden md:block">
              {segment.isActive || !segment.isClickable ? (
                <BreadcrumbPage>{segment.title}</BreadcrumbPage>
              ) : (
                <BreadcrumbLink href={segment.url}>
                  {segment.title}
                </BreadcrumbLink>
              )}
            </BreadcrumbItem>
          </React.Fragment>
        ))}
      </BreadcrumbList>
    </Breadcrumb>
  );
} 