# Starter Org Dog 🐕

Um projeto moderno e robusto construído com Next.js 15, React 19, Prisma e TypeScript, oferecendo uma base sólida para aplicações web organizacionais.

## 🚀 Tecnologias Principais

- **Next.js 15.3.2** - Framework React com recursos avançados
- **React 19** - Biblioteca JavaScript para construção de interfaces
- **TypeScript** - Superset JavaScript com tipagem estática
- **Prisma** - ORM moderno para banco de dados
- **NextAuth.js** - Autenticação completa e segura
- **TailwindCSS** - Framework CSS utilitário
- **Radix UI** - Componentes acessíveis e personalizáveis
- **Zod** - Validação de esquemas TypeScript
- **React Hook Form** - Gerenciamento de formulários

## 📋 Pré-requisitos

- Node.js (versão LTS recomendada)
- npm ou yarn
- Banco de dados PostgreSQL

## 🛠️ Instalação

1. Clone o repositório:
```bash
git clone https://github.com/vinimatheus/starter-org-dog.git
cd starter-org-dog
```

2. Instale as dependências:
```bash
npm install
# ou
yarn install
```

3. Configure as variáveis de ambiente:
```bash
cp .env.example .env.local
```
Edite o arquivo `.env.local` com suas configurações.

4. Execute as migrações do banco de dados:
```bash
npx prisma generate
npx prisma db push
```

5. Inicie o servidor de desenvolvimento:
```bash
npm run dev
# ou
yarn dev
```

## 🚀 Scripts Disponíveis

- `npm run dev` - Inicia o servidor de desenvolvimento com Turbopack
- `npm run build` - Cria a versão de produção
- `npm run start` - Inicia o servidor de produção
- `npm run lint` - Executa a verificação de linting
- `npm run postinstall` - Gera o cliente Prisma após instalação
- `npm run vercel-build` - Script específico para deploy na Vercel

## 🏗️ Estrutura do Projeto

```
starter-org-dog/
├── src/                    # Código fonte principal
│   ├── app/               # Rotas e páginas (App Router)
│   ├── components/        # Componentes React reutilizáveis
│   └── lib/           # Estilos globais
├── prisma/                # Schema e migrações do banco de dados
├── public/               # Arquivos estáticos
└── ...
```

## 🔒 Autenticação

O projeto utiliza NextAuth.js v5 para autenticação, oferecendo múltiplos métodos de login:

### Métodos de Autenticação

#### 1. Google OAuth
- Login social com conta Google
- Integração com Google Cloud Console
- Escopo de acesso configurável
- Perfil do usuário sincronizado automaticamente

#### 2. Magic Link (Email)
- Login sem senha via email
- Links de acesso únicos e seguros
- Expiração automática dos links
- Envio de emails via Resend

#### 3. Credenciais (Email/Senha)
- Login tradicional com email e senha
- Senhas criptografadas com bcrypt
- Proteção contra força bruta
- Recuperação de senha

### Configuração

1. Configure as variáveis de ambiente necessárias:
```env
# Google OAuth
GOOGLE_ID="seu-google-client-id"
GOOGLE_SECRET="seu-google-client-secret"

# Magic Link (Resend)
RESEND_API_KEY="seu-resend-api-key"
EMAIL_FROM="noreply@seudominio.com"

# NextAuth
AUTH_SECRET="seu-auth-secret"
NEXTAUTH_URL="http://localhost:3000"
```

2. Para Google OAuth:
   - Acesse [Google Cloud Console](https://console.cloud.google.com)
   - Crie um novo projeto
   - Configure as credenciais OAuth 2.0
   - Adicione os URIs de redirecionamento permitidos

3. Para Magic Link:
   - Crie uma conta no [Resend](https://resend.com)
   - Configure seu domínio de email
   - Obtenha sua API key

### Segurança

- Tokens JWT seguros
- CSRF Protection
- Rate limiting
- Sessões com expiração
- Proteção de rotas
- Validação de email

### Rotas Protegidas

```typescript
// Exemplo de proteção de rota
import { auth } from "@/auth"

export default async function ProtectedPage() {
  const session = await auth()
  
  if (!session) {
    redirect("/login")
  }
  
  return <div>Conteúdo protegido</div>
}
```

## 🎨 UI/UX

O projeto utiliza o [shadcn/ui](https://ui.shadcn.com), uma coleção de componentes reutilizáveis construídos com Radix UI e Tailwind CSS:

- **Componentes Acessíveis**: Todos os componentes seguem as melhores práticas de acessibilidade (WAI-ARIA)
- **Temas**: Suporte nativo a temas claro/escuro com `next-themes`
- **Customização**: Componentes altamente customizáveis através do Tailwind CSS
- **Tipografia**: Sistema de tipografia consistente
- **Animações**: Animações suaves e interativas
- **Feedback**: Sistema de notificações com Sonner (toasts)

### Componentes Disponíveis

- **Layout**: Card, Sheet, Dialog, Drawer
- **Formulários**: Input, Select, Checkbox, Radio, Switch
- **Navegação**: Tabs, Breadcrumb, Pagination
- **Feedback**: Toast, Alert, Progress
- **Data Display**: Table, Avatar, Badge
- **Overlay**: Modal, Popover, Tooltip
- **E mais...**

Para adicionar novos componentes do shadcn/ui, use o CLI:

```bash
npx shadcn-ui@latest add [nome-do-componente]
```

## 📦 Dependências Principais

### Produção
- `@prisma/client` - Cliente Prisma para banco de dados
- `next-auth` - Autenticação
- `@radix-ui/*` - Componentes UI base para shadcn/ui
- `class-variance-authority` - Utilitário para variantes de componentes
- `tailwind-merge` - Merge inteligente de classes Tailwind
- `clsx` - Utilitário para composição de classes
- `react-hook-form` - Gerenciamento de formulários
- `zod` - Validação
- `date-fns` - Manipulação de datas
- `resend` - Serviço de email

### Desenvolvimento
- `typescript` - Tipagem estática
- `prisma` - ORM e migrações
- `tailwindcss` - Estilização
- `eslint` - Linting
- `@types/*` - Tipos TypeScript

## 🤝 Contribuindo

1. Faça um Fork do projeto
2. Crie uma Branch para sua Feature (`git checkout -b feature/AmazingFeature`)
3. Faça o Commit das suas mudanças (`git commit -m 'Add some AmazingFeature'`)
4. Faça o Push para a Branch (`git push origin feature/AmazingFeature`)
5. Abra um Pull Request

## 📝 Licença

Este projeto está sob a licença MIT. Veja o arquivo [LICENSE](LICENSE) para mais detalhes.

---

Desenvolvido com ❤️ por [Vinicius Matheus](https://github.com/vinimatheus)
