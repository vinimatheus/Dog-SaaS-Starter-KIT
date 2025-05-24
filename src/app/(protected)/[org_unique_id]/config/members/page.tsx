import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { Metadata } from "next";
import { MembersList } from "@/components/organization/members-list";
import { cn } from "@/lib/utils";
import { PageLayout } from "@/components/layout/page-layout";
import { InviteMemberForm } from "@/components/invite/invite-member-form";
import { InviteActions } from "@/components/invite/invite-actions";

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
		title: `Membros - ${organization?.name || org_unique_id}`,
	};
}

interface MembersPageProps {
	params: Promise<{
		org_unique_id: string;
	}>;
}

export default async function MembersPage({
	params,
}: MembersPageProps) {
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
					status: {
						in: ["PENDING", "EXPIRED"],
					},
				},
				orderBy: {
					created_at: "desc",
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

	const userRole = currentUserOrg.role;

	return (
		<PageLayout
			title="Membros"
			description="Gerencie os membros da organização"
		>
			<div className="grid gap-6">
				{/* Formulário de Convite - Apenas para admin e owner */}
				{(userRole === "ADMIN" || userRole === "OWNER") && (
				<div className="bg-card rounded-md border border-muted p-4 w-full">
					<h2 className="text-sm font-medium mb-3">Convidar novo membro</h2>
					<InviteMemberForm organizationId={organization.id} plan={organization.plan} />
				</div>
				)}
	
				{/* Membros Ativos */}
				<div className="bg-card rounded-md border border-muted p-4 w-full">
					<h2 className="text-sm font-medium mb-3">Membros ativos</h2>
					<MembersList
						members={organization.User_Organization}
						organizationId={organization.id}
						currentUserRole={currentUserOrg.role}
						currentUserId={session.user.id}
					/>
				</div>
	
				{/* Convites Pendentes */}
				{organization.invites.length > 0 && (
					<div className="bg-card rounded-md border border-muted p-4 w-full">
						<h2 className="text-sm font-medium mb-3">Convites pendentes</h2>
						<div className="space-y-2">
							{organization.invites.map((invite) => (
								<div
									key={invite.id}
									className="flex items-center justify-between p-3 bg-muted/30 rounded-md text-sm"
								>
									<div>
										<p className="font-medium text-sm">{invite.email}</p>
										<div className="flex items-center gap-2 mt-1 text-xs">
											<span
												className={cn(
													"px-2 py-0.5 rounded-full font-medium",
													invite.role === "ADMIN"
														? "bg-blue-100 text-blue-800"
														: "bg-gray-100 text-gray-800"
												)}
											>
												{invite.role === "ADMIN" ? "Admin" : "Membro"}
											</span>
											<span
												className={cn(
													"px-2 py-0.5 rounded-full font-medium",
													invite.status === "PENDING"
														? "bg-yellow-100 text-yellow-800"
														: "bg-gray-100 text-gray-800"
												)}
											>
												{invite.status === "PENDING" ? "Pendente" : "Expirado"}
											</span>
											<span className="text-muted-foreground">
												{new Date(invite.created_at).toLocaleDateString("pt-BR")}
											</span>
										</div>
									</div>
									<InviteActions
										inviteId={invite.id}
										status={invite.status}
										expiresAt={invite.expires_at}
									/>
								</div>
							))}
						</div>
					</div>
				)}
			</div>
		</PageLayout>
	);
} 