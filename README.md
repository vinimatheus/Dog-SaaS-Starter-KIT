# Starter Org Dog 🐕

Um projeto moderno e robusto construído com Next.js 15, React 19, Prisma e TypeScript, oferecendo uma base sólida para aplicações web organizacionais.

## 📋 Pré-requisitos

- Node.js (versão LTS recomendada)
- npm ou yarn
- Docker e Docker Compose (para banco de dados)

## 🛠️ Instalação e Configuração

### 1. Banco de Dados com Docker

O projeto utiliza PostgreSQL rodando em um container Docker. Para iniciar:

```bash
# Inicia o container do PostgreSQL
docker-compose up -d

# Verifica se o container está rodando
docker ps
```

O banco de dados estará disponível em:
- Host: localhost
- Porta: 5432
- Usuário: dogsaas
- Senha: dogsaas
- Banco: dogsaas

### 2. Configuração do Projeto

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
```env
# Banco de Dados (Docker)
DATABASE_URL="postgresql://dogsaas:dogsaas@localhost:5432/dogsaas?schema=public"

# NextAuth
AUTH_SECRET="sua-chave-secreta-aqui"

# Email (Resend)
RESEND_API_KEY="sua-api-key-do-resend"
EMAIL_FROM="seu-email@seudominio.com"

# Google OAuth
GOOGLE_CLIENT_ID="seu-client-id-do-google"
GOOGLE_CLIENT_SECRET="seu-client-secret-do-google"

# reCAPTCHA
RECAPTCHA_SECRET_KEY="sua-chave-secreta-do-recaptcha"
NEXT_PUBLIC_RECAPTCHA_SITE_KEY="sua-chave-de-site-do-recaptcha"

# URL da Aplicação
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

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
- **reCAPTCHA** - Proteção contra bots e spam

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

## 🐳 Docker

### Estrutura do Docker Compose

```yaml
version: '3.8'

services:
  postgresql:
    image: bitnami/postgresql:latest
    container_name: postgresql_container
    environment:
      - POSTGRESQL_USERNAME=dogsaas
      - POSTGRESQL_PASSWORD=dogsaas
      - POSTGRESQL_DATABASE=dogsaas
    ports:
      - "5432:5432"
    volumes:
      - postgresql_data:/bitnami/postgresql

volumes:
  postgresql_data:
    driver: local
```

### Comandos Docker Úteis

```bash
# Iniciar containers
docker-compose up -d

# Parar containers
docker-compose down

# Ver logs
docker-compose logs -f

# Reiniciar containers
docker-compose restart

# Remover volumes (cuidado: isso apaga os dados)
docker-compose down -v
```

### Volumes e Persistência

- Os dados do PostgreSQL são persistidos em um volume Docker
- O volume é nomeado `postgresql_data`
- Os dados permanecem mesmo após parar/remover os containers
- Para limpar completamente os dados, use `docker-compose down -v`

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

### Configuração de Autenticação

1. Para Google OAuth:
   - Acesse [Google Cloud Console](https://console.cloud.google.com)
   - Crie um novo projeto
   - Configure as credenciais OAuth 2.0
   - Adicione `http://localhost:3000/api/auth/callback/google` como URI de redirecionamento
   - Copie o Client ID e Client Secret para as variáveis de ambiente

2. Para Magic Link:
   - Crie uma conta no [Resend](https://resend.com)
   - Configure seu domínio de email
   - Obtenha sua API key
   - Configure o `EMAIL_FROM` com um email verificado

3. Para reCAPTCHA:
   - Acesse [Google reCAPTCHA Admin](https://www.google.com/recaptcha/admin)
   - Registre um novo site
   - Selecione reCAPTCHA v2 (Checkbox)
   - Adicione seu domínio à lista de domínios permitidos
   - Copie a Site Key e Secret Key para as variáveis de ambiente

### Segurança

- Tokens JWT seguros
- CSRF Protection
- Rate limiting
- reCAPTCHA para proteção contra bots
- Sessões com expiração
- Proteção de rotas
- Validação de email

## 🎨 UI/UX

O projeto utiliza o [shadcn/ui](https://ui.shadcn.com), uma coleção de componentes reutilizáveis construídos com Radix UI e Tailwind CSS:

- **Componentes Acessíveis**: Todos os componentes seguem as melhores práticas de acessibilidade (WAI-ARIA)
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
- `react-google-recaptcha` - Integração com Google reCAPTCHA

### Desenvolvimento
- `typescript` - Tipagem estática
- `prisma` - ORM e migrações
- `tailwindcss` - Estilização
- `eslint` - Linting
- `@types/*` - Tipos TypeScript

## 🚀 Scripts Disponíveis

- `npm run dev` - Inicia o servidor de desenvolvimento com Turbopack
- `npm run build` - Cria a versão de produção
- `npm run start` - Inicia o servidor de produção
- `npm run lint` - Executa a verificação de linting
- `npm run postinstall` - Gera o cliente Prisma após instalação
- `npm run vercel-build` - Script específico para deploy na Vercel

## 🤝 Contribuindo

1. Faça um Fork do projeto
2. Crie uma Branch para sua Feature (`git checkout -b feature/AmazingFeature`)
3. Faça o Commit das suas mudanças (`git commit -m 'Add some AmazingFeature'`)
4. Faça o Push para a Branch (`git push origin feature/AmazingFeature`)
5. Abra um Pull Request

## 📝 Licença

Este projeto está sob a licença MIT. Veja o arquivo [LICENSE](LICENSE) para mais detalhes.
Desenvolvido com ❤️ por [Vinicius Matheus](https://github.com/vinimatheus)
