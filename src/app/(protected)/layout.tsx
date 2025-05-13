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

	return (
		<div className="flex min-h-screen">
			{children}
		</div>
	);
}
