"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ProtectedHeader } from "@/components/protected-header";

export function Header() {
	const router = useRouter();

	return (
		<header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
			<div className="container flex h-14 items-center">
				<div className="mr-4 flex">
					<ProtectedHeader  />
				</div>
				<div className="flex flex-1 items-center justify-between space-x-2 md:justify-end">
					<nav className="flex items-center space-x-2">
						<Button
							variant="ghost"
							onClick={() => router.push("/settings")}
						>
							Configurações
						</Button>
						<Button
							variant="ghost"
							onClick={() => router.push("/logout")}
						>
							Sair
						</Button>
					</nav>
				</div>
			</div>
		</header>
	);
} 