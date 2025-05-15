import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Mail } from "lucide-react";

interface MetadataProps {
	params: Promise<{
		org_unique_id: string;
	}>;
}

export async function generateMetadata({
	params,
}: MetadataProps): Promise<Metadata> {
	const { org_unique_id } = await params;
	const organization = await prisma.organization.findUnique({
		where: { uniqueId: org_unique_id },
	});

	return {
		title: `${organization?.name || org_unique_id} - Dashboard`,
	};
}

interface OrganizationPageProps {
	params: Promise<{
		org_unique_id: string;
	}>;
}

export default async function OrganizationDashboard({
	params,
}: OrganizationPageProps) {
	const [session, { org_unique_id }] = await Promise.all([
		auth(),
		params
	]);

	if (!session?.user?.id) {
		redirect("/");
	}

	const organization = await prisma.organization.findUnique({
		where: { uniqueId: org_unique_id },
		include: {
			User_Organization: {
				include: {
					user: true,
				},
			},
			invites: {
				where: {
					status: "PENDING",
				},
			},
		},
	});

	if (!organization) {
		redirect("/organizations");
	}

	const currentUserOrg = organization.User_Organization.find(
		(userOrg) => userOrg.user_id === session.user.id
	);

	if (!currentUserOrg) {
		redirect("/organizations");
	}

	const totalMembers = organization.User_Organization.length;
	const pendingInvites = organization.invites.length;
	const adminCount = organization.User_Organization.filter(
		(userOrg) => userOrg.role === "ADMIN"
	).length;

	return (
		<div className="container mx-auto py-8 px-4">
			<div className="max-w-6xl mx-auto space-y-8">
				<div className="flex justify-between items-center">
					<div>
						<h1 className="text-3xl font-bold">{organization.name}</h1>
						<p className="text-gray-600 mt-1">Dashboard da organização</p>
					</div>
					<Button asChild>
						<Link href={`/${org_unique_id}/config/members`}>
							Gerenciar Membros
						</Link>
					</Button>
				</div>

				<div className="grid gap-4 md:grid-cols-2">
					<Card>
						<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
							<CardTitle className="text-sm font-medium">
								Total de Membros
							</CardTitle>
							<Users className="h-4 w-4 text-muted-foreground" />
						</CardHeader>
						<CardContent>
							<div className="text-2xl font-bold">{totalMembers}</div>
							<p className="text-xs text-muted-foreground">
								{adminCount} administradores
							</p>
						</CardContent>
					</Card>

					<Card>
						<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
							<CardTitle className="text-sm font-medium">
								Convites Pendentes
							</CardTitle>
							<Mail className="h-4 w-4 text-muted-foreground" />
						</CardHeader>
						<CardContent>
							<div className="text-2xl font-bold">{pendingInvites}</div>
							<p className="text-xs text-muted-foreground">
								aguardando aceitação
							</p>
						</CardContent>
					</Card>
				</div>

				<Card>
					<CardHeader>
						<CardTitle>Atividade Recente</CardTitle>
						<CardDescription>
							Últimas atividades na organização
						</CardDescription>
					</CardHeader>
					<CardContent>
						<div className="text-sm text-muted-foreground">
							Em breve: Histórico de atividades da organização
						</div>
					</CardContent>
				</Card>
			</div>
		</div>
	);
}