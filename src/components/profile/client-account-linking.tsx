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
		{
			id: "github",
			name: "GitHub",
			icon: "github",
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
					Gerencie as contas vinculadas ao seu perfil
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
												: "Conta não vinculada"}
										</p>
									</div>
								</div>
								<Button
									variant={isLinked ? "outline" : "default"}
									onClick={() => handleLinkAccount(provider.id)}
								>
									{isLinked ? "Desvincular" : "Vincular"}
								</Button>
							</div>
						);
					})}
				</div>
			</CardContent>
		</Card>
	);
} 