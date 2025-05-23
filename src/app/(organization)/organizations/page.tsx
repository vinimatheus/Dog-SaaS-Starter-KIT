import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Users, ArrowRight } from "lucide-react";
import { Organization, User_Organization, User } from "@prisma/client";
import { PendingInvites } from "@/components/pending-invites";
import { Logo } from "@/components/logo";

type OrganizationWithMembers = Pick<Organization, 'id' | 'name' | 'uniqueId' | 'plan'> & {
  User_Organization: (User_Organization & {
    user: Pick<User, 'id' | 'name' | 'email'>;
  })[];
};

interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

export default async function OrganizationsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const session = await auth();

  if (!session?.user?.id || !session.user.email) {
    redirect("/login");
  }

  // Busca o usuário para verificar se tem nome
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { name: true }
  });

  // Se o usuário não tem nome, redireciona para onboarding
  if (!user?.name) {
    redirect("/onboarding");
  }

  const [organizations, pendingInvites] = await Promise.all([
    prisma.organization.findMany({
      where: {
        User_Organization: {
          some: {
            user_id: session.user.id,
          },
        },
      },
      select: {
        id: true,
        name: true,
        uniqueId: true,
        plan: true,
        User_Organization: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              }
            },
          },
        },
      },
    }) as Promise<OrganizationWithMembers[]>,

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
    }),
  ]);

  // Se não houver organizações e não houver convites pendentes, redireciona para onboarding
  if (organizations.length === 0 && pendingInvites.length === 0) {
    redirect("/onboarding");
  }

  const showAccessDenied = params?.access_denied === "true";

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      <div className="container mx-auto py-12 px-4">
        <div className="max-w-4xl mx-auto space-y-8">
          {/* Brand */}
          <div className="flex justify-center mb-8">
            <Logo size="lg" />
          </div>

          {/* Header */}
          <div className="text-center space-y-3">
            <h2 className="text-4xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
              Selecione uma Organização
            </h2>
            <p className="text-muted-foreground text-lg">
              Escolha uma organização para continuar
            </p>
          </div>

          {showAccessDenied && (
            <div className="bg-destructive/10 border border-destructive text-destructive rounded-lg px-4 py-3 text-center font-medium">
              Você não tem permissão para acessar esta organização. Fale com o administrador.
            </div>
          )}

          {/* Convites Pendentes */}
          {pendingInvites.length > 0 && (
            <div className="bg-card rounded-xl shadow-lg border border-border/50 p-6">
              <PendingInvites />
            </div>
          )}

          {/* Lista de Organizações */}
          <div className="bg-card rounded-xl shadow-lg border border-border/50 p-6">
            <div className="flex items-center gap-2 mb-6">
              <Users className="h-6 w-6 text-primary" />
              <h2 className="text-2xl font-semibold">Suas Organizações</h2>
            </div>
            {organizations.length > 0 ? (
              <div className="grid gap-4 md:grid-cols-2">
                {organizations.map((org) => (
                  <Button
                    key={org.id}
                    asChild
                    variant="outline"
                    className="h-auto p-6 justify-start hover:bg-accent/50 transition-colors group relative overflow-hidden"
                  >
                    <a href={`/${org.uniqueId}`}>
                      <div className="flex flex-col items-start gap-3">
                        <div className="flex items-center justify-between w-full">
                          <h3 className="font-semibold text-lg">{org.name}</h3>
                          <span className="text-sm text-muted-foreground">
                            {org.User_Organization.length} membros
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {org.User_Organization.slice(0, 3).map((member) => (
                            <div
                              key={`${member.user_id}-${member.organization_id}`}
                              className="flex items-center gap-2 text-sm text-muted-foreground"
                            >
                              <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center">
                                {member.user.name?.[0]?.toUpperCase() || "?"}
                              </div>
                              <span>
                                {member.user.name || member.user.email}
                              </span>
                            </div>
                          ))}
                          {org.User_Organization.length > 3 && (
                            <span className="text-sm text-muted-foreground">
                              +{org.User_Organization.length - 3} outros
                            </span>
                          )}
                        </div>
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <ArrowRight className="h-5 w-5 text-primary" />
                        </div>
                      </div>
                    </a>
                  </Button>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <p className="text-muted-foreground text-lg">
                  Você ainda não participa de nenhuma organização
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
