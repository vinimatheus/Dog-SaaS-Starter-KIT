import { z } from "zod"
import { Role } from "@prisma/client"

// Base validation schemas with enhanced security
export const CuidSchema = z.string().cuid("ID inválido")

export const EmailSchema = z.string()
  .email("Email inválido")
  .max(255, "Email muito longo")
  .transform(email => email.toLowerCase().trim())
  .refine(email => {
    // Additional email validation
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/
    return emailRegex.test(email)
  }, "Formato de email inválido")

export const NameSchema = z.string()
  .min(1, "Nome é obrigatório")
  .max(100, "Nome deve ter no máximo 100 caracteres")
  .transform(name => name.trim().replace(/\x00/g, '')) // Remove null bytes
  .refine(name => name.length > 0, "Nome não pode estar vazio")
  .refine(name => {
    // Prevent XSS and injection attempts
    const dangerousChars = /<script|javascript:|data:|vbscript:|on\w+=/i
    return !dangerousChars.test(name)
  }, "Nome contém caracteres não permitidos")

export const OrganizationNameSchema = z.string()
  .min(1, "Nome é obrigatório")
  .max(50, "Nome da organização deve ter no máximo 50 caracteres")
  .transform(name => name.trim())
  .refine(name => name.length > 0, "Nome não pode estar vazio")
  .refine(name => {
    // Prevent XSS and injection attempts
    const dangerousChars = /<script|javascript:|data:|vbscript:|on\w+=/i
    return !dangerousChars.test(name)
  }, "Nome contém caracteres não permitidos")

export const UniqueIdSchema = z.string()
  .min(3, "ID único deve ter pelo menos 3 caracteres")
  .max(50, "ID único deve ter no máximo 50 caracteres")
  .regex(/^[a-z0-9-]+$/, "ID único deve conter apenas letras minúsculas, números e hífens")
  .transform(id => id.toLowerCase().trim())
  .refine(id => {
    // Reserved words that cannot be used as organization IDs
    const reserved = [
      'api', 'www', 'admin', 'root', 'system', 'support', 'help',
      'mail', 'email', 'ftp', 'blog', 'shop', 'store', 'app',
      'mobile', 'web', 'secure', 'ssl', 'cdn', 'static', 'assets',
      'auth', 'login', 'register', 'signup', 'signin', 'logout',
      'dashboard', 'panel', 'control', 'manage', 'config', 'settings',
      'organizations', 'invite', 'onboarding'
    ]
    return !reserved.includes(id)
  }, "ID único não pode usar palavras reservadas")

// Organization schemas
export const CreateOrganizationSchema = z.object({
  name: OrganizationNameSchema,
  uniqueId: UniqueIdSchema.optional()
})

export const UpdateOrganizationSchema = z.object({
  name: OrganizationNameSchema.optional(),
  uniqueId: UniqueIdSchema.optional()
}).refine(data => {
  // At least one field must be provided
  return data.name !== undefined || data.uniqueId !== undefined
}, "Pelo menos um campo deve ser fornecido para atualização")

// User schemas
export const CreateUserSchema = z.object({
  name: NameSchema,
  email: EmailSchema
})

export const UpdateUserSchema = z.object({
  name: NameSchema.optional(),
  email: EmailSchema.optional()
}).refine(data => {
  return data.name !== undefined || data.email !== undefined
}, "Pelo menos um campo deve ser fornecido para atualização")

// Invite schemas
export const CreateInviteSchema = z.object({
  email: EmailSchema,
  role: z.nativeEnum(Role),
  organizationId: CuidSchema
})

export const InviteActionSchema = z.object({
  inviteId: CuidSchema,
  action: z.enum(['accept', 'reject', 'resend', 'delete'])
})

// Access validation schemas
export const OrganizationAccessSchema = z.object({
  userId: CuidSchema,
  organizationId: CuidSchema,
  requiredRole: z.nativeEnum(Role).optional()
})

export const MemberActionSchema = z.object({
  userId: CuidSchema,
  organizationId: CuidSchema,
  targetUserId: CuidSchema,
  action: z.enum(['remove', 'update_role']),
  newRole: z.nativeEnum(Role).optional()
})

// Rate limiting schemas
export const RateLimitSchema = z.object({
  userId: CuidSchema,
  action: z.enum([
    'create-organization',
    'send-invite',
    'update-organization',
    'accept-invite',
    'delete-invite',
    'resend-invite',
    'remove-member',
    'update-member-role'
  ])
})

// Pagination schemas
export const PaginationSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc')
})

// Search schemas
export const SearchSchema = z.object({
  query: z.string()
    .min(1, "Consulta de busca é obrigatória")
    .max(100, "Consulta de busca muito longa")
    .transform(query => query.trim())
    .refine(query => {
      // Prevent SQL injection attempts
      const sqlInjectionPattern = /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION|SCRIPT)\b)|[';-]|\/\*|\*\//i
      return !sqlInjectionPattern.test(query)
    }, "Consulta de busca contém caracteres não permitidos"),
  filters: z.record(z.string()).optional()
})

// File upload schemas (for future use)
export const FileUploadSchema = z.object({
  filename: z.string()
    .min(1, "Nome do arquivo é obrigatório")
    .max(255, "Nome do arquivo muito longo")
    .refine(filename => {
      // Allowed file extensions
      const allowedExtensions = /\.(jpg|jpeg|png|gif|pdf|doc|docx|txt)$/i
      return allowedExtensions.test(filename)
    }, "Tipo de arquivo não permitido"),
  size: z.number()
    .min(1, "Arquivo não pode estar vazio")
    .max(10 * 1024 * 1024, "Arquivo muito grande (máximo 10MB)"),
  mimeType: z.string()
    .refine(mimeType => {
      const allowedMimeTypes = [
        'image/jpeg', 'image/png', 'image/gif',
        'application/pdf',
        'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'text/plain'
      ]
      return allowedMimeTypes.includes(mimeType)
    }, "Tipo de arquivo não permitido")
})

// Export commonly used types
export type CreateOrganizationInput = z.infer<typeof CreateOrganizationSchema>
export type UpdateOrganizationInput = z.infer<typeof UpdateOrganizationSchema>
export type CreateUserInput = z.infer<typeof CreateUserSchema>
export type UpdateUserInput = z.infer<typeof UpdateUserSchema>
export type CreateInviteInput = z.infer<typeof CreateInviteSchema>
export type OrganizationAccessInput = z.infer<typeof OrganizationAccessSchema>
export type MemberActionInput = z.infer<typeof MemberActionSchema>
export type PaginationInput = z.infer<typeof PaginationSchema>
export type SearchInput = z.infer<typeof SearchSchema>