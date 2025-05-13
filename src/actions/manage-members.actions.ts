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

    
    await checkOwnerPermissions(session.user.id, organizationId);

    
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

    
    if (targetMember.role === "OWNER") {
      return {
        success: false,
        error: "Não é possível alterar o role do proprietário",
      };
    }

    
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

    
    await checkAdminPermissions(session.user.id, organizationId);

    
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

    
    if (targetMember.role === "OWNER") {
      return {
        success: false,
        error: "Não é possível remover o proprietário da organização",
      };
    }

    
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

    
    await checkOwnerPermissions(session.user.id, organizationId);

    
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

    
    if (newOwnerId === session.user.id) {
      return {
        success: false,
        error: "Você já é o proprietário da organização",
      };
    }

    
    await prisma.$transaction([
      
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