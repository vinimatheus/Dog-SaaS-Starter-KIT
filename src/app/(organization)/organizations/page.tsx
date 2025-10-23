import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Users,
  ArrowRight,
  Building2,
  Crown,
  Shield,
  User as UserIcon,
  Plus,
  Mail,
  Clock,
  Sparkles,
  ExternalLink,
} from "lucide-react";
import { Organization, User_Organization, User } from "@prisma/client";
import { PendingInvites } from "@/components/invite/pending-invites";
import { Logo } from "@/components/ui/logo";
import "./styles.css";

type OrganizationWithMembers = Pick<
  Organization,
  "id" | "name" | "uniqueId" | "plan"
> & {
  User_Organization: (User_Organization & {
    user: Pick<User, "id" | "name" | "email">;
  })[];
};

interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function OrganizationsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const session = await auth();

  if (!session?.user?.id || !session.user.email) {
    redirect("/login");
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { name: true },
  });

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
              },
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

  if (organizations.length === 0 && pendingInvites.length === 0) {
    redirect("/onboarding");
  }

  const showAccessDenied = params?.access_denied === "true";

  // Função para obter o ícone do papel do usuário
  const getRoleIcon = (role: string) => {
    switch (role) {
      case "OWNER":
        return <Crown className="h-4 w-4 text-yellow-500" />;
      case "ADMIN":
        return <Shield className="h-4 w-4 text-blue-500" />;
      default:
        return <UserIcon className="h-4 w-4 text-gray-500" />;
    }
  };

  // Função para obter o texto do papel
  const getRoleText = (role: string) => {
    switch (role) {
      case "OWNER":
        return "Proprietário";
      case "ADMIN":
        return "Administrador";
      default:
        return "Membro";
    }
  };

  // Função para obter as iniciais do nome
  const getInitials = (name: string | null) => {
    if (!name) return "?";
    return name
      .split(" ")
      .map((word) => word[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-800">
      {/* Background Pattern */}
      <div className="absolute inset-0 bg-grid-slate-100 [mask-image:linear-gradient(0deg,white,rgba(255,255,255,0.6))] dark:bg-grid-slate-700/25 dark:[mask-image:linear-gradient(0deg,rgba(255,255,255,0.1),rgba(255,255,255,0.5))]" />

      <div className="relative">
        <div className="container mx-auto py-8 px-4 sm:py-12">
          <div className="max-w-6xl mx-auto space-y-8">
            {/* Header Section */}
            <div className="text-center space-y-6">
              <div className="flex justify-center mb-6">
                <div className="relative animate-float">
                  <Logo size="lg" />
                  <div className="absolute -top-2 -right-2">
                    <div className="relative">
                      <Sparkles className="h-6 w-6 text-yellow-500 animate-pulse" />
                      <div className="absolute inset-0 animate-ping">
                        <Sparkles className="h-6 w-6 text-yellow-400/50" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold bg-gradient-to-r from-slate-900 via-blue-800 to-indigo-800 dark:from-slate-100 dark:via-blue-200 dark:to-indigo-200 bg-clip-text text-transparent animate-gradient">
                  Bem-vindo de volta!
                </h1>
                <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
                  Selecione uma organização para acessar seu workspace ou aceite
                  convites pendentes
                </p>

                {/* Status indicator */}
                <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                  <span>Sistema operacional</span>
                </div>
              </div>
            </div>

            {/* Access Denied Alert */}
            {showAccessDenied && (
              <Card className="border-destructive/50 bg-destructive/5">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3 text-destructive">
                    <Shield className="h-5 w-5" />
                    <p className="font-medium">
                      Acesso negado. Você não tem permissão para acessar esta
                      organização. Entre em contato com o administrador.
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Pending Invites Section */}
            {pendingInvites.length > 0 && (
              <Card className="border-amber-200 bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-950/20 dark:to-yellow-950/20">
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Mail className="h-5 w-5 text-amber-600" />
                    <CardTitle className="text-amber-800 dark:text-amber-200">
                      Convites Pendentes
                    </CardTitle>
                    <Badge
                      variant="secondary"
                      className="bg-amber-100 text-amber-800"
                    >
                      {pendingInvites.length}
                    </Badge>
                  </div>
                  <CardDescription className="text-amber-700 dark:text-amber-300">
                    Você tem convites aguardando sua resposta
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <PendingInvites />
                </CardContent>
              </Card>
            )}

            {/* Organizations Section */}
            <div className="space-y-6">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Building2 className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-semibold">
                      Suas Organizações
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      Gerencie e acesse suas organizações
                    </p>
                  </div>
                  <Badge
                    variant="outline"
                    className="text-sm bg-primary/5 border-primary/20"
                  >
                    {organizations.length}
                  </Badge>
                </div>

                <Button asChild size="sm" className="gap-2">
                  <a href="/onboarding">
                    <Plus className="h-4 w-4" />
                    <span className="hidden sm:inline">Nova Organização</span>
                    <span className="sm:hidden">Nova</span>
                  </a>
                </Button>
              </div>

              {organizations.length > 0 ? (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {organizations.map((org) => {
                    const userRole =
                      org.User_Organization.find(
                        (member) => member.user_id === session.user.id
                      )?.role || "USER";

                    return (
                      <Card
                        key={org.id}
                        className="group hover:shadow-lg transition-all duration-300 hover:-translate-y-1 cursor-pointer bg-white dark:bg-slate-900 border border-border/50 hover:border-primary/20 relative overflow-hidden"
                      >
                        <a href={`/${org.uniqueId}`} className="block p-4">
                          <div className="space-y-3">
                            {/* Header com nome e badge */}
                            <div className="flex items-start justify-between">
                              <div className="flex items-center gap-3 min-w-0 flex-1">
                                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center text-white font-semibold text-sm flex-shrink-0">
                                  {getInitials(org.name)}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <h3 className="font-semibold text-sm group-hover:text-primary transition-colors truncate">
                                    {org.name}
                                  </h3>
                                  <div className="flex items-center gap-1">
                                    {getRoleIcon(userRole)}
                                    <span className="text-xs text-muted-foreground">
                                      {getRoleText(userRole)}
                                    </span>
                                  </div>
                                </div>
                              </div>
                              <div className="flex flex-col items-end gap-1 flex-shrink-0">
                                <Badge
                                  variant={
                                    org.plan === "PRO" ? "default" : "secondary"
                                  }
                                  className="text-xs h-5"
                                >
                                  {org.plan}
                                </Badge>
                                <ArrowRight className="h-3 w-3 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
                              </div>
                            </div>

                            {/* Membros */}
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <Users className="h-3 w-3 text-muted-foreground" />
                                <span className="text-xs text-muted-foreground">
                                  {org.User_Organization.length}{" "}
                                  {org.User_Organization.length === 1
                                    ? "membro"
                                    : "membros"}
                                </span>
                              </div>

                              {/* Avatars dos membros */}
                              <div className="flex -space-x-1">
                                {org.User_Organization.slice(0, 3).map(
                                  (member) => (
                                    <Avatar
                                      key={`${member.user_id}-${member.organization_id}`}
                                      className="w-6 h-6 border border-background"
                                    >
                                      <AvatarFallback className="text-xs bg-gradient-to-br from-blue-500 to-purple-500 text-white">
                                        {getInitials(member.user.name)}
                                      </AvatarFallback>
                                    </Avatar>
                                  )
                                )}
                                {org.User_Organization.length > 3 && (
                                  <div className="w-6 h-6 rounded-full bg-muted border border-background flex items-center justify-center">
                                    <span className="text-xs text-muted-foreground font-medium">
                                      +{org.User_Organization.length - 3}
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </a>
                      </Card>
                    );
                  })}
                </div>
              ) : (
                <Card className="border-dashed border-2 border-muted-foreground/20 hover:border-primary/30 transition-colors bg-white dark:bg-slate-900">
                  <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                    <div className="relative mb-4">
                      <Building2 className="h-12 w-12 text-muted-foreground/30" />
                      <div className="absolute -top-1 -right-1">
                        <Plus className="h-4 w-4 text-primary" />
                      </div>
                    </div>
                    <h3 className="text-lg font-semibold mb-2 text-foreground">
                      Comece sua jornada
                    </h3>
                    <p className="text-muted-foreground mb-6 max-w-sm leading-relaxed text-sm">
                      Você ainda não participa de nenhuma organização. Crie sua
                      primeira organização para começar a colaborar com sua
                      equipe.
                    </p>
                    <div className="flex flex-col sm:flex-row gap-3">
                      <Button asChild className="gap-2">
                        <a href="/onboarding">
                          <Plus className="h-4 w-4" />
                          Criar Primeira Organização
                        </a>
                      </Button>
                      <Button variant="outline" className="gap-2">
                        <ExternalLink className="h-4 w-4" />
                        Saiba Mais
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Footer */}
            <div className="text-center pt-8">
              <p className="text-sm text-muted-foreground">
                Precisa de ajuda?{" "}
                <a href="#" className="text-primary hover:underline">
                  Entre em contato
                </a>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
