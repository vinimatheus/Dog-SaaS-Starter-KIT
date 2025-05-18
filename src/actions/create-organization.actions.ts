"use server"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { Role } from "@prisma/client"
import { z } from "zod"
import { nanoid } from "nanoid"

const OrganizationSchema = z.object({
  name: z.string().min(2).max(100),
})

function logError(context: string, error: unknown, userId?: string | Promise<string | undefined>) {
  const userIdStr = userId && typeof userId === 'string' ? `(User: ${userId.slice(0, 8)}...)` : ''
  console.error(
    `[${context}] Erro: ${error instanceof Error ? error.message : "Erro desconhecido"} ${userIdStr}`
  )
}

function extractName(formData: FormData): string {
  const result = OrganizationSchema.safeParse({
    name: formData.get("name"),
  })

  if (!result.success) {
    throw new Error(result.error.errors[0].message)
  }

  return result.data.name
}

async function generateUniqueSlug(name: string): Promise<string> {
  const baseSlug = name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")

  const slugBase = baseSlug || `org-${nanoid(6)}`

  const uniqueSuffix = nanoid(8).toLowerCase()
  let uniqueId = `${slugBase}-${uniqueSuffix}`

  if (uniqueId.length > 50) {
    uniqueId = `${slugBase.slice(0, 40)}-${uniqueSuffix}`
  }

  return uniqueId
}

async function createOrganizationWithOwner(userId: string, name: string, uniqueId: string) {
  return prisma.$transaction(async (tx) => {
    const exists = await tx.organization.findUnique({
      where: { uniqueId },
      select: { id: true }
    })

    if (exists) {
      throw new Error("Este identificador já está em uso. Tente novamente.")
    }

    return tx.organization.create({
      data: {
        name,
        uniqueId,
        owner_user_id: userId,
        User_Organization: {
          create: {
            user_id: userId,
            role: Role.OWNER,
          },
        },
      },
    })
  })
}

export async function createOrganizationAction(formData: FormData) {
  try {
    const session = await auth()
    const userId = session?.user?.id

    if (!userId) {
      redirect("/")
    }

    const name = extractName(formData)
    const uniqueId = await generateUniqueSlug(name)
    const organization = await createOrganizationWithOwner(userId, name, uniqueId)

    revalidatePath("/organizations")
    redirect(`/${organization.uniqueId}`)
  } catch (error) {
    const userId = await auth().then(s => s?.user?.id).catch(() => undefined)
    logError("CreateOrganization", error, userId)
    throw error
  }
}
