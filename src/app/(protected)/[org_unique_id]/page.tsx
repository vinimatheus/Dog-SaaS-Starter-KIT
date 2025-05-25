import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Mail } from "lucide-react";
import { unstable_cache } from "next/cache";
import { Suspense } from "react";
import { PageLayout } from "@/components/layout/page-layout";
import { PendingInvites } from "@/components/invite/pending-invites";

const LoadingCard = () => (
	<Card className="animate-pulse">
		<CardHeader className="space-y-0 pb-2">
			<div className="h-5 w-24 bg-gray-200 rounded"></div>
		</CardHeader>
		<CardContent>
			<div className="h-8 w-12 bg-gray-200 rounded"></div>
			<div className="h-4 w-36 bg-gray-200 rounded mt-2"></div>
		</CardContent>
	</Card>
);

interface MetadataProps {
	params: Promise<{
		org_unique_id: string;
	}>;
}

export const revalidate = 300; 

const getOrganizationForMetadata = unstable_cache(
	async (org_unique_id: string) => {
		return prisma.organization.findUnique({
			where: { uniqueId: org_unique_id },
			select: { name: true }
		});
	},
	["organization-metadata"],
	{ revalidate }
);

export async function generateMetadata({
	params,
}: MetadataProps): Promise<Metadata> {
	const { org_unique_id } = await params;
	const organization = await getOrganizationForMetadata(org_unique_id);

	return {
		title: `${organization?.name || org_unique_id} - Dashboard`,
	};
}

interface OrganizationPageProps {
	params: Promise<{
		org_unique_id: string;
	}>;
}

const getOrganizationDashboardData = unstable_cache(
	async (org_unique_id: string, userId: string) => {
		const organization = await prisma.organization.findUnique({
			where: { uniqueId: org_unique_id },
			include: {
				User_Organization: {
					select: {
						user_id: true,
						role: true,
						user: {
							select: {
								id: true,
								name: true,
								email: true,
							}
						}
					},
				},
				invites: {
					where: {
						status: "PENDING",
					},
					select: {
						id: true,
					}
				},
			},
		});

		if (!organization) return null;

		const currentUserOrg = organization.User_Organization.find(
			(userOrg) => userOrg.user_id === userId
		);

		if (!currentUserOrg) return null;

		return {
			organization,
			stats: {
				totalMembers: organization.User_Organization.length,
				pendingInvites: organization.invites.length,
				adminCount: organization.User_Organization.filter(
					(userOrg) => userOrg.role === "ADMIN"
				).length,
			}
		};
	},
	["organization-dashboard"],
	{ revalidate }
);

function OrganizationStats({ stats }: { 
	stats: { 
		totalMembers: number;
		pendingInvites: number;
		adminCount: number;
	} 
}) {
	return (
		<div className="grid gap-4 md:grid-cols-2">
			<Card>
				<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
					<CardTitle className="text-sm font-medium">
						Total de Membros
					</CardTitle>
					<Users className="h-4 w-4 text-muted-foreground" />
				</CardHeader>
				<CardContent>
					<div className="text-2xl font-bold">{stats.totalMembers}</div>
					<p className="text-xs text-muted-foreground">
						{stats.adminCount} administradores
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
					<div className="text-2xl font-bold">{stats.pendingInvites}</div>
					<p className="text-xs text-muted-foreground">
						aguardando aceitação
					</p>
				</CardContent>
			</Card>
		</div>
	);
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

	const data = await getOrganizationDashboardData(org_unique_id, session.user.id);
	
	if (!data) {
		redirect("/organizations");
	}
	
	const { organization, stats } = data;

	return (
		<PageLayout
			title={organization.name}
			description="Dashboard da organização"
			headerActions={
				<Button asChild>
					<Link href={`/${org_unique_id}/config/members`}>
						Gerenciar Membros
					</Link>
				</Button>
			}
		>
			<Suspense fallback={
				<div className="grid gap-4 md:grid-cols-2">
					<LoadingCard />
					<LoadingCard />
				</div>
			}>
				<OrganizationStats stats={stats} />
			</Suspense>

			{/* Convites Pendentes */}
			<div className="mt-6">
				<PendingInvites />
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
		</PageLayout>
	);
}