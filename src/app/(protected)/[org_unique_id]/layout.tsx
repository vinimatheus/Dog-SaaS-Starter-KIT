import type React from "react";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { OrganizationProvider } from "@/contexts/organization-context";
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { cookies } from "next/headers";
import { Separator } from "@/components/ui/separator";
import { DynamicBreadcrumb } from "@/components/dynamic-breadcrumb";
import { unstable_cache } from "next/cache";
import { NotificationMenu } from "@/components/notification/notification-menu";
import { PendingInvitesMenu } from "@/components/pending-invites-menu";
import { Toaster } from "sonner";
import { PlanType } from "@prisma/client";
 
export type AuthenticatedTeamsLayoutProps = {
	children: React.ReactNode;
	params: Promise<{
		org_unique_id: string;
	}>;
};

const getOrganization = unstable_cache(
	async (uniqueId: string, userId: string) => {
		return prisma.organization.findUnique({
			where: {
				uniqueId,
				User_Organization: {
					some: {
						user_id: userId,
					},
				},
			},
			include: {
				User_Organization: {
					where: {
						user_id: userId,
					},
				},
			},
		});
	},
	["organization-access"],
	{ revalidate: false }
);

export default async function AuthenticatedOrganizationLayout({
	children,
	params,
}: AuthenticatedTeamsLayoutProps) {
	const [session, cookieStore, { org_unique_id }] = await Promise.all([
		auth(),
		cookies(),
		params
	]);

	const defaultOpen = cookieStore.get("sidebar_state")?.value === "true";

	if (!session?.user) {
		redirect("/");
	}

	const userId = session.user.id;
	
	// Verifica se a organização está no token JWT
	if (session.user.orgId === org_unique_id && session.user.orgName && session.user.orgPlan && session.user.orgRole) {
		// Usa os dados do token JWT
		const organization = {
			id: session.user.orgId,
			name: session.user.orgName,
			plan: session.user.orgPlan as PlanType,
			owner_user_id: userId,
			uniqueId: org_unique_id,
			stripeCustomerId: null,
			stripeSubscriptionId: null,
			User_Organization: [{
				role: session.user.orgRole
			}]
		};

		const isOwner = session.user.orgRole === "OWNER";

		// Se não for o dono e a organização estiver no plano FREE, redireciona
		if (!isOwner && organization.plan === "FREE") {
			redirect("/organizations?access_denied=true");
		}

		return (
			<OrganizationProvider 
				organization={organization}
				refetchOrganization={async () => {
					"use server"
					const newOrg = await getOrganization(org_unique_id, userId)
					if (newOrg) {
						organization.name = newOrg.name
					}
				}}
			>
				<SidebarProvider defaultOpen={defaultOpen}>
					<AppSidebar />
					<SidebarInset>
						<header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
							<div className="flex items-center gap-2 px-4">
								<SidebarTrigger className="-ml-1" />
								<Separator
									orientation="vertical"
									className="mr-2 data-[orientation=vertical]:h-4"
								/>
								<DynamicBreadcrumb 
									organizationName={organization.name} 
									organizationId={org_unique_id} 
								/>
							</div>
							<div className="ml-auto mr-4 flex items-center gap-2">
								<PendingInvitesMenu />
								<NotificationMenu />
							</div>
						</header>
						<main className="flex flex-1 flex-col gap-4 p-4 pt-0">
							{children}
						</main>
					</SidebarInset>
				</SidebarProvider>
				<Toaster richColors position="top-right" />
			</OrganizationProvider>
		);
	}

	// Se não estiver no token JWT, busca do banco de dados
	const organization = await getOrganization(org_unique_id, userId);

	if (!organization) {
		redirect("/organizations?removed=true");
	}

	const userOrg = organization.User_Organization[0];
	const isOwner = userOrg.role === "OWNER";

	// Se não for o dono e a organização estiver no plano FREE, redireciona
	if (!isOwner && organization.plan === "FREE") {
		redirect("/organizations?access_denied=true");
	}

	return (
		<OrganizationProvider 
			organization={organization}
			refetchOrganization={async () => {
				"use server"
				const newOrg = await getOrganization(org_unique_id, userId)
				if (newOrg) {
					organization.name = newOrg.name
				}
			}}
		>
			<SidebarProvider defaultOpen={defaultOpen}>
				<AppSidebar />
				<SidebarInset>
					<header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
						<div className="flex items-center gap-2 px-4">
							<SidebarTrigger className="-ml-1" />
							<Separator
								orientation="vertical"
								className="mr-2 data-[orientation=vertical]:h-4"
							/>
							<DynamicBreadcrumb 
								organizationName={organization.name} 
								organizationId={org_unique_id} 
							/>
						</div>
						<div className="ml-auto mr-4 flex items-center gap-2">
							<PendingInvitesMenu />
							<NotificationMenu />
						</div>
					</header>
					<main className="flex flex-1 flex-col gap-4 p-4 pt-0">
						{children}
					</main>
				</SidebarInset>
			</SidebarProvider>
			<Toaster richColors position="top-right" />
		</OrganizationProvider>
	);
}