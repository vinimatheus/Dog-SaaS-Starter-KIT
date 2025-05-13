import { UserRole } from '@prisma/client'
import { DefaultSession } from 'next-auth'

export type ExtendedUser = DefaultSession['user'] & {
  id: string
  role: UserRole
  orgId?: string;
  sessionVersion: number;
}

declare module 'next-auth' {
  interface Session {
    user: ExtendedUser
  }
}