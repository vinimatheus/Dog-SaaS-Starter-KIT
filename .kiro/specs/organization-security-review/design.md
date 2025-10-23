# Documento de Design - Revisão de Segurança e Correção de Bugs do Sistema de Organizações

## Visão Geral

Este documento apresenta o design para uma revisão abrangente de segurança e correção de bugs do sistema de organizações existente. A análise identificou várias vulnerabilidades e pontos de melhoria que serão abordados sistematicamente.

## Arquitetura Atual

### Componentes Principais
- **Actions**: Funções server-side para operações de organização
- **Middleware**: Proteções de segurança e roteamento
- **Auth System**: Autenticação baseada em NextAuth.js
- **Database**: PostgreSQL com Prisma ORM
- **Security Logger**: Sistema de auditoria de eventos

### Fluxo de Dados
```
Cliente → Middleware → Auth → Actions → Prisma → PostgreSQL
                ↓
        Security Logger → Auditoria
```

## Problemas Identificados

### 1. Vulnerabilidades de Segurança Críticas

#### 1.1 Validação de Acesso Insuficiente
- **Problema**: `getOrganizationByUniqueId` não valida se o usuário tem permissão específica
- **Risco**: Exposição de dados sensíveis de organizações
- **Localização**: `src/actions/organization.actions.ts:15`

#### 1.2 Race Conditions em Operações Críticas
- **Problema**: Operações de convite e membership podem ter condições de corrida
- **Risco**: Estados inconsistentes no banco de dados
- **Localização**: `src/actions/invite-member.actions.ts`, `src/actions/accept-invite.actions.ts`

#### 1.3 Validação de Entrada Inadequada
- **Problema**: Alguns endpoints não validam adequadamente parâmetros de entrada
- **Risco**: Injeção de dados maliciosos
- **Localização**: Múltiplos arquivos de actions

### 2. Bugs de Lógica de Negócio

#### 2.1 Gerenciamento de Convites Inconsistente
- **Problema**: Convites expirados não são limpos automaticamente
- **Impacto**: Acúmulo de dados desnecessários
- **Localização**: Sistema de convites

#### 2.2 Validação de Permissões Complexa
- **Problema**: Lógica de permissões espalhada e inconsistente
- **Impacto**: Possíveis bypasses de autorização
- **Localização**: Múltiplos arquivos de actions

### 3. Problemas de Performance

#### 3.1 Cache Inadequado
- **Problema**: Consultas repetitivas sem cache apropriado
- **Impacto**: Performance degradada
- **Localização**: Verificações de permissão

#### 3.2 Transações Desnecessárias
- **Problema**: Algumas operações usam transações quando não necessário
- **Impacto**: Overhead de performance
- **Localização**: Actions de atualização

## Componentes e Interfaces

### 1. Sistema de Validação Centralizado

```typescript
interface SecurityValidator {
  validateOrganizationAccess(userId: string, orgId: string, requiredRole?: Role): Promise<boolean>
  validateInvitePermissions(userId: string, orgId: string): Promise<boolean>
  sanitizeInput<T>(input: T, schema: ZodSchema): T
  checkRateLimit(userId: string, action: string): Promise<boolean>
}
```

### 2. Sistema de Auditoria Aprimorado

```typescript
interface AuditLogger {
  logOrganizationAccess(userId: string, orgId: string, action: string, success: boolean): Promise<void>
  logInviteAction(userId: string, inviteId: string, action: string): Promise<void>
  logSecurityViolation(userId: string, violation: string, context: object): Promise<void>
}
```

### 3. Gerenciador de Permissões

```typescript
interface PermissionManager {
  canAccessOrganization(userId: string, orgId: string): Promise<boolean>
  canManageMembers(userId: string, orgId: string): Promise<boolean>
  canSendInvites(userId: string, orgId: string): Promise<boolean>
  canModifyOrganization(userId: string, orgId: string): Promise<boolean>
}
```

### 4. Sistema de Cache Inteligente

```typescript
interface CacheManager {
  getUserPermissions(userId: string, orgId: string): Promise<UserPermissions>
  getOrganizationData(orgId: string): Promise<Organization>
  invalidateUserCache(userId: string): Promise<void>
  invalidateOrganizationCache(orgId: string): Promise<void>
}
```

## Modelos de Dados

### 1. Estruturas de Validação

```typescript
// Schemas de validação aprimorados
const OrganizationAccessSchema = z.object({
  userId: z.string().cuid(),
  organizationId: z.string().cuid(),
  requiredRole: z.nativeEnum(Role).optional()
})

const InviteActionSchema = z.object({
  email: z.string().email().max(255),
  role: z.nativeEnum(Role),
  organizationId: z.string().cuid()
})
```

### 2. Tipos de Segurança

```typescript
type SecurityContext = {
  userId: string
  organizationId: string
  userRole: Role
  permissions: Permission[]
  sessionVersion: number
}

type AuditEvent = {
  eventType: string
  userId: string
  organizationId?: string
  success: boolean
  metadata: Record<string, any>
  timestamp: Date
}
```

## Tratamento de Erros

### 1. Hierarquia de Erros Personalizada

```typescript
class OrganizationSecurityError extends Error {
  constructor(message: string, public code: string, public userId?: string) {
    super(message)
    this.name = 'OrganizationSecurityError'
  }
}

class PermissionDeniedError extends OrganizationSecurityError {
  constructor(userId: string, action: string) {
    super(`Permission denied for action: ${action}`, 'PERMISSION_DENIED', userId)
  }
}
```

### 2. Tratamento Centralizado

```typescript
interface ErrorHandler {
  handleSecurityError(error: OrganizationSecurityError): Promise<void>
  handleValidationError(error: ZodError): Promise<void>
  handleDatabaseError(error: PrismaClientError): Promise<void>
}
```

## Estratégia de Testes

### 1. Testes de Segurança

#### 1.1 Testes de Autorização
- Verificar acesso negado para usuários não autorizados
- Testar bypass de permissões
- Validar escalação de privilégios

#### 1.2 Testes de Validação de Entrada
- Injeção SQL através de parâmetros
- XSS em campos de texto
- Overflow de dados

#### 1.3 Testes de Race Condition
- Operações simultâneas de convite
- Modificações concorrentes de membros
- Criação simultânea de organizações

### 2. Testes de Integração

#### 2.1 Fluxos Completos
- Criação de organização → Convite → Aceitação
- Transferência de propriedade
- Remoção de membros

#### 2.2 Cenários de Erro
- Convites expirados
- Organizações inexistentes
- Usuários sem permissão

### 3. Testes de Performance

#### 3.1 Carga de Trabalho
- Múltiplas operações simultâneas
- Grande volume de convites
- Consultas complexas de permissão

#### 3.2 Benchmarks
- Tempo de resposta das APIs
- Uso de memória
- Conexões de banco de dados

## Implementação de Segurança

### 1. Validação de Entrada Robusta

```typescript
// Implementação de sanitização
function sanitizeOrganizationInput(input: any): OrganizationInput {
  return OrganizationInputSchema.parse({
    name: input.name?.toString().trim().slice(0, 100),
    uniqueId: input.uniqueId?.toString().toLowerCase().trim()
  })
}
```

### 2. Sistema de Rate Limiting

```typescript
// Rate limiting por usuário e ação
const rateLimits = {
  'create-organization': { requests: 5, window: 3600 }, // 5 por hora
  'send-invite': { requests: 20, window: 3600 }, // 20 por hora
  'update-organization': { requests: 10, window: 3600 } // 10 por hora
}
```

### 3. Auditoria Completa

```typescript
// Log de todas as ações sensíveis
async function auditOrganizationAction(
  action: string,
  userId: string,
  organizationId: string,
  success: boolean,
  metadata?: object
) {
  await prisma.securityLog.create({
    data: {
      eventType: `organization_${action}`,
      userId,
      metadata: {
        organizationId,
        success,
        ...metadata
      }
    }
  })
}
```

## Melhorias de Performance

### 1. Cache Estratégico

```typescript
// Cache de permissões com TTL
const permissionCache = new Map<string, {
  permissions: UserPermissions,
  expires: number
}>()

// Cache de dados de organização
const organizationCache = new Map<string, {
  data: Organization,
  expires: number
}>()
```

### 2. Otimização de Consultas

```typescript
// Consultas otimizadas com select específico
const getOrganizationWithPermissions = (userId: string, orgId: string) => {
  return prisma.organization.findFirst({
    where: { uniqueId: orgId },
    select: {
      id: true,
      name: true,
      uniqueId: true,
      User_Organization: {
        where: { user_id: userId },
        select: { role: true }
      }
    }
  })
}
```

## Monitoramento e Alertas

### 1. Métricas de Segurança

- Tentativas de acesso negado por minuto
- Operações de alta sensibilidade (transferência de propriedade)
- Padrões suspeitos de comportamento

### 2. Alertas Automáticos

- Múltiplas tentativas de acesso negado
- Operações fora do horário normal
- Modificações em massa de membros

### 3. Dashboards de Monitoramento

- Gráficos de atividade por organização
- Métricas de performance das APIs
- Status de saúde do sistema

## Considerações de Implementação

### 1. Migração Gradual

- Implementar validações sem quebrar funcionalidade existente
- Rollout progressivo das melhorias de segurança
- Monitoramento contínuo durante a migração

### 2. Compatibilidade

- Manter APIs existentes funcionando
- Versioning de mudanças críticas
- Documentação de breaking changes

### 3. Rollback

- Plano de rollback para cada mudança
- Backups de dados críticos
- Monitoramento de regressões