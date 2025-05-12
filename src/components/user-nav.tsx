'use client';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { signOut, useSession } from 'next-auth/react';
import {
  LogOut
} from 'lucide-react';

export function UserNav() {
  const { data: session } = useSession();


    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="relative h-10 w-10 rounded-full">
            <Avatar className="h-10 w-10">
              <AvatarImage
                src={session?.user?.image ?? ''}
                alt={session?.user?.name ?? 'Avatar'}
              />
              <AvatarFallback>{session?.user?.name?.[0] ?? 'U'}</AvatarFallback>
            </Avatar>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-64 p-2" align="end" forceMount>
          <DropdownMenuLabel className="font-normal">
            <div className="flex flex-col items-start space-y-1">
              <p className="text-sm font-medium leading-none text-primary">
                {session?.user?.name}
              </p>
              <p className="text-xs leading-none text-muted-foreground">
                {session?.user?.email}
              </p>
              <div className="flex w-full justify-end">
              </div>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator className="my-2" />
        
          
          <DropdownMenuSeparator className="my-2" />
          <DropdownMenuItem
            className="flex cursor-pointer items-center justify-between gap-4 text-destructive"
            onClick={() => signOut()}
          >
            <div className="flex items-center">
              <LogOut className="mr-2 h-4 w-4" />
              <span>Sair</span>
            </div>
            <DropdownMenuShortcut>⇧⌘Q</DropdownMenuShortcut>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
}
