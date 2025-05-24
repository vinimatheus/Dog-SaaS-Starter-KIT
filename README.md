# 🐕 Dog SaaS - Starter Kit

Um kit inicial moderno e robusto para construir seu SaaS, construído com as melhores tecnologias do mercado.

## ✨ Características Principais

- 🚀 **Next.js 15** com App Router
- 🔒 **Autenticação** completa (Google OAuth + Magic Link)
- 💳 **Integração Stripe** para assinaturas
- 🎨 **UI Moderna** com shadcn/ui
- 📱 **Responsivo** e acessível
- 🔐 **Segurança** reforçada
- 📧 **Sistema de Email** com Resend
- 🤖 **Proteção** contra bots com reCAPTCHA

## 🚀 Começando

### Pré-requisitos

- Node.js (LTS)
- npm ou yarn
- Docker (para banco de dados)
- Conta no [Stripe](https://stripe.com)
- Conta no [Resend](https://resend.com)
- Conta no [Google Cloud](https://cloud.google.com)

### Instalação Rápida

1. **Clone o repositório**
```bash
git clone https://github.com/vinimatheus/starter-org-dog.git
cd starter-org-dog
```

2. **Instale as dependências**
```bash
npm install
```

3. **Configure o banco de dados**
```bash
# Inicie o PostgreSQL com Docker
docker-compose up -d
```

4. **Configure as variáveis de ambiente**
```env
# Crie um arquivo .env na raiz do projeto
cp .env.example .env

# Preencha as variáveis necessárias:
# - DATABASE_URL
# - AUTH_SECRET
# - RESEND_API_KEY
# - GOOGLE_CLIENT_ID
# - GOOGLE_CLIENT_SECRET
# - STRIPE_SECRET_KEY
# - STRIPE_WEBHOOK_SECRET
# - STRIPE_PRO_PLAN_PRICE_ID
# - RECAPTCHA_SECRET_KEY
# - NEXT_PUBLIC_RECAPTCHA_SITE_KEY
# - NEXT_PUBLIC_APP_URL
```

5. **Inicialize o banco de dados**
```bash
npx prisma generate
npx prisma db push
```

6. **Inicie o servidor de desenvolvimento**
```bash
npm run dev
```

## 💳 Configuração do Stripe

1. **Crie uma conta no Stripe**
   - Acesse [dashboard.stripe.com](https://dashboard.stripe.com)
   - Obtenha suas chaves de API

2. **Configure o webhook**
```bash
# Instale o Stripe CLI
brew install stripe/stripe-cli/stripe

# Faça login
stripe login

# Inicie o webhook listener
stripe listen --forward-to localhost:3000/api/webhooks/stripe

# Copie o webhook signing secret para seu .env
```

3. **Teste os pagamentos**
   - Cartão de teste: `4242 4242 4242 4242`
   - Data: Qualquer data futura
   - CVC: Qualquer número de 3 dígitos
   - CEP: Qualquer CEP válido

## 🔐 Autenticação

### Google OAuth

1. Acesse [Google Cloud Console](https://console.cloud.google.com)
2. Crie um novo projeto
3. Configure as credenciais OAuth 2.0
4. Adicione a URL de redirecionamento:
   ```
   http://localhost:3000/api/auth/callback/google
   ```
5. Copie o Client ID e Client Secret para o `.env`

### Magic Link (Email)

1. Crie uma conta no [Resend](https://resend.com)
2. Configure seu domínio de email
3. Obtenha sua API key
4. Configure o `EMAIL_FROM` no `.env`

## 🎨 Personalização

### UI Components

O projeto usa [shadcn/ui](https://ui.shadcn.com). Para adicionar novos componentes:

```bash
npx shadcn-ui@latest add [nome-do-componente]
```

### Estilos

- Tailwind CSS para estilização
- Sistema de cores personalizável
- Componentes acessíveis
- Animações suaves

## 📦 Scripts Disponíveis

```bash
npm run dev          # Inicia o servidor de desenvolvimento
npm run build        # Cria a versão de produção
npm run start        # Inicia o servidor de produção
npm run lint         # Executa a verificação de linting
```

## 🔄 Fluxo de Assinatura

1. **Upgrade para Pro**
   - Usuário clica em "Fazer Upgrade"
   - É redirecionado para checkout do Stripe
   - Realiza o pagamento

2. **Processamento**
   - Webhook recebe confirmação
   - Plano é atualizado para PRO
   - Usuário é redirecionado

3. **Gerenciamento**
   - Portal do cliente para gestão
   - Atualização de pagamento
   - Cancelamento de assinatura

## 🛡️ Segurança

- Verificação de assinatura de webhook
- Proteção CSRF
- Rate limiting
- Validação de email
- Tokens JWT seguros
- Proteção contra bots
- Sessões com expiração

## 📚 Estrutura do Projeto

```
starter-org-dog/
├── src/
│   ├── app/              # Rotas e páginas
│   ├── components/       # Componentes React
│   ├── lib/             # Utilitários e configurações
│   └── actions/         # Server Actions
├── prisma/              # Schema do banco de dados
├── public/             # Arquivos estáticos
└── scripts/            # Scripts utilitários
```

## 🤝 Contribuindo

1. Faça um Fork
2. Crie sua Branch (`git checkout -b feature/AmazingFeature`)
3. Commit suas mudanças (`git commit -m 'Add AmazingFeature'`)
4. Push para a Branch (`git push origin feature/AmazingFeature`)
5. Abra um Pull Request

## 📝 Licença

Este projeto está sob a licença MIT. Veja o arquivo [LICENSE](LICENSE) para detalhes.

---

Desenvolvido com ❤️ por [Vinicius Matheus](https://github.com/vinimatheus)

Se você gostou do projeto, considere dar uma ⭐️ no GitHub!
