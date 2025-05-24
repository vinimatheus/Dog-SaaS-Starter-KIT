import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import { OrganizationForm } from "@/components/organization/organization-form"
import { Metadata } from "next"
import { PageLayout } from "@/components/layout/page-layout"

interface MetadataProps {
  params: Promise<{
    org_unique_id: string
  }>
}

export async function generateMetadata({ params }: MetadataProps): Promise<Metadata> {
  const { org_unique_id } = await params

  return {
    title: `Configurações da Organização | ${org_unique_id}`,
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
    redirect("/")
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
        {isOwner ? (
          <OrganizationForm 
            initialName={organization.name} 
            uniqueOrgId={organization.uniqueId} 
          />
        ) : (
          <div className="bg-card rounded-md border border-muted p-4">
            <p className="text-sm text-muted-foreground">
              Apenas o dono da organização pode gerenciar as configurações da organização.
            </p>
          </div>
        )}
      </div>
    </PageLayout>
  )
} 