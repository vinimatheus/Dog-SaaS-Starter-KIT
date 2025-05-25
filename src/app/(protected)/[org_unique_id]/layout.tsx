import type React from "react";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { OrganizationProvider } from "@/contexts/organization-context";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { cookies } from "next/headers";
import { Separator } from "@/components/ui/separator";
import { unstable_cache } from "next/cache";
import { NotificationMenu } from "@/components/notification/notification-menu";
import { Toaster } from "sonner";
import { PlanType } from "@prisma/client";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { DynamicBreadcrumb } from "@/components/navigation/dynamic-breadcrumb";
import { PendingInvitesMenu } from "@/components/invite/pending-invites-menu";
 
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
	
	if (session.user.orgId === org_unique_id && session.user.orgName && session.user.orgPlan && session.user.orgRole) {
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

	const organization = await getOrganization(org_unique_id, userId);

	if (!organization) {
		redirect("/organizations?removed=true");
	}

	const userOrg = organization.User_Organization[0];
	const isOwner = userOrg.role === "OWNER";

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