"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ProviderIcons } from "@/components/profile/provider-icons";
import { signIn } from "next-auth/react";

interface ClientAccountLinkingProps {
	linkedProviders: string[];
}

export default function ClientAccountLinking({
	linkedProviders,
}: ClientAccountLinkingProps) {
	const providers = [
		{
			id: "google",
			name: "Google",
			icon: "google",
		},
	];

	const handleLinkAccount = async (provider: string) => {
		await signIn(provider, {
			callbackUrl: window.location.href,
		});
	};

	return (
		<Card>
			<CardHeader>
				<CardTitle>Contas Vinculadas</CardTitle>
				<CardDescription>
					Vincule sua conta Google para facilitar o login
				</CardDescription>
			</CardHeader>
			<CardContent>
				<div className="space-y-4">
					{providers.map((provider) => {
						const isLinked = linkedProviders.includes(provider.id);

						return (
							<div
								key={provider.id}
								className="flex items-center justify-between"
							>
								<div className="flex items-center gap-2">
									<ProviderIcons provider={provider.icon} />
									<div>
										<p className="font-medium">{provider.name}</p>
										<p className="text-sm text-muted-foreground">
											{isLinked
												? "Conta vinculada"
												: "Clique para vincular sua conta"}
										</p>
									</div>
								</div>
								{!isLinked && (
									<Button
										variant="default"
										onClick={() => handleLinkAccount(provider.id)}
									>
										Vincular
									</Button>
								)}
							</div>
						);
					})}
				</div>
			</CardContent>
		</Card>
	);
} 