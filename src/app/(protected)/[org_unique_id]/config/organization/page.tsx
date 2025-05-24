import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import { OrganizationForm } from "@/components/organization/organization-form"
import { Metadata } from "next"
import { PageLayout } from "@/components/layout/page-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Building2 } from "lucide-react"

interface MetadataProps {
	params: Promise<{
		org_unique_id: string
	}>
}

export async function generateMetadata({ params }: MetadataProps): Promise<Metadata> {
	const { org_unique_id } = await params
	const organization = await prisma.organization.findUnique({
		where: { uniqueId: org_unique_id },
	})

	return {
		title: `Organização - ${organization?.name || org_unique_id}`,
		description: "Gerencie as configurações da sua organização",
	}
}

interface OrganizationPageProps {
	params: Promise<{
		org_unique_id: string
	}>
}

export default async function OrganizationPage({ 
	params 
}: OrganizationPageProps) {
	const [session, { org_unique_id }] = await Promise.all([
		auth(),
		params
	])
	
	if (!session?.user?.id) {
		redirect("/login")
	}

	const organization = await prisma.organization.findUnique({
		where: { uniqueId: org_unique_id },
		include: {
			User_Organization: {
				where: { user_id: session.user.id },
				select: {
					role: true,
				},
			},
		},
	})

	if (!organization) {
		redirect("/organizations")
	}

	const isOwner = organization.User_Organization[0]?.role === "OWNER"

	return (
		<PageLayout
			title="Configurações da Organização"
			description="Gerencie as configurações da sua organização"
		>
			<div className="grid gap-6">
				<Card>
					<CardHeader className="pb-3">
						<div className="flex items-center gap-3">
							<div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
								<Building2 className="h-8 w-8 text-muted-foreground" />
							</div>
							<div>
								<CardTitle>{organization.name}</CardTitle>
								<CardDescription>ID: {organization.uniqueId}</CardDescription>
							</div>
						</div>
					</CardHeader>
					<CardContent>
						{isOwner ? (
							<OrganizationForm 
								initialName={organization.name} 
								uniqueOrgId={organization.uniqueId} 
							/>
						) : (
							<div className="rounded-md border border-muted bg-muted/50 p-4">
								<p className="text-sm text-muted-foreground">
									Apenas o dono da organização pode gerenciar as configurações da organização.
								</p>
							</div>
						)}
					</CardContent>
				</Card>
			</div>
		</PageLayout>
	)
} 