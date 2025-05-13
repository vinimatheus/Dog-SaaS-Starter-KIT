import { LucideIcon, LayoutDashboard, Users } from "lucide-react"

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
    title: "Membros",
    url: "/members",
    icon: Users,
    items: [
      {
        title: "Lista de Membros",
        url: "/members",
      },
    ],
  },
]

// Função auxiliar para gerar URLs com o ID da organização
export const getOrgRoute = (orgUniqueId: string, path: string) => {
  return `/${orgUniqueId}${path}`
}

// Função para obter as rotas com o ID da organização
export const getOrganizationRoutes = (orgUniqueId: string): Route[] => {
  return routes.map(route => ({
    ...route,
    url: getOrgRoute(orgUniqueId, route.url),
    items: route.items?.map(item => ({
      ...item,
      url: getOrgRoute(orgUniqueId, item.url),
    })),
  }))
} 