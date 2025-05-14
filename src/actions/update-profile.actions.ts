"use server";

import { auth, unstable_update } from "@/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

interface UpdateProfileResult {
  success: boolean;
  error?: string;
  userId?: string;
  updatedName?: string | null;
}

export async function updateProfileAction(formData: FormData): Promise<UpdateProfileResult> {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return {
        success: false,
        error: "Usuário não autenticado"
      };
    }

    const name = formData.get("name") as string;

    if (!name || name.trim().length < 2) {
      return {
        success: false,
        error: "Nome deve ter pelo menos 2 caracteres"
      };
    }

    console.log("Atualizando perfil para usuário:", {
      userId: session.user.id,
      currentName: session.user.name,
      newName: name.trim()
    });

    const updatedUser = await prisma.user.update({
      where: {
        id: session.user.id
      },
      data: {
        name: name.trim(),
        sessionVersion: { increment: 1 } 
      }
    });

    console.log("Usuário atualizado com sucesso:", {
      id: updatedUser.id,
      name: updatedUser.name,
      sessionVersion: updatedUser.sessionVersion
    });

    try {
      await unstable_update({
        user: {
          name: updatedUser.name
        }
      });
      console.log("Sessão atualizada via unstable_update");
    } catch (updateError) {
      console.error("Erro ao atualizar sessão:", updateError);
    }

    revalidatePath("/", "layout");
    revalidatePath("/organizations", "layout");
    revalidatePath("/complete-profile", "layout");

    return {
      success: true,
      userId: updatedUser.id,
      updatedName: updatedUser.name
    };
  } catch (error) {
    console.error("Erro ao atualizar perfil:", error);
    
    return {
      success: false,
      error: error instanceof Error ? error.message : "Erro ao atualizar perfil"
    };
  }
} 