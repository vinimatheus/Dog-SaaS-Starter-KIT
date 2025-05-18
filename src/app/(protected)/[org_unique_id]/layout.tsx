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
 
export type AuthenticatedTeamsLayoutProps = {
	children: React.ReactNode;
	params: Promise<{
		org_unique_id: string;
	}>;
};

export const revalidate = 300;

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
		});
	},
	["organization-access"],
	{ revalidate }
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
	const organization = await getOrganization(org_unique_id, userId);

	if (!organization) {
		redirect("/organizations");
	}

	return (
		<OrganizationProvider organization={organization}>
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
		</OrganizationProvider>
	);
}