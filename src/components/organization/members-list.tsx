"use client";

import { useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { MoreVertical, Shield, UserX, Crown } from "lucide-react";
import { toast } from "sonner";
import { Role } from "@prisma/client";
import { updateMemberRoleAction, removeMemberAction, transferOwnershipAction } from "@/actions/manage-members.actions";

interface Member {
  user: {
    id: string;
    name: string | null;
    email: string;
    image: string | null;
  };
  user_id: string;
  organization_id: string;
  role: Role;
}

interface MembersListProps {
  members: Member[];
  organizationId: string;
  currentUserRole: Role;
  currentUserId: string;
}

export function MembersList({ members, organizationId, currentUserRole, currentUserId }: MembersListProps) {
  const [isLoading, setIsLoading] = useState(false);

  const isOwner = currentUserRole === "OWNER";
  const isAdmin = currentUserRole === "ADMIN" || isOwner;

  const handleAction = async (member: Member, type: "remove" | "transfer" | "role") => {
    const confirmMessage = {
      remove: `Tem certeza que deseja remover ${member.user.name || member.user.email} da organização?`,
      transfer: `Tem certeza que deseja transferir a propriedade da organização para ${member.user.name || member.user.email}? Você se tornará um administrador.`,
      role: `Deseja alterar o cargo de ${member.user.name || member.user.email} para ${
        member.role === "USER" ? "Administrador" : "Membro"
      }?`,
    };

    const toastId = toast.loading("Processando...", {
      description: confirmMessage[type],
      action: {
        label: "Confirmar",
        onClick: async () => {
          setIsLoading(true);
          try {
            let result;

            switch (type) {
              case "remove":
                result = await removeMemberAction(organizationId, member.user_id);
                break;
              case "transfer":
                result = await transferOwnershipAction(organizationId, member.user_id);
                break;
              case "role":
                if (member.role === "USER") {
                  result = await updateMemberRoleAction(organizationId, member.user_id, "ADMIN");
                } else {
                  result = await updateMemberRoleAction(organizationId, member.user_id, "USER");
                }
                break;
            }

            if (result?.success) {
              toast.success(
                type === "remove"
                  ? "Membro removido com sucesso"
                  : type === "transfer"
                  ? "Propriedade transferida com sucesso"
                  : "Cargo atualizado com sucesso"
              );
            } else {
              toast.error(result?.error || "Erro ao realizar a ação");
            }
          } catch (err) {
            console.error("Erro ao realizar ação:", err);
            toast.error("Ocorreu um erro ao realizar a ação");
          } finally {
            setIsLoading(false);
          }
        },
      },
      cancel: {
        label: "Cancelar",
        onClick: () => toast.dismiss(toastId),
      },
    });
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h2 className="text-xl font-semibold mb-4">Membros</h2>
      <div className="space-y-4">
        {members.map((member) => (
          <div
            key={`${member.user_id}-${member.organization_id}`}
            className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg"
          >
            <Avatar>
              <AvatarImage src={member.user.image || undefined} alt={member.user.name || member.user.email} />
              <AvatarFallback>
                {member.user.name?.[0]?.toUpperCase() || member.user.email[0].toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <p className="font-medium">{member.user.name || member.user.email}</p>
              <p className="text-sm text-gray-600">{member.user.email}</p>
            </div>
            <div className="flex items-center gap-2">
              <span
                className={`px-2 py-1 rounded-full text-sm ${
                  member.role === "OWNER"
                    ? "bg-purple-100 text-purple-800"
                    : member.role === "ADMIN"
                    ? "bg-blue-100 text-blue-800"
                    : "bg-gray-100 text-gray-800"
                }`}
              >
                {member.role === "OWNER" && "Proprietário"}
                {member.role === "ADMIN" && "Administrador"}
                {member.role === "USER" && "Membro"}
              </span>

              {/* Menu de ações */}
              {(isOwner || (isAdmin && member.role === "USER")) && member.user_id !== currentUserId && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8" 
                      disabled={isLoading}
                    >
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {/* Ações disponíveis apenas para o proprietário */}
                    {isOwner && member.role !== "OWNER" && (
                      <>
                        <DropdownMenuItem
                          onClick={() => handleAction(member, "transfer")}
                          className="text-amber-600"
                          disabled={isLoading}
                        >
                          <Crown className="mr-2 h-4 w-4" />
                          Transferir Propriedade
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleAction(member, "role")}
                          className="text-blue-600"
                          disabled={isLoading}
                        >
                          <Shield className="mr-2 h-4 w-4" />
                          {member.role === "USER" ? "Tornar Administrador" : "Tornar Membro"}
                        </DropdownMenuItem>
                      </>
                    )}
                    {/* Ações disponíveis para proprietário e admin */}
                    {(isOwner || (isAdmin && member.role === "USER")) && (
                      <DropdownMenuItem
                        onClick={() => handleAction(member, "remove")}
                        className="text-red-600"
                        disabled={isLoading}
                      >
                        <UserX className="mr-2 h-4 w-4" />
                        Remover Membro
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
} 