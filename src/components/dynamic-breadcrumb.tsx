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

// Lista de rotas intermediárias (apenas agrupadores) que não devem ser clicáveis
const NON_CLICKABLE_ROUTES = ["/config"];

export function DynamicBreadcrumb({ 
  organizationName, 
  organizationId 
}: DynamicBreadcrumbProps) {
  const pathname = usePathname();
  
  // Gerar as rotas da organização
  const routes = useMemo(() => getOrganizationRoutes(organizationId), [organizationId]);
  
  // Gerar segments do breadcrumb baseado no pathname atual
  const breadcrumbSegments = useMemo(() => {
    // Função interna que verifica se uma rota é clicável
    const isRouteClickable = (path: string): boolean => {
      // Verifica se a rota está na lista de não clicáveis
      for (const nonClickable of NON_CLICKABLE_ROUTES) {
        // Verificar especificamente com o organizationId
        if (path === `/${organizationId}${nonClickable}`) {
          return false;
        }
      }
      return true;
    };

    // Sempre começa com a organização
    const segments: BreadcrumbSegment[] = [
      {
        title: organizationName,
        url: `/${organizationId}`,
        isActive: pathname === `/${organizationId}`,
        isClickable: true
      }
    ];
    
    // Se estamos na home da organização, retornamos só o primeiro segmento
    if (pathname === `/${organizationId}`) {
      return segments;
    }
    
    // Encontrar a rota principal e sub-rota correspondente
    let currentRoute: Route | undefined;
    let currentSubRoute: RouteItem | undefined;
    
    for (const route of routes) {
      // Verifica se estamos em uma rota principal
      if (pathname.startsWith(route.url) && route.url !== `/${organizationId}`) {
        currentRoute = route;
        
        // Se não for a página inicial da rota, verifica as sub-rotas
        if (pathname !== route.url && route.items && route.items.length > 0) {
          // Busca todos os URLs de subitens para esta rota
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
    
    // Adiciona a rota principal se encontrou
    if (currentRoute) {
      segments.push({
        title: currentRoute.title,
        url: currentRoute.url,
        isActive: pathname === currentRoute.url,
        isClickable: isRouteClickable(currentRoute.url)
      });
      
      // Se também encontrou sub-rota, adiciona ela
      if (currentSubRoute) {
        segments.push({
          title: currentSubRoute.title,
          url: currentSubRoute.url,
          isActive: pathname === currentSubRoute.url || pathname.startsWith(`${currentSubRoute.url}/`),
          isClickable: true // Subrotas são sempre clicáveis pois têm páginas reais
        });
      } else if (pathname.includes("/config/members")) {
        // Tratamento específico para a rota de membros se não foi encontrada
        segments.push({
          title: "Membros",
          url: `/${organizationId}/config/members`,
          isActive: true,
          isClickable: true
        });
      } else if (pathname.includes("/config/profile")) {
        // Tratamento específico para a rota de perfil se não foi encontrada
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