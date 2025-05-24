"use client"

import { User_Organization } from "@prisma/client"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { MoreHorizontal } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"

interface MemberCardProps {
  member: User_Organization & {
    user: {
      name: string | null
      email: string
      image: string | null
    }
  }
  organization: {
    id: string
    owner_user_id: string
  }
  isOwner: boolean
  isAdmin: boolean
}

export function MemberCard({ member, organization, isOwner, isAdmin }: MemberCardProps) {
  const isCurrentUser = member.user_id === organization.owner_user_id
  const canManage = isOwner || (isAdmin && member.role !== "OWNER")

  return (
    <div className="flex items-center justify-between p-4 bg-card rounded-lg border">
      <div className="flex items-center gap-4">
        <Avatar>
          <AvatarImage src={member.user.image || undefined} />
          <AvatarFallback>
            {member.user.name?.charAt(0) || member.user.email.charAt(0)}
          </AvatarFallback>
        </Avatar>
        <div>
          <p className="font-medium">{member.user.name || member.user.email}</p>
          <div className="flex items-center gap-2 mt-1">
            <span
              className={cn(
                "px-2 py-0.5 rounded-full text-xs font-medium",
                member.role === "OWNER"
                  ? "bg-purple-100 text-purple-800"
                  : member.role === "ADMIN"
                  ? "bg-blue-100 text-blue-800"
                  : "bg-gray-100 text-gray-800"
              )}
            >
              {member.role === "OWNER"
                ? "Dono"
                : member.role === "ADMIN"
                ? "Admin"
                : "Membro"}
            </span>
          </div>
        </div>
      </div>

      {canManage && !isCurrentUser && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem className="text-destructive">
              Remover membro
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  )
} 