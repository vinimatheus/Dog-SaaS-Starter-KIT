"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Check, ChevronsUpDown, Dog, Plus, Building2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
	CommandSeparator,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useRouter, usePathname } from "next/navigation";
import { UserNav } from "./user-nav";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { CreateOrganizationForm } from "@/components/organization/create-organization-form";

// Define organization type (sem 'color')
type Organization = {
	id: string;
	name: string;
	uniqueId: string;	
};

export function ProtectedHeader() {
	const [open, setOpen] = useState(false);
	const [organizations, setOrganizations] = useState<Organization[]>([]);
	const [dialogOpen, setDialogOpen] = useState(false);
	const router = useRouter();
	const pathname = usePathname();
	const currentOrgUniqueId = pathname.split("/")[1];

	const loadOrganizations = async () => {
		const res = await fetch("/api/organizations");
		const data: Organization[] = await res.json();
		setOrganizations(data);
	};

	useEffect(() => {
		loadOrganizations();
	}, []);

	const handleCreateOrganization = () => {
		setOpen(false);
		// Pequeno delay para garantir que o Popover feche antes do Dialog abrir
		setTimeout(() => {
			setDialogOpen(true);
		}, 100);
	};

	const handleSuccess = async () => {
		setDialogOpen(false);
		await loadOrganizations();
	};

	const handleSelectOrganization = async (org: Organization) => {
		router.push(`/${org.uniqueId}`);
		setOpen(false);
	};

	// Se não tiver nenhuma organização ainda
	if (organizations.length === 0) {
		return (
			<header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
				<div className="flex h-14 items-center px-4">
					<div className="flex items-center space-x-4">
						<Link href="/" className="flex items-center space-x-2">
							<Dog className="h-6 w-6" />
						</Link>
						<div className="h-4 w-[1px] bg-gray-200" />
						<Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
							<DialogTrigger asChild>
								<Button variant="ghost" size="sm" className="gap-2">
									<Plus className="h-4 w-4" />
									Criar Organização
								</Button>
							</DialogTrigger>
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
					</div>
					<div className="ml-auto flex items-center space-x-2">
						<UserNav />
					</div>
				</div>
			</header>
		);
	}

	// Se tiver organizações, mostra o seletor
	return (
		<header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
			<div className="flex h-14 items-center px-4">
				<div className="flex items-center space-x-4">
					<Link href="/" className="flex items-center space-x-2">
						<Dog className="h-6 w-6" />
					</Link>
					<div className="h-4 w-[1px] bg-gray-200" />
					<Popover open={open} onOpenChange={setOpen}>
						<PopoverTrigger asChild>
							<Button
								variant="ghost"
								role="combobox"
								aria-expanded={open}
								className="flex items-center justify-between gap-2 px-2"
							>
								<Building2 className="h-4 w-4 text-gray-500" />
								<span className="text-sm font-medium">
									{organizations.find((o) => o.uniqueId === currentOrgUniqueId)?.name || "Selecionar"}
								</span>
								<ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
							</Button>
						</PopoverTrigger>
						<PopoverContent className="w-[240px] p-0">
							<Command>
								<CommandInput placeholder="Buscar organização..." />
								<CommandList>
									<CommandEmpty>Nenhuma organização encontrada.</CommandEmpty>
									<CommandGroup heading="Suas Organizações">
										{organizations.map((org) => (
											<CommandItem
												key={org.id}
												value={org.name}
												onSelect={() => handleSelectOrganization(org)}
												className="flex items-center gap-2"
											>
												<Building2 className="h-4 w-4 text-gray-500" />
												<span>{org.name}</span>
												<Check
													className={cn(
														"ml-auto h-4 w-4",
														currentOrgUniqueId === org.uniqueId
															? "opacity-100"
															: "opacity-0"
													)}
												/>
											</CommandItem>
										))}
									</CommandGroup>
									<CommandSeparator />
									<CommandGroup>
										<CommandItem
											onSelect={handleCreateOrganization}
											className="flex items-center gap-2 text-primary"
										>
											<Plus className="h-4 w-4" />
											Criar Nova Organização
										</CommandItem>
									</CommandGroup>
								</CommandList>
							</Command>
						</PopoverContent>
					</Popover>
				</div>
				<div className="ml-auto flex items-center space-x-2">
					<UserNav />
				</div>
			</div>
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
		</header>
	);
}
