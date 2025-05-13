"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

interface AcceptInviteResult {
  success: boolean;
  error?: string;
  redirectUrl?: string;
}

export async function acceptInviteAction(inviteId: string): Promise<AcceptInviteResult> {
  try {
  const session = await auth();
  if (!session?.user?.id) {
      return {
        success: false,
        error: "Você precisa estar logado para aceitar convites",
      };
  }

  const invite = await prisma.invite.findUnique({
    where: { id: inviteId },
    include: {
      organization: true,
    },
  });

  if (!invite) {
      return {
        success: false,
        error: "Convite não encontrado",
      };
  }

  if (invite.status !== "PENDING") {
      return {
        success: false,
        error: `Este convite já foi ${
          invite.status === "ACCEPTED"
            ? "aceito"
            : invite.status === "REJECTED"
            ? "rejeitado"
            : "expirado"
        }`,
      };
  }

  if (invite.expires_at < new Date()) {
      await prisma.invite.delete({
      where: { id: inviteId },
    });
      return {
        success: false,
        error: "Este convite expirou",
      };
  }

  if (invite.email !== session.user.email) {
      return {
        success: false,
        error: "Este convite foi enviado para outro email",
      };
  }

    
    const existingMembership = await prisma.user_Organization.findFirst({
      where: {
        user_id: session.user.id,
        organization_id: invite.organization_id,
      },
    });

    if (existingMembership) {
      
      await prisma.invite.delete({
        where: { id: inviteId },
      });
      return {
        success: false,
        error: "Você já é membro desta organização",
      };
    }

    
    await prisma.$transaction([
      
      prisma.invite.delete({
        where: { id: inviteId },
      }),
      prisma.user_Organization.create({
        data: {
          user_id: session.user.id,
          organization_id: invite.organization_id,
          role: invite.role,
        },
      }),
    ]);

    revalidatePath(`/${invite.organization.uniqueId}`);
    return {
      success: true,
      redirectUrl: `/${invite.organization.uniqueId}`,
    };
  } catch (error) {
    console.error("Erro ao aceitar convite:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Erro ao aceitar convite",
    };
  }
} 