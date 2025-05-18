"use client";

import { useEffect, useState, useTransition } from "react";
import { getPendingInvitesForUserAction } from "@/actions/invite-member.actions";
import { acceptInviteAction, rejectInviteAction } from "@/actions/accept-invite.actions";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface PendingInvite {
  id: string;
  email: string;
  organization: {
    id: string;
    name: string;
    uniqueId: string;
  };
  invited_by: {
    id: string;
    name: string | null;
    email: string | null;
    image: string | null;
  };
  role: string;
  expires_at: Date;
  created_at: Date;
}

interface PendingInvitesProps {
  onInviteProcessed?: () => void;
}

export function PendingInvites({ onInviteProcessed }: PendingInvitesProps) {
  const [invites, setInvites] = useState<PendingInvite[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [processingInviteId, setProcessingInviteId] = useState<string | null>(null);
  const router = useRouter();

  const fetchInvites = async () => {
    setIsLoading(true);
    try {
      const result = await getPendingInvitesForUserAction();
      if (result.success) {
        setInvites(result.invites);
      } else {
        console.error("Erro ao buscar convites:", result.error);
      }
    } catch (error) {
      console.error("Erro ao buscar convites:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchInvites();
  }, []);

  const handleAcceptInvite = (inviteId: string) => {
    setProcessingInviteId(inviteId);
    startTransition(async () => {
      try {
        const result = await acceptInviteAction(inviteId);
        if (result.success) {
          toast.success("Convite aceito com sucesso!");
          if (result.redirectUrl) {
            router.push(result.redirectUrl);
          } else {
            fetchInvites();
            if (onInviteProcessed) {
              onInviteProcessed();
            }
          }
        } else {
          toast.error(result.error || "Erro ao aceitar convite");
          fetchInvites();
          if (onInviteProcessed) {
            onInviteProcessed();
          }
        }
      } catch (error) {
        toast.error("Erro ao processar convite");
        console.error(error);
        fetchInvites();
        if (onInviteProcessed) {
          onInviteProcessed();
        }
      } finally {
        setProcessingInviteId(null);
      }
    });
  };

  const handleRejectInvite = (inviteId: string) => {
    setProcessingInviteId(inviteId);
    startTransition(async () => {
      try {
        const result = await rejectInviteAction(inviteId);
        if (result.success) {
          toast.success("Convite rejeitado com sucesso");
          fetchInvites();
          if (onInviteProcessed) {
            onInviteProcessed();
          }
        } else {
          toast.error(result.error || "Erro ao rejeitar convite");
          fetchInvites();
          if (onInviteProcessed) {
            onInviteProcessed();
          }
        }
      } catch (error) {
        toast.error("Erro ao processar convite");
        console.error(error);
        fetchInvites();
        if (onInviteProcessed) {
          onInviteProcessed();
        }
      } finally {
        setProcessingInviteId(null);
      }
    });
  };

  const getInitials = (name: string | null | undefined) => {
    if (!name) return "?";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-6">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (invites.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Convites Pendentes</h2>
      {invites.map((invite) => (
        <Card key={invite.id} className="overflow-hidden">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle>Convite para {invite.organization.name}</CardTitle>
              <span className="text-xs text-muted-foreground">
                Expira em{" "}
                {formatDistanceToNow(new Date(invite.expires_at), {
                  addSuffix: true,
                  locale: ptBR,
                })}
              </span>
            </div>
            <CardDescription>
              Você foi convidado(a) para participar desta organização com o papel de{" "}
              <strong>{invite.role === "OWNER" ? "Proprietário" : invite.role === "ADMIN" ? "Administrador" : "Membro"}</strong>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              <Avatar className="h-8 w-8">
                <AvatarImage src={invite.invited_by.image || undefined} alt={invite.invited_by.name || ""} />
                <AvatarFallback>{getInitials(invite.invited_by.name)}</AvatarFallback>
              </Avatar>
              <div>
                <p className="text-sm font-medium">
                  Convite enviado por {invite.invited_by.name || invite.invited_by.email}
                </p>
              </div>
            </div>
          </CardContent>
          <CardFooter className="border-t bg-muted/20 px-6 py-3">
            <div className="flex justify-end gap-2 w-full">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleRejectInvite(invite.id)}
                disabled={isPending || processingInviteId === invite.id}
              >
                <XCircle className="mr-2 h-4 w-4" />
                Recusar
              </Button>
              <Button
                size="sm"
                onClick={() => handleAcceptInvite(invite.id)}
                disabled={isPending || processingInviteId === invite.id}
              >
                {processingInviteId === invite.id ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle className="mr-2 h-4 w-4" />
                )}
                Aceitar
              </Button>
            </div>
          </CardFooter>
        </Card>
      ))}
    </div>
  );
} 