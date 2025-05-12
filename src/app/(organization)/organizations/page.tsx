import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Users, Plus } from "lucide-react";
import { Organization, Invite, User_Organization, User } from "@prisma/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { CreateOrganizationForm } from "@/components/organization/create-organization-form";

type OrganizationWithMembers = Organization & {
  User_Organization: (User_Organization & {
    user: User;
  })[];
  _count: {
    User_Organization: number;
  };
};

type InviteWithOrg = Invite & {
  organization: Organization;
};

export default async function OrganizationsPage() {
  const session = await auth();

  if (!session?.user?.id || !session.user.email) {
    redirect("/auth/signin");
  }

  // Busca organizações e convites em paralelo
  const [organizations, pendingInvites] = await Promise.all([
    // Busca organizações do usuário
    prisma.organization.findMany({
      where: {
        User_Organization: {
          some: {
            user_id: session.user.id,
          },
        },
      },
      include: {
        User_Organization: {
          include: {
            user: true,
          },
        },
        _count: {
          select: {
            User_Organization: true,
          },
        },
      },
    }) as Promise<OrganizationWithMembers[]>,
    // Busca convites pendentes
    prisma.invite.findMany({
      where: {
        email: session.user.email,
        status: "PENDING",
        expires_at: {
          gt: new Date(),
        },
      },
      include: {
        organization: true,
      },
    }) as Promise<InviteWithOrg[]>,
  ]);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto py-8 px-4">
        <div className="max-w-4xl mx-auto space-y-8">
          {/* Header */}
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold">Organizações</h1>
              <p className="text-gray-600 mt-1">
                Gerencie suas organizações e convites
              </p>
            </div>
            <div>
              <Dialog>
                <DialogTrigger asChild>
                  <Button className="gap-2">
                    <Plus className="h-4 w-4" />
                    Nova Organização
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Criar Nova Organização</DialogTitle>
                    <DialogDescription>
                      Crie uma nova organização para gerenciar seus projetos e equipes.
                    </DialogDescription>
                  </DialogHeader>
                  <CreateOrganizationForm />
                </DialogContent>
              </Dialog>
            </div>
          </div>

          {/* Convites Pendentes */}
          {pendingInvites.length > 0 && (
            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="flex items-center gap-2 mb-4">
                <Users className="h-5 w-5 text-primary" />
                <h2 className="text-xl font-semibold">Convites Pendentes</h2>
              </div>
              <div className="space-y-4">
                {pendingInvites.map((invite) => (
                  <div
                    key={invite.id}
                    className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
                  >
                    <div>
                      <h3 className="font-medium">
                        {invite.organization.name}
                      </h3>
                      <p className="text-sm text-gray-600">
                        Convite para {invite.email}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        Expira em{" "}
                        {new Date(invite.expires_at).toLocaleDateString("pt-BR")}
                      </p>
                    </div>
                    <Button
                      asChild
                      variant="outline"
                      className="ml-4"
                    >
                      <a href={`/invite?token=${invite.id}`}>
                        Ver Convite
                      </a>
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Lista de Organizações */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center gap-2 mb-4">
              <Users className="h-5 w-5 text-primary" />
              <h2 className="text-xl font-semibold">Suas Organizações</h2>
            </div>
            {organizations.length > 0 ? (
              <div className="grid gap-4 md:grid-cols-2">
                {organizations.map((org) => (
                  <div
                    key={org.id}
                    className="p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-medium">{org.name}</h3>
                        <p className="text-sm text-gray-600">
                          {org._count.User_Organization} membros
                        </p>
                      </div>
                      <Button
                        asChild
                        variant="ghost"
                        size="sm"
                      >
                        <a href={`/${org.uniqueId}`}>
                          Acessar
                        </a>
                      </Button>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {org.User_Organization.map((member) => (
                        <div
                          key={`${member.user_id}-${member.organization_id}`}
                          className="flex items-center gap-2 text-sm text-gray-600"
                        >
                          <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center">
                            {member.user.name?.[0]?.toUpperCase() || "?"}
                          </div>
                          <span>{member.user.name || member.user.email}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-gray-500 mb-4">
                  Você ainda não participa de nenhuma organização
                </p>
                <div>
                <CreateOrganizationForm />

                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
