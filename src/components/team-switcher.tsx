"use client"

import * as React from "react"
import { memo, useCallback, useMemo } from "react"
import { ChevronsUpDown, Plus, Building2, Check } from "lucide-react"
import { useRouter, usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { startTransition } from "react"

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
import { useOrganizations } from "@/hooks/useOrganizations"

interface Organization {
  id: string
  uniqueId: string
  name: string
}

// Componente memoizado para o item da organização na lista
const OrganizationItem = memo(function OrganizationItem({
  org,
  isActive,
  onSelect
}: {
  org: Organization,
  isActive: boolean,
  onSelect: (org: Organization) => void
}) {
  const handleClick = useCallback(() => {
    onSelect(org);
  }, [org, onSelect]);

  return (
    <DropdownMenuItem
      key={org.id}
      onClick={handleClick}
      className={cn(
        "gap-2 p-2",
        isActive && "bg-accent"
      )}
    >
      <div className="flex size-6 items-center justify-center rounded-md border">
        <Building2 className="size-3.5 shrink-0" />
      </div>
      <span className="flex-1">{org.name}</span>
      <Check
        className={cn(
          "ml-auto h-4 w-4",
          isActive ? "opacity-100" : "opacity-0"
        )}
      />
    </DropdownMenuItem>
  );
});

// Componente principal para o seletor de organizações
export function TeamSwitcher() {
  const { isMobile } = useSidebar()
  const router = useRouter()
  const pathname = usePathname()
  const currentOrgUniqueId = useMemo(() => pathname.split("/")[1], [pathname])
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [dropdownOpen, setDropdownOpen] = React.useState(false)

  const { organizations, loading, error, refetch } = useOrganizations()

  // Memoriza a organização atual para evitar re-renderizações
  const currentOrg = useMemo(() => 
    organizations.find((org) => org.uniqueId === currentOrgUniqueId),
    [organizations, currentOrgUniqueId]
  );

  // Callbacks memoizados para evitar recriações de funções
  const handleCreateOrganization = useCallback(() => {
    setDropdownOpen(false)
    startTransition(() => {
      setDialogOpen(true)
    })
  }, []);

  const handleSuccess = useCallback(async () => {
    setDialogOpen(false)
    await refetch()
  }, [refetch]);

  const handleSelectOrganization = useCallback((org: Organization) => {
    startTransition(() => {
      router.push(`/${org.uniqueId}`)
    })
    setDropdownOpen(false)
  }, [router]);

  // Renderização condicional para a lista de organizações
  const renderOrganizationList = useCallback(() => {
    if (loading) {
      return <DropdownMenuItem disabled>Carregando...</DropdownMenuItem>
    }
    
    if (error) {
      return <DropdownMenuItem disabled>Erro ao carregar</DropdownMenuItem>
    }
    
    if (organizations.length === 0) {
      return (
        <DropdownMenuItem disabled className="text-muted-foreground">
          Nenhuma organização encontrada
        </DropdownMenuItem>
      )
    }
    
    return organizations.map((org) => (
      <OrganizationItem
        key={org.id}
        org={org}
        isActive={currentOrgUniqueId === org.uniqueId}
        onSelect={handleSelectOrganization}
      />
    ))
  }, [loading, error, organizations, currentOrgUniqueId, handleSelectOrganization]);
  
  return (
    <>
      <SidebarMenu>
        <SidebarMenuItem>
          <DropdownMenu open={dropdownOpen} onOpenChange={setDropdownOpen}>
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
              {renderOrganizationList()}
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
