import { auth } from "@/auth";
import { ProfileForm } from "./profile-form";
import { Metadata } from "next";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { UserCircle } from "lucide-react";
import Image from "next/image";
import ClientAccountLinking from "./client-account-linking";

interface MetadataProps {
	params: Promise<{
		org_unique_id: string;
	}>;
}

export async function generateMetadata({
	params,
}: MetadataProps): Promise<Metadata> {
	const { org_unique_id } = await params;
	const organization = await prisma.organization.findUnique({
		where: { uniqueId: org_unique_id },
	});

	return {
		title: `Perfil - ${organization?.name || org_unique_id}`,
	};
}

interface ProfilePageProps {
	params: Promise<{
		org_unique_id: string;
	}>;
}

export default async function ProfilePage({ 
	params,
}: ProfilePageProps) {
	const [session, { org_unique_id }] = await Promise.all([
		auth(),
		params
	]);
	
	if (!session?.user?.id) {
		redirect("/login");
	}
	
	const [userOrg, user] = await Promise.all([
		prisma.user_Organization.findFirst({
			where: {
				user_id: session.user.id,
				organization: {
					uniqueId: org_unique_id
				}
			},
			include: {
				organization: true
			}
		}),
		prisma.user.findUnique({
			where: {
				id: session.user.id
			},
			select: {
				id: true,
				name: true,
				email: true,
				image: true,
				accounts: {
					select: {
						provider: true
					}
				}
			}
		})
	]);
	
	if (!userOrg) {
		redirect("/organizations");
	}
	
	if (!user) {
		redirect("/login");
	}

	// Obter a lista de provedores vinculados
	const linkedProviders = user.accounts.map(account => account.provider);

	return (
		<div className="space-y-6">
			<div>
				<h1 className="text-2xl font-bold tracking-tight">Meu Perfil</h1>
				<p className="text-muted-foreground">
					Gerencie suas informações pessoais
				</p>
			</div>
			
			<div className="grid gap-6">
				<Card>
					<CardHeader className="pb-3">
						<div className="flex items-center gap-3">
							{user.image ? (
								<Image 
									src={user.image} 
									alt={user.name || "Avatar"} 
									className="rounded-full object-cover"
									width={48}
									height={48}
								/>
							) : (
								<div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
									<UserCircle className="h-8 w-8 text-muted-foreground" />
								</div>
							)}
							<div>
								<CardTitle>{user.name || "Usuário"}</CardTitle>
								<CardDescription>{user.email}</CardDescription>
							</div>
						</div>
					</CardHeader>
					<CardContent>
						<ProfileForm 
							user={user} 
							orgUniqueId={org_unique_id} 
						/>
					</CardContent>
				</Card>

				{/* Componente de vinculação de contas */}
				<ClientAccountLinking 
					userEmail={user.email || ''}
					linkedProviders={linkedProviders}
				/>
			</div>
		</div>
	);
} 