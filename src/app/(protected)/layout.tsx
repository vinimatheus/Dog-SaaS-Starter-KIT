import { auth } from "@/auth";
import { OrganizationProvider } from "@/contexts/organization-context";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { ProtectedHeader } from "@/components/protected-header";

interface ProtectedLayoutProps {
	children: React.ReactNode;
	params: Promise<{
		org_unique_id?: string;
	}>;
}

export default async function ProtectedLayout({
	children,
	params,
}: ProtectedLayoutProps) {
	const [session, { org_unique_id }] = await Promise.all([
		auth(),
		params
	]);

	if (!session?.user?.id) {
		redirect("/");
	}

	let organization = null;

	if (org_unique_id) {
		organization = await prisma.organization.findUnique({
			where: {
				uniqueId: org_unique_id,
				User_Organization: {
					some: {
						user_id: session.user.id,
					},
				},
			},
		});

		if (!organization) {
			redirect("/organizations");
		}
	}

	return (
		<OrganizationProvider organization={organization}>
			<div className="min-h-screen bg-gray-50">
				<ProtectedHeader />
				<main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
					{children}
				</main>
			</div>
		</OrganizationProvider>
	);
}
