"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { Role } from "@prisma/client";

interface ManageMemberResult {
  success: boolean;
  error?: string;
}

async function checkOwnerPermissions(userId: string, organizationId: string) {
  const userOrg = await prisma.user_Organization.findFirst({
    where: {
      user_id: userId,
      organization_id: organizationId,
      role: "OWNER",
    },
  });

  if (!userOrg) {
    throw new Error("Apenas o proprietário pode realizar esta ação");
  }

  return userOrg;
}

async function checkAdminPermissions(userId: string, organizationId: string) {
  const userOrg = await prisma.user_Organization.findFirst({
    where: {
      user_id: userId,
      organization_id: organizationId,
      role: {
        in: ["OWNER", "ADMIN"],
      },
    },
  });

  if (!userOrg) {
    throw new Error("Você não tem permissão para realizar esta ação");
  }

  return userOrg;
}

export async function updateMemberRoleAction(
  organizationId: string,
  targetUserId: string,
  newRole: Role
): Promise<ManageMemberResult> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return {
        success: false,
        error: "Você precisa estar logado para realizar esta ação",
      };
    }

    // Verifica se o usuário é o proprietário
    await checkOwnerPermissions(session.user.id, organizationId);

    // Verifica se o membro alvo existe
    const targetMember = await prisma.user_Organization.findFirst({
      where: {
        user_id: targetUserId,
        organization_id: organizationId,
      },
    });

    if (!targetMember) {
      return {
        success: false,
        error: "Membro não encontrado na organização",
      };
    }

    // Não permite alterar o role do proprietário
    if (targetMember.role === "OWNER") {
      return {
        success: false,
        error: "Não é possível alterar o role do proprietário",
      };
    }

    // Atualiza o role
    await prisma.user_Organization.update({
      where: {
        user_id_organization_id: {
          user_id: targetUserId,
          organization_id: organizationId,
        },
      },
      data: {
        role: newRole,
      },
    });

    const organization = await prisma.organization.findUnique({
      where: { id: organizationId },
    });

    revalidatePath(`/${organization?.uniqueId}`);
    return { success: true };
  } catch (error) {
    console.error("Erro ao atualizar role:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Erro ao atualizar role",
    };
  }
}

export async function removeMemberAction(
  organizationId: string,
  targetUserId: string
): Promise<ManageMemberResult> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return {
        success: false,
        error: "Você precisa estar logado para realizar esta ação",
      };
    }

    // Verifica se o usuário tem permissão (OWNER ou ADMIN)
    await checkAdminPermissions(session.user.id, organizationId);

    // Verifica se o membro alvo existe
    const targetMember = await prisma.user_Organization.findFirst({
      where: {
        user_id: targetUserId,
        organization_id: organizationId,
      },
    });

    if (!targetMember) {
      return {
        success: false,
        error: "Membro não encontrado na organização",
      };
    }

    // Não permite remover o proprietário
    if (targetMember.role === "OWNER") {
      return {
        success: false,
        error: "Não é possível remover o proprietário da organização",
      };
    }

    // Remove o membro
    await prisma.user_Organization.delete({
      where: {
        user_id_organization_id: {
          user_id: targetUserId,
          organization_id: organizationId,
        },
      },
    });

    const organization = await prisma.organization.findUnique({
      where: { id: organizationId },
    });

    revalidatePath(`/${organization?.uniqueId}`);
    return { success: true };
  } catch (error) {
    console.error("Erro ao remover membro:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Erro ao remover membro",
    };
  }
}

export async function transferOwnershipAction(
  organizationId: string,
  newOwnerId: string
): Promise<ManageMemberResult> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return {
        success: false,
        error: "Você precisa estar logado para realizar esta ação",
      };
    }

    // Verifica se o usuário é o proprietário atual
    await checkOwnerPermissions(session.user.id, organizationId);

    // Verifica se o novo proprietário existe na organização
    const newOwner = await prisma.user_Organization.findFirst({
      where: {
        user_id: newOwnerId,
        organization_id: organizationId,
      },
    });

    if (!newOwner) {
      return {
        success: false,
        error: "Usuário não encontrado na organização",
      };
    }

    // Não permite transferir para si mesmo
    if (newOwnerId === session.user.id) {
      return {
        success: false,
        error: "Você já é o proprietário da organização",
      };
    }

    // Inicia uma transação para garantir a consistência dos dados
    await prisma.$transaction([
      // Atualiza o novo proprietário para OWNER
      prisma.user_Organization.update({
        where: {
          user_id_organization_id: {
            user_id: newOwnerId,
            organization_id: organizationId,
          },
        },
        data: {
          role: "OWNER",
        },
      }),
      // Atualiza o proprietário atual para ADMIN
      prisma.user_Organization.update({
        where: {
          user_id_organization_id: {
            user_id: session.user.id,
            organization_id: organizationId,
          },
        },
        data: {
          role: "ADMIN",
        },
      }),
      // Atualiza o owner_user_id na organização
      prisma.organization.update({
        where: {
          id: organizationId,
        },
        data: {
          owner_user_id: newOwnerId,
        },
      }),
    ]);

    const organization = await prisma.organization.findUnique({
      where: { id: organizationId },
    });

    revalidatePath(`/${organization?.uniqueId}`);
    return { success: true };
  } catch (error) {
    console.error("Erro ao transferir propriedade:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Erro ao transferir propriedade",
    };
  }
} 