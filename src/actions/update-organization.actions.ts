"use server"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { z } from "zod"
import { unstable_cache } from "next/cache"

// Schema de validação para atualização de organização
const UpdateOrganizationSchema = z.object({
  name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres").max(100, "Nome deve ter no máximo 100 caracteres"),
  uniqueOrgId: z.string().min(1, "ID da organização é obrigatório"),
})

interface UpdateOrganizationResult {
  success: boolean
  error?: string
}

// Função segura para log sem expor dados sensíveis
function logError(context: string, error: unknown, userId?: string | Promise<string | undefined>) {
  const userIdStr = userId && typeof userId === 'string' ? `(User: ${userId.slice(0, 8)}...)` : '';
  console.error(
    `[${context}] Erro: ${error instanceof Error ? error.message : "Erro desconhecido"} ${userIdStr}`
  )
  // Em produção, enviar para serviço de log estruturado
}

// Função memoizada para verificar acesso à organização
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
  { revalidate: 60 } // Cache por 1 minuto
)

export const updateOrganizationAction = async (
  formData: FormData
): Promise<UpdateOrganizationResult> => {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return { success: false, error: "Autenticação necessária" }
    }

    // Validar dados do formulário
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

    // Usar transação para garantir consistência
    await prisma.$transaction(async (tx) => {
      // Verificar acesso
      const organization = await checkOrganizationAccess(uniqueOrgId, session.user.id)
      
      // Atualizar informações da organização
      await tx.organization.update({
        where: { id: organization.id },
        data: { name },
      })
    })

    // Limpar cache após atualização
    revalidatePath(`/${uniqueOrgId}`)
    
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
