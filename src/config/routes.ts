import { LucideIcon, LayoutDashboard, Settings } from "lucide-react"

export interface RouteItem {
  title: string
  url: string
}

export interface Route {
  title: string
  url: string
  icon: LucideIcon
  isActive?: boolean
  items?: RouteItem[]
}

export interface Project {
  name: string
  url: string
  icon: LucideIcon
}

/**
 * Base routes configuration for the application.
 * These routes will be transformed with organization-specific URLs.
 */
export const routes: Route[] = [
  {
    title: "Dashboard",
    url: "",
    icon: LayoutDashboard,
    isActive: true,
    items: [
      {
        title: "Visão Geral",
        url: "",
      },
    ],
  },
  {
    title: "Configurações",
    url: "/config",
    icon: Settings,
    isActive: true,
    items: [
      {
        title: "Perfil",
        url: "/profile",
      },
      {
        title: "Membros",
        url: "/members",
      },
      {
        title: "Organização",
        url: "/organization",
      },
    ],
  }
]

/**
 * Creates an organization-specific URL with the given path
 */
export const getOrgRoute = (orgUniqueId: string, path: string): string => {
  return `/${orgUniqueId}${path}`
}

/**
 * Normalizes a path to ensure proper formatting
 */
export const normalizePath = (basePath: string, itemPath: string): string => {
  if (basePath === "") {
    return itemPath
  }
  
  if (basePath !== "" && itemPath.startsWith("/")) {
    return `${basePath}${itemPath}`
  }
  
  return `${basePath}/${itemPath.replace(/^\//, "")}`
}

/**
 * Transforms base routes to organization-specific routes
 */
export const getOrganizationRoutes = (orgUniqueId: string): Route[] => {
  return routes.map(route => ({
    ...route,
    url: getOrgRoute(orgUniqueId, route.url),
    items: route.items?.map(item => ({
      ...item,
      url: getOrgRoute(orgUniqueId, normalizePath(route.url, item.url)),
    })),
  }))
} 