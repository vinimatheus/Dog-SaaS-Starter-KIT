import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { headers } from "next/headers";

interface ProtectedLayoutProps {
	children: React.ReactNode;
}

export const revalidate = 3600

export default async function ProtectedLayout({
	children,
}: ProtectedLayoutProps) {
	headers();
	
	const session = await auth();

	if (!session?.user?.id) {
		redirect("/");
	}

	if (!session.user.name) {
		const returnUrl = "/organizations";
		redirect(`/complete-profile?returnTo=${encodeURIComponent(returnUrl)}`);
	}

	return (
		<div className="flex min-h-screen">
			{children}
		</div>
	);
}
