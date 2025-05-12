import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { InviteMemberForm } from "@/components/invite-member-form";
import { redirect } from "next/navigation";
import { Metadata } from "next";
import { InviteActions } from "@/components/invite-actions";
import { MembersList } from "@/components/organization/members-list";

interface MetadataProps {
	params: Promise<{
		org_unique_id: string;
	}>;
}

export async function generateMetadata({
	params,
}: MetadataProps): Promise<Metadata> {
	const { org_unique_id } = await params;
	
	return {
		title: `Dashboard - ${org_unique_id}`,
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

	const isAdmin = organization.User_Organization.some(
		(userOrg) => userOrg.role === "ADMIN" || userOrg.role === "OWNER"
	);

	return (
		<div className="container mx-auto py-8 px-4">
			<div className="max-w-4xl mx-auto space-y-8">
				<div className="flex justify-between items-center">
					<div>
						<h1 className="text-3xl font-bold">{organization.name}</h1>
						<p className="text-gray-600 mt-1">Dashboard da organização</p>
					</div>
				</div>

				{/* Lista de Membros */}
				<div className="bg-white rounded-lg shadow-md p-6">
					<h2 className="text-xl font-semibold mb-4">Membros</h2>
					<MembersList
						members={organization.User_Organization}
						organizationId={organization.id}
						currentUserRole={isAdmin ? "ADMIN" : "USER"}
						currentUserId={session.user.id}
					/>
				</div>

				{/* Seção de Convites */}
				{isAdmin && organization.invites.length > 0 && (
					<div className="bg-white rounded-lg shadow-md p-6">
						<h2 className="text-xl font-semibold mb-4">Convites Pendentes</h2>
						<div className="space-y-4">
							{organization.invites.map((invite) => (
								<div
									key={invite.id}
									className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
								>
									<div>
										<p className="font-medium">{invite.email}</p>
										<div className="flex items-center gap-2 mt-1">
											<span className={`px-2 py-1 text-xs rounded-full ${
												invite.role === "ADMIN"
													? "bg-blue-100 text-blue-800"
													: "bg-gray-100 text-gray-800"
											}`}>
												{invite.role === "ADMIN" ? "Administrador" : "Membro"}
											</span>
											<span className={`px-2 py-1 text-xs rounded-full ${
												invite.status === "PENDING"
													? "bg-yellow-100 text-yellow-800"
													: "bg-gray-100 text-gray-800"
											}`}>
												{invite.status === "PENDING" ? "Pendente" : "Expirado"}
											</span>
											<span className="text-xs text-gray-500">
												Enviado em {new Date(invite.created_at).toLocaleDateString("pt-BR")}
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

				{/* Formulário de Convite */}
				{isAdmin && (
					<div className="bg-white rounded-lg shadow-md p-6">
						<h2 className="text-xl font-semibold mb-4">Convidar Novo Membro</h2>
						<InviteMemberForm organizationId={organization.id} />
					</div>
				)}
			</div>
		</div>
	);
}