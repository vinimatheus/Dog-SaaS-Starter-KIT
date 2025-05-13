import type React from "react";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { OrganizationProvider } from "@/contexts/organization-context";
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { cookies } from "next/headers";
import { Separator } from "@/components/ui/separator";
import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbList,
	BreadcrumbPage,
	BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

export type AuthenticatedTeamsLayoutProps = {
	children: React.ReactNode;
	params: Promise<{
		org_unique_id: string;
	}>;
};

export default async function AuthenticatedOrganizationLayout({
	children,
	params,
}: AuthenticatedTeamsLayoutProps) {
	const [session, cookieStore] = await Promise.all([
		auth(),
		cookies()
	]);

	const { org_unique_id } = await params;
	const defaultOpen = cookieStore.get("sidebar_state")?.value === "true";

	if (!session?.user) {
		redirect("/");
	}

	const userId = session.user.id;

	const organization = await prisma.organization.findUnique({
		where: {
			uniqueId: org_unique_id,
			User_Organization: {
				some: {
					user_id: userId,
				},
			},
		},
	});

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
							<Breadcrumb>
								<BreadcrumbList>
									<BreadcrumbItem className="hidden md:block">
										<BreadcrumbLink href={`/${org_unique_id}`}>
											{organization.name}
										</BreadcrumbLink>
									</BreadcrumbItem>
									<BreadcrumbSeparator className="hidden md:block" />
									<BreadcrumbItem>
										<BreadcrumbPage>Dashboard</BreadcrumbPage>
									</BreadcrumbItem>
								</BreadcrumbList>
							</Breadcrumb>
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