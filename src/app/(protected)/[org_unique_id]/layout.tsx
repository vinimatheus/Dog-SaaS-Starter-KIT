import type React from "react";

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

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
	const session = await auth();

	const { org_unique_id } = await params;

	if (!session?.user) {
		redirect("/");
	}

	const userId = session.user.id;

	const org = await prisma.organization.findUnique({
		where: {
			uniqueId: org_unique_id,
			User_Organization: {
				some: {
					user_id: userId,
				},
			},
		},
	});

	if (!org) {
		redirect("/organizations");
	}

	return (
		<div className="relative flex w-full h-full flex-col items-start justify-start p-2">
			{children}
		</div>
	);
}