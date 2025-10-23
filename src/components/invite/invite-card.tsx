"use client";

import { Invite } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { MoreHorizontal } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  deleteInviteAction,
  resendInviteAction,
} from "@/actions/invite-member.actions";
import { NoSSR } from "@/components/ui/no-ssr";

interface InviteCardProps {
  invite: Invite & {
    invited_by: {
      name: string | null;
      email: string;
    };
  };
  isOwner: boolean;
  isAdmin: boolean;
}

export function InviteCard({ invite, isOwner, isAdmin }: InviteCardProps) {
  const canManage = isOwner || isAdmin;

  const handleResend = async () => {
    try {
      const result = await resendInviteAction(invite.id);
      if (result.success) {
        toast.success("Convite reenviado com sucesso");
      } else {
        toast.error(result.error || "Erro ao reenviar convite");
      }
    } catch (error: unknown) {
      console.error("Erro ao reenviar convite:", error);
      toast.error("Erro ao reenviar convite");
    }
  };

  const handleDelete = async () => {
    try {
      const result = await deleteInviteAction(invite.id);
      if (result.success) {
        toast.success("Convite excluído com sucesso");
      } else {
        toast.error(result.error || "Erro ao excluir convite");
      }
    } catch (error: unknown) {
      console.error("Erro ao excluir convite:", error);
      toast.error("Erro ao excluir convite");
    }
  };

  return (
    <div className="flex items-center justify-between p-4 bg-card rounded-lg border">
      <div>
        <p className="font-medium">{invite.email}</p>
        <div className="flex items-center gap-2 mt-1">
          <span
            className={cn(
              "px-2 py-0.5 rounded-full text-xs font-medium",
              invite.role === "ADMIN"
                ? "bg-blue-100 text-blue-800"
                : "bg-gray-100 text-gray-800"
            )}
          >
            {invite.role === "ADMIN" ? "Admin" : "Membro"}
          </span>
          <span
            className={cn(
              "px-2 py-0.5 rounded-full text-xs font-medium",
              invite.status === "PENDING"
                ? "bg-yellow-100 text-yellow-800"
                : "bg-gray-100 text-gray-800"
            )}
          >
            {invite.status === "PENDING" ? "Pendente" : "Expirado"}
          </span>
          <span className="text-xs text-muted-foreground">
            Convidado por {invite.invited_by.name || invite.invited_by.email}
          </span>
        </div>
      </div>

      {canManage && invite.status === "PENDING" && (
        <NoSSR>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleResend}>
                Reenviar convite
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={handleDelete}
                className="text-destructive"
              >
                Excluir convite
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </NoSSR>
      )}
    </div>
  );
}
