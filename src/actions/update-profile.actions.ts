"use server"

import { auth, unstable_update } from "@/auth"
import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { z } from "zod"

const ProfileUpdateSchema = z.object({
  name: z.string()
    .min(2, "Nome deve ter pelo menos 2 caracteres")
    .max(100, "Nome deve ter no máximo 100 caracteres")
    .refine(value => value.trim().length >= 2, {
      message: "Nome não pode conter apenas espaços"
    })
})

interface UpdateProfileResult {
  success: boolean
  error?: string
  userId?: string
  updatedName?: string | null
}

function logError(context: string, error: unknown, userId?: string | Promise<string | undefined>) {
  const userIdStr = userId && typeof userId === 'string' ? `(User: ${userId.slice(0, 8)}...)` : ''
  console.error(
    `[${context}] Erro: ${error instanceof Error ? error.message : "Erro desconhecido"} ${userIdStr}`
  )
}

export async function updateProfileAction(formData: FormData): Promise<UpdateProfileResult> {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return { success: false, error: "Usuário não autenticado" }
    }

    const validationResult = ProfileUpdateSchema.safeParse({
      name: formData.get("name"),
    })

    if (!validationResult.success) {
      return { 
        success: false, 
        error: validationResult.error.errors[0].message
      }
    }

    const { name } = validationResult.data

    const updatedUser = await prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: { id: session.user.id },
        select: { id: true }
      })
      
      if (!user) {
        throw new Error("Usuário não encontrado")
      }
      
      return tx.user.update({
        where: { id: session.user.id },
        data: {
          name,
          sessionVersion: { increment: 1 },
        },
      })
    })

    try {
      await unstable_update({
        user: { name: updatedUser.name },
      })
    } catch (error) {
      logError("UpdateSession", error, session.user.id)
    }

    revalidatePath("/", "layout")
    revalidatePath("/organizations", "layout")
    revalidatePath("/complete-profile", "layout")

    return {
      success: true,
      userId: updatedUser.id,
      updatedName: updatedUser.name,
    }
  } catch (error) {
    logError("UpdateProfile", error, auth().then(s => s?.user?.id).catch(() => undefined))
    
    return {
      success: false,
      error: error instanceof Error ? error.message : "Erro ao atualizar perfil",
    }
  }
}
