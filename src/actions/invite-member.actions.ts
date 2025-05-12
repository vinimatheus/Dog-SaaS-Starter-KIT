"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Resend } from "resend";
import { revalidatePath } from "next/cache";
import { addDays } from "date-fns";
import { Role, InviteStatus } from "@prisma/client";

const resend = new Resend(process.env.RESEND_API_KEY);

interface InviteResult {
  success: boolean;
  error?: string;
  inviteId?: string;
  }

interface ManageInviteResult {
  success: boolean;
  error?: string;
  status?: InviteStatus;
}

async function sendInviteEmail(invite: { id: string; email: string }, organization: { name: string }) {
  try {
    await resend.emails.send({
      from: process.env.EMAIL_FROM!,
      to: invite.email,
      subject: `Convite para ${organization.name}`,
      html: `
        <h1>Você foi convidado para ${organization.name}</h1>
        <p>Clique no link abaixo para aceitar o convite:</p>
        <a href="${process.env.NEXT_PUBLIC_APP_URL}/invite?token=${invite.id}">
          Aceitar convite
        </a>
        <p>Este convite expira em 7 dias.</p>
      `,
    });
    return true;
  } catch (error) {
    console.error("Erro ao enviar email:", error);
    return false;
  }
}

async function checkInvitePermissions(userId: string, organizationId: string) {
  const userOrg = await prisma.user_Organization.findFirst({
    where: {
      user_id: userId,
      organization_id: organizationId,
      role: {
        in: ["OWNER", "ADMIN"],
      },
    },
    include: {
      organization: true,
    },
  });

  if (!userOrg) {
    throw new Error("Você não tem permissão para gerenciar convites");
  }

  return userOrg;
}

export async function resendInviteAction(inviteId: string): Promise<ManageInviteResult> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return {
        success: false,
        error: "Você precisa estar logado para reenviar convites",
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

    // Verifica permissões
    await checkInvitePermissions(session.user.id, invite.organization_id);

    // Verifica status do convite
    if (invite.status !== "PENDING") {
      return {
        success: false,
        error: `Este convite não pode ser reenviado pois está ${invite.status === "ACCEPTED" ? "aceito" : invite.status === "REJECTED" ? "rejeitado" : "expirado"}`,
        status: invite.status,
      };
    }

    // Verifica se o convite expirou
    if (invite.expires_at < new Date()) {
      await prisma.invite.update({
        where: { id: inviteId },
        data: { status: "EXPIRED" },
      });
      return {
        success: false,
        error: "Este convite expirou e não pode ser reenviado",
        status: "EXPIRED",
      };
    }

    // Reenvia o email
    const emailSent = await sendInviteEmail(invite, invite.organization);
    if (!emailSent) {
      return {
        success: false,
        error: "Erro ao reenviar o email do convite",
      };
    }

    // Atualiza a data de expiração
    await prisma.invite.update({
      where: { id: inviteId },
      data: {
        expires_at: addDays(new Date(), 7),
        updated_at: new Date(),
      },
    });

    revalidatePath(`/${invite.organization.uniqueId}`);
    return {
      success: true,
      status: "PENDING",
    };
  } catch (error) {
    console.error("Erro ao reenviar convite:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Erro ao reenviar convite",
    };
  }
}

export async function deleteInviteAction(inviteId: string): Promise<ManageInviteResult> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return {
        success: false,
        error: "Você precisa estar logado para excluir convites",
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

    // Verifica permissões
    await checkInvitePermissions(session.user.id, invite.organization_id);

    // Verifica se o convite já foi aceito
    if (invite.status === "ACCEPTED") {
      return {
        success: false,
        error: "Não é possível excluir um convite que já foi aceito",
        status: invite.status,
      };
    }

    // Exclui o convite
    await prisma.invite.delete({
      where: { id: inviteId },
    });

    revalidatePath(`/${invite.organization.uniqueId}`);
    return {
      success: true,
    };
  } catch (error) {
    console.error("Erro ao excluir convite:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Erro ao excluir convite",
    };
  }
}

export async function inviteMemberAction(formData: FormData): Promise<InviteResult> {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return {
        success: false,
        error: "Você precisa estar logado para convidar membros",
      };
    }

    const email = formData.get("email") as string;
    const organizationId = formData.get("organizationId") as string;
    const role = (formData.get("role") as Role) || "USER";

    if (!email || !organizationId) {
      return {
        success: false,
        error: "Email e organização são obrigatórios",
      };
    }

    // Validações em paralelo
    const [organization, userOrg, existingInvite, existingMember] = await Promise.all([
      // Busca a organização
      prisma.organization.findUnique({
        where: { id: organizationId },
      }),
      // Verifica permissões
      prisma.user_Organization.findFirst({
        where: {
          user_id: session.user.id,
          organization_id: organizationId,
          role: {
            in: ["OWNER", "ADMIN"],
          },
        },
      }),
      // Verifica convite pendente
      prisma.invite.findFirst({
        where: {
          AND: [
            { email },
            { organization_id: organizationId },
            { status: "PENDING" },
          ],
        },
      }),
      // Verifica membro existente
      prisma.user_Organization.findFirst({
        where: {
          organization_id: organizationId,
          user: {
            email,
          },
        },
      }),
    ]);

    // Validações sequenciais
    if (!organization) {
      return {
        success: false,
        error: "Organização não encontrada",
      };
    }

    if (!userOrg) {
      return {
        success: false,
        error: "Você não tem permissão para convidar membros",
      };
    }

    if (existingInvite) {
      return {
        success: false,
        error: "Já existe um convite pendente para este email",
      };
    }

    if (existingMember) {
      return {
        success: false,
        error: "Este usuário já é membro da organização",
      };
    }

    // Cria o convite
    const invite = await prisma.invite.create({
      data: {
        email,
        organization_id: organizationId,
        invited_by_id: session.user.id,
        role,
        expires_at: addDays(new Date(), 7), // Convite expira em 7 dias
      },
    });

    // Envia o email de convite em paralelo com a revalidação
    const emailSent = await sendInviteEmail(invite, organization);
    if (!emailSent) {
      // Se falhar ao enviar o email, marca o convite como expirado
      await prisma.invite.update({
        where: { id: invite.id },
        data: { status: "EXPIRED" },
      });
      return {
        success: false,
        error: "Erro ao enviar o email do convite",
      };
    }

    await revalidatePath(`/${organization.uniqueId}`);
    return {
      success: true,
      inviteId: invite.id,
    };
  } catch (error) {
    console.error("Erro ao processar convite:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Erro ao processar convite",
    };
  }
} 