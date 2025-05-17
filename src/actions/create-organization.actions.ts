"use server"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { Role } from "@prisma/client"
import { z } from "zod"
import { nanoid } from "nanoid"

// Schema de validação para criação de organização
const OrganizationSchema = z.object({
  name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres").max(100, "Nome deve ter no máximo 100 caracteres"),
})

// Função de log seguro
function logError(context: string, error: unknown, userId?: string | Promise<string | undefined>) {
  // Se userId for uma Promise, não tentamos acessá-lo no log imediato
  const userIdStr = userId && typeof userId === 'string' ? `(User: ${userId.slice(0, 8)}...)` : '';
  console.error(
    `[${context}] Erro: ${error instanceof Error ? error.message : "Erro desconhecido"} ${userIdStr}`
  );
}

// Função segura para extrair e validar nome
function extractName(formData: FormData): string {
  const result = OrganizationSchema.safeParse({
    name: formData.get("name"),
  })

  if (!result.success) {
    throw new Error(result.error.errors[0].message)
  }
  
  return result.data.name
}

// Função para gerar slug único com proteção contra caracteres inválidos
async function generateUniqueSlug(name: string): Promise<string> {
  // Aplicar regras de sanitização mais rigorosas
  const baseSlug = name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-") // Espaços para hífens
    .replace(/[^a-z0-9-]/g, "") // Remover caracteres especiais
    .replace(/-+/g, "-") // Remover hífens duplicados
    .replace(/^-|-$/g, "") // Remover hífens no início e fim
  
  // Se o slug estiver vazio após sanitização, usar um fallback
  const slugBase = baseSlug || `org-${nanoid(6)}`
  
  // Adicionar sufixo único para garantir unicidade
  const uniqueSuffix = nanoid(8).toLowerCase()
  let uniqueId = `${slugBase}-${uniqueSuffix}`
  
  // Truncar para manter tamanho razoável
  if (uniqueId.length > 50) {
    uniqueId = `${slugBase.slice(0, 40)}-${uniqueSuffix}`
  }
  
  return uniqueId
}

// Função para criar organização com transação
async function createOrganizationWithOwner(userId: string, name: string, uniqueId: string) {
  return prisma.$transaction(async (tx) => {
    // Verificar novamente se o ID já existe (proteção contra race conditions)
    const exists = await tx.organization.findUnique({
      where: { uniqueId },
      select: { id: true }
    })
    
    if (exists) {
      throw new Error("Este identificador já está em uso. Tente novamente.")
    }
    
    // Criar a organização e associação em uma transação
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

    // Extrair e validar nome
    const name = extractName(formData)
    
    // Gerar slug único
    const uniqueId = await generateUniqueSlug(name)
    
    // Criar organização com transação
    const organization = await createOrganizationWithOwner(userId, name, uniqueId)

    // Limpar cache
    revalidatePath("/organizations")
    
    // Redirecionar para a nova organização
    redirect(`/${organization.uniqueId}`)
  } catch (error) {
    // Logar erro sem expor detalhes sensíveis
    const userId = await auth().then(s => s?.user?.id).catch(() => undefined);
    logError("CreateOrganization", error, userId);
    
    // Em produção, você poderia redirecionar para uma página de erro
    // Por enquanto, propagamos o erro para ser mostrado na UI
    throw error
  }
}
