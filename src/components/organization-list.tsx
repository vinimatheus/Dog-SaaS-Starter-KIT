"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import {
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useState, useEffect } from "react";
import { organizationsApi, Organization } from "@/lib/api-client";

interface OrganizationListProps {
	organizations?: Organization[];
	currentOrgId?: string;
}

export function OrganizationList({ organizations: initialOrgs, currentOrgId }: OrganizationListProps) {
	const router = useRouter();
	const [open, setOpen] = useState(false);
	const [organizations, setOrganizations] = useState<Organization[]>(initialOrgs || []);
	const [loading, setLoading] = useState(initialOrgs ? false : true);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		// Se não recebemos organizações iniciais, buscamos da API
		if (!initialOrgs) {
			fetchOrganizations();
		}
	}, [initialOrgs]);

	// Função para buscar organizações da API
	const fetchOrganizations = async () => {
		try {
			setLoading(true);
			const data = await organizationsApi.getAll();
			setOrganizations(data);
			setError(null);
		} catch (err) {
			console.error("Erro ao buscar organizações:", err);
			setError("Não foi possível carregar as organizações");
		} finally {
			setLoading(false);
		}
	};

	// Se não temos organizações e estamos carregando, exibir estado de carregamento
	if (loading && organizations.length === 0) {
		return (
			<Button variant="ghost" className="flex items-center justify-between gap-2 px-2" disabled>
				<div className="h-5 w-5 rounded-full" />
				<span className="text-sm font-medium">Carregando...</span>
			</Button>
		);
	}

	// Se tivemos um erro e não temos organizações, exibir estado de erro
	if (error && organizations.length === 0) {
		return (
			<Button variant="ghost" className="flex items-center justify-between gap-2 px-2" disabled>
				<div className="h-5 w-5 rounded-full" />
				<span className="text-sm font-medium text-red-500">Erro ao carregar</span>
			</Button>
		);
	}

	// Se não temos organizações, exibir estado vazio
	if (organizations.length === 0) {
		return (
			<Button variant="ghost" className="flex items-center justify-between gap-2 px-2" disabled>
				<div className="h-5 w-5 rounded-full" />
				<span className="text-sm font-medium">Nenhuma organização</span>
			</Button>
		);
	}

	const currentOrg = organizations.find((org) => org.uniqueId === currentOrgId) || organizations[0];

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>
				<Button
					variant="ghost"
					role="combobox"
					aria-expanded={open}
					className="flex items-center justify-between gap-2 px-2"
				>
					<div
						className="h-5 w-5 rounded-full"
					/>
					<div className="flex items-center gap-2">
						<span className="text-sm font-medium">{currentOrg.name}</span>
						<Badge variant="outline" className="text-xs font-normal">
							{currentOrg.type === "personal" ? "Personal" : "Team"}
						</Badge>
					</div>
					<ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
				</Button>
			</PopoverTrigger>
			<PopoverContent className="w-[200px] p-0">
				<Command>
					<CommandInput placeholder="Buscar organização..." />
					<CommandList>
						<CommandEmpty>Nenhuma organização encontrada.</CommandEmpty>
						<CommandGroup>
							{organizations.map((org) => (
								<CommandItem
									key={org.id}
									value={org.name}
									onSelect={() => {
										router.push(`/${org.uniqueId}`);
										setOpen(false);
									}}
									className="flex items-center gap-2"
								>
									<div
										className="h-4 w-4 rounded-full"
									/>
									<span>{org.name}</span>
									<span className="ml-auto text-xs text-muted-foreground">
										{org.type === "personal" ? "Personal" : "Team"}
									</span>
									<Check
										className={cn(
											"ml-auto h-4 w-4",
											currentOrg.uniqueId === org.uniqueId
												? "opacity-100"
												: "opacity-0",
										)}
									/>
								</CommandItem>
							))}
						</CommandGroup>
					</CommandList>
				</Command>
			</PopoverContent>
		</Popover>
	);
} 