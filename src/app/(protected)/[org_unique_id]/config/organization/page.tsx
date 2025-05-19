import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import { OrganizationForm } from "./organization-form"
import { Metadata } from "next"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Building2 } from "lucide-react"
import { PageLayout } from "@/components/page-layout"

interface MetadataProps {
  params: Promise<{
    org_unique_id: string
  }>
}

export async function generateMetadata({
  params,
}: MetadataProps): Promise<Metadata> {
  const { org_unique_id } = await params
  const organization = await prisma.organization.findUnique({
    where: { uniqueId: org_unique_id },
  })

  return {
    title: `Configurações - ${organization?.name || org_unique_id}`,
  }
}

interface OrganizationPageProps {
  params: Promise<{
    org_unique_id: string
  }>
}

export default async function OrganizationPage({ 
  params,
}: OrganizationPageProps) {
  const [session, { org_unique_id }] = await Promise.all([
    auth(),
    params
  ])
  
  if (!session?.user?.id) {
    redirect("/login")
  }

  const organization = await prisma.organization.findFirst({
    where: {
      uniqueId: org_unique_id,
      User_Organization: {
        some: {
          user_id: session.user.id,
          role: {
            in: ["OWNER", "ADMIN"]
          }
        }
      }
    },
    select: {
      name: true,
      uniqueId: true
    }
  })

  if (!organization) {
    redirect("/organizations")
  }

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
                <CardDescription>Configurações gerais da organização</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <OrganizationForm 
              initialName={organization.name} 
              uniqueOrgId={organization.uniqueId} 
            />
          </CardContent>
        </Card>
      </div>
    </PageLayout>
  )
} 