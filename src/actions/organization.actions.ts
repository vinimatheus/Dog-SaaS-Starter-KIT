import { prisma } from "@/lib/prisma"
import { auth } from "@/auth"
import { redirect } from "next/navigation"

export async function getOrganizationByUniqueId(uniqueId: string) {
  const session = await auth()
  const userId = session?.user?.id

  if (!userId) {
    redirect("/auth/login")
  }

  const organization = await prisma.organization.findUnique({
    where: { uniqueId },
    include: {
      User_Organization: {
        include: {
          user: true,
        },
      },
      invites: {
        include: {
          invited_by: true,
        },
        orderBy: {
          created_at: "desc",
        },
      },
    },
  })

  if (!organization) {
    redirect("/")
  }

  const userOrg = organization.User_Organization.find(
    (uo) => uo.user_id === userId
  )

  if (!userOrg) {
    redirect("/")
  }

  const { User_Organization, ...orgWithoutMembers } = organization

  return {
    ...orgWithoutMembers,
    members: User_Organization,
    invites: organization.invites,
  }
} 