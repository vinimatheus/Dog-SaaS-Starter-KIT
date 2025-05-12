"use client";

import { signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";

interface SignOutButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
	callbackUrl?: string;
}

export function SignOutButton({
	children,
	callbackUrl,
	className,
	...props
}: SignOutButtonProps) {

	const handleSignOut = async () => {
		await signOut({
			callbackUrl: callbackUrl || "/",
		});
	};

	return (
		<Button
			onClick={handleSignOut}
			className={className}
			{...props}
		>
			{children}
		</Button>
	);
} 