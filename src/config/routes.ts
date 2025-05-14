import { LucideIcon, LayoutDashboard, Settings } from "lucide-react"

export type Route = {
  title: string
  url: string
  icon: LucideIcon
  isActive?: boolean
  items?: {
    title: string
    url: string
  }[]
}

export type Project = {
  name: string
  url: string
  icon: LucideIcon
}

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
    ],
  }
]


export const getOrgRoute = (orgUniqueId: string, path: string) => {
  return `/${orgUniqueId}${path}`
}


export const getOrganizationRoutes = (orgUniqueId: string): Route[] => {
  return routes.map(route => ({
    ...route,
    url: getOrgRoute(orgUniqueId, route.url),
    items: route.items?.map(item => ({
      ...item,
      url: getOrgRoute(orgUniqueId, route.url !== "" && item.url.startsWith("/") 
        ? `${route.url}${item.url}` 
        : `${route.url}/${item.url.replace(/^\//, "")}`),
    })),
  }))
} 