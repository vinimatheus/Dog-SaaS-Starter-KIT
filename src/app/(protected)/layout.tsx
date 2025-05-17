import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { headers } from "next/headers";

interface ProtectedLayoutProps {
	children: React.ReactNode;
}

// Aumenta a revalidação para reduzir chamadas ao servidor
export const revalidate = 3600; // revalida a cada hora

export default async function ProtectedLayout({
	children,
}: ProtectedLayoutProps) {
	// Adiciona cache-control para melhorar performance
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
