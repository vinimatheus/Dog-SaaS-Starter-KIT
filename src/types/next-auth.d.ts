import { UserRole } from '@prisma/client'
import { DefaultSession } from 'next-auth'

export type ExtendedUser = DefaultSession['user'] & {
  id: string
  role: UserRole
  orgId?: string
  orgName?: string
  orgPlan?: string
  orgRole?: UserRole
  sessionVersion: number
}

declare module 'next-auth' {
  interface Session {
    user: ExtendedUser
  }
}


declare module 'next-auth/providers' {
  interface EmailConfig {
    sendVerificationRequest: (params: EmailProviderSendVerificationRequestParams & {
      token?: {
        recaptchaToken?: string;
        [key: string]: unknown;
      }
    }) => Promise<void>;
  }
}