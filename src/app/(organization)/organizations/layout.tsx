import { ReactNode } from "react";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

interface OrganizationsLayoutProps {
	children: ReactNode;
	params: Promise<{
		org_unique_id?: string;
	}>;
}

export default async function ProtectedLayout({
	children,
	params,
}: OrganizationsLayoutProps) {
	const session = await Promise.all([
		auth(),
		params
	]).then(([authResult]) => authResult);

	if (!session?.user?.id) {
		redirect("/login");
	}

	const user = await prisma.user.findUnique({
		where: { id: session.user.id },
		include: {
			User_Organization: {
				include: {
					organization: true,
				},
			},
		},
	});

	if (!user) {
		redirect("/login");
	}

	if (user.User_Organization.length === 0) {
		redirect("/organizations");
	}

	return (
		<div className="flex-1 space-y-4 p-8 pt-6">
			{children}
		</div>
	);
}
