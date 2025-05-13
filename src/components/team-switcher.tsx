"use client"

import * as React from "react"
import { ChevronsUpDown, Plus, Building2, Check } from "lucide-react"
import { useRouter, usePathname } from "next/navigation"
import { cn } from "@/lib/utils"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { CreateOrganizationForm } from "@/components/organization/create-organization-form"

type Organization = {
  id: string
    name: string
  uniqueId: string
}

export function TeamSwitcher() {
  const { isMobile } = useSidebar()
  const router = useRouter()
  const pathname = usePathname()
  const currentOrgUniqueId = pathname.split("/")[1]
  const [organizations, setOrganizations] = React.useState<Organization[]>([])
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [open, setOpen] = React.useState(false)

  const loadOrganizations = async () => {
    const res = await fetch("/api/organizations")
    const data: Organization[] = await res.json()
    setOrganizations(data)
  }

  React.useEffect(() => {
    loadOrganizations()
  }, [])

  const handleCreateOrganization = () => {
    setOpen(false)
    setTimeout(() => {
      setDialogOpen(true)
    }, 100)
  }

  const handleSuccess = async () => {
    setDialogOpen(false)
    await loadOrganizations()
  }

  const handleSelectOrganization = async (org: Organization) => {
    router.push(`/${org.uniqueId}`)
    setOpen(false)
  }

  const currentOrg = organizations.find((o) => o.uniqueId === currentOrgUniqueId)

  return (
    <>
    <SidebarMenu>
      <SidebarMenuItem>
          <DropdownMenu open={open} onOpenChange={setOpen}>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
                className={cn(
                  "data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground",
                  currentOrg && "bg-sidebar-accent/50"
                )}
            >
              <div className="bg-sidebar-primary text-sidebar-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg">
                  <Building2 className="size-4" />
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">
                    {currentOrg?.name || "Selecionar Organização"}
                  </span>
                  <span className="truncate text-xs">
                    {currentOrg ? "Organização" : "Nenhuma selecionada"}
                  </span>
              </div>
              <ChevronsUpDown className="ml-auto" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
            align="start"
            side={isMobile ? "bottom" : "right"}
            sideOffset={4}
          >
            <DropdownMenuLabel className="text-muted-foreground text-xs">
                Organizações
            </DropdownMenuLabel>
              {organizations.length > 0 ? (
                organizations.map((org) => (
                  <DropdownMenuItem
                    key={org.id}
                    onClick={() => handleSelectOrganization(org)}
                    className={cn(
                      "gap-2 p-2",
                      currentOrgUniqueId === org.uniqueId && "bg-accent"
                    )}
                  >
                    <div className="flex size-6 items-center justify-center rounded-md border">
                      <Building2 className="size-3.5 shrink-0" />
                    </div>
                    <span className="flex-1">{org.name}</span>
                    <Check
                      className={cn(
                        "ml-auto h-4 w-4",
                        currentOrgUniqueId === org.uniqueId
                          ? "opacity-100"
                          : "opacity-0"
                      )}
                    />
                  </DropdownMenuItem>
                ))
              ) : (
                <DropdownMenuItem disabled className="text-muted-foreground">
                  Nenhuma organização encontrada
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={handleCreateOrganization}
                className="gap-2 p-2"
              >
                <div className="flex size-6 items-center justify-center rounded-md border bg-transparent">
                  <Plus className="size-4" />
                </div>
                <div className="text-muted-foreground font-medium">
                  Criar Organização
                </div>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Criar Nova Organização</DialogTitle>
            <DialogDescription>
              Crie uma nova organização para gerenciar seus projetos e equipes.
            </DialogDescription>
          </DialogHeader>
          <CreateOrganizationForm onSuccess={handleSuccess} />
        </DialogContent>
      </Dialog>
    </>
  )
}
