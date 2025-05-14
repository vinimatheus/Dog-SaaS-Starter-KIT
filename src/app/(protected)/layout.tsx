import { auth } from "@/auth";
import { redirect } from "next/navigation";

interface ProtectedLayoutProps {
	children: React.ReactNode;
}

export default async function ProtectedLayout({
	children,
}: ProtectedLayoutProps) {
	const session = await auth();

	if (!session?.user?.id) {
		redirect("/");
	}

	console.log("User session:", {
		id: session.user.id,
		name: session.user.name,
		email: session.user.email
	});

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
