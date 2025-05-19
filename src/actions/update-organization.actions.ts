"use server"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { z } from "zod"
import { unstable_cache } from "next/cache"

const UpdateOrganizationSchema = z.object({
  name: z.string().min(2).max(100),
  uniqueOrgId: z.string().min(1),
})

interface UpdateOrganizationResult {
  success: boolean
  error?: string
}

function logError(context: string, error: unknown, userId?: string | Promise<string | undefined>) {
  const userIdStr = userId && typeof userId === 'string' ? `(User: ${userId.slice(0, 8)}...)` : ''
  console.error(
    `[${context}] Erro: ${error instanceof Error ? error.message : "Erro desconhecido"} ${userIdStr}`
  )
}

const checkOrganizationAccess = unstable_cache(
  async (uniqueOrgId: string, userId: string) => {
    const organization = await prisma.organization.findFirst({
      where: {
        uniqueId: uniqueOrgId,
        User_Organization: {
          some: { 
            user_id: userId,
            role: {
              in: ["OWNER", "ADMIN"]
            }
          },
        },
      },
    })
    
    if (!organization) {
      throw new Error("Organização não encontrada ou você não tem permissão para editá-la.")
    }
    
    return organization
  },
  ["organization-access"],
  { revalidate: 60 }
)

export const updateOrganizationAction = async (
  formData: FormData
): Promise<UpdateOrganizationResult> => {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return { success: false, error: "Autenticação necessária" }
    }

    const validatedData = UpdateOrganizationSchema.safeParse({
      name: formData.get("name"),
      uniqueOrgId: formData.get("uniqueOrgId"),
    })

    if (!validatedData.success) {
      return { 
        success: false, 
        error: validatedData.error.errors[0].message 
      }
    }

    const { name, uniqueOrgId } = validatedData.data

    await prisma.$transaction(async (tx) => {
      const organization = await checkOrganizationAccess(uniqueOrgId, session.user.id)
      
      await tx.organization.update({
        where: { id: organization.id },
        data: { name },
      })
    })

    revalidatePath(`/${uniqueOrgId}`)
    revalidatePath("/", "layout")
    revalidatePath("/organizations", "layout")
    revalidatePath("/api/organizations")
    
    return { success: true }
  } catch (error) {
    const userId = await auth().then(s => s?.user?.id).catch(() => undefined)
    logError("UpdateOrganization", error, userId)
    
    return { 
      success: false, 
      error: error instanceof Error ? error.message : "Erro ao atualizar organização" 
    }
  }
}
