# Guia de Configuração do Stripe

Este guia detalha como configurar completamente a integração do Stripe para desenvolvimento e produção.

## 📋 Pré-requisitos

1. **Conta no Stripe**: Crie uma conta em [stripe.com](https://stripe.com)
2. **Node.js**: Versão 18 ou superior
3. **Stripe CLI** (opcional, mas recomendado): [Instalar Stripe CLI](https://stripe.com/docs/stripe-cli)

## 🔧 Configuração para Desenvolvimento

### 1. Configurar Chaves de API

1. Acesse o [Dashboard do Stripe](https://dashboard.stripe.com)
2. Vá para **Developers > API keys**
3. Copie a **Secret key** (começa com `sk_test_`)
4. Opcionalmente, copie a **Publishable key** (começa com `pk_test_`)

### 2. Configurar Variáveis de Ambiente

Copie o arquivo `.env.example` para `.env` e configure:

```bash
# Stripe - Desenvolvimento
STRIPE_SECRET_KEY="sk_test_sua_chave_aqui"
STRIPE_PUBLISHABLE_KEY="pk_test_sua_chave_aqui"  # Opcional
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

### 3. Criar Produtos e Preços

Execute o script de configuração:

```bash
npm run setup:stripe-products
```

Este script irá:

- Criar o produto "Dog SaaS Pro"
- Criar preços mensais e anuais
- **Configurar período de teste de 7 dias**
- **Configurar elegibilidade de trial**
- Gerar as variáveis de ambiente necessárias

**⚠️ Importante**: O período de teste é configurado automaticamente e permite:

- 7 dias de acesso completo ao plano Pro
- Conversão automática para assinatura paga após o período
- Prevenção de uso múltiplo do período de teste pela mesma organização

Copie as variáveis geradas para seu arquivo `.env`:

```bash
# Gerado pelo script
STRIPE_PRO_PLAN_PRICE_ID="price_xxxxx"
STRIPE_PRO_PLAN_YEARLY_PRICE_ID="price_xxxxx"
STRIPE_PRO_PRODUCT_ID="prod_xxxxx"
```

### 4. Configurar Webhooks para Desenvolvimento

Para desenvolvimento local, use o Stripe CLI:

```bash
# Instalar Stripe CLI (se não instalado)
# macOS: brew install stripe/stripe-cli/stripe
# Windows: scoop install stripe
# Linux: Ver documentação oficial

# Login no Stripe
stripe login

# Escutar webhooks localmente
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

O comando acima irá gerar um webhook secret. Adicione-o ao seu `.env`:

```bash
STRIPE_WEBHOOK_SECRET="whsec_xxxxx"
```

### 5. Testar a Configuração

```bash
# Verificar configuração
npm run test:stripe-config

# Iniciar aplicação
npm run dev
```

## 🚀 Configuração para Produção

### 1. Ativar Conta no Stripe

1. Complete o processo de verificação da conta
2. Ative sua conta para receber pagamentos reais

### 2. Configurar Chaves de Produção

1. No Dashboard do Stripe, alterne para **Live mode**
2. Vá para **Developers > API keys**
3. Copie as chaves de produção (começam com `sk_live_` e `pk_live_`)

### 3. Configurar Variáveis de Ambiente de Produção

```bash
# Stripe - Produção
STRIPE_SECRET_KEY="sk_live_sua_chave_aqui"
STRIPE_PUBLISHABLE_KEY="pk_live_sua_chave_aqui"
NEXT_PUBLIC_APP_URL="https://seu-dominio.com"
NODE_ENV="production"
```

### 4. Criar Produtos de Produção

Execute o script com as chaves de produção:

```bash
npm run setup:stripe-products
```

**⚠️ ATENÇÃO**: Certifique-se de estar usando as chaves corretas!

### 5. Configurar Webhooks de Produção

```bash
npm run setup:stripe-webhooks
```

Ou configure manualmente:

1. Vá para **Developers > Webhooks** no Dashboard
2. Clique em **Add endpoint**
3. URL: `https://seu-dominio.com/api/webhooks/stripe`
4. Selecione os eventos:
   - `checkout.session.completed` - Criação de assinatura com trial
   - `customer.subscription.created` - Nova assinatura criada
   - `customer.subscription.updated` - Mudanças na assinatura
   - `customer.subscription.deleted` - Cancelamento de assinatura
   - **`customer.subscription.trial_will_end`** - Trial prestes a expirar (2 dias antes)
   - `invoice.payment_succeeded` - Pagamento bem-sucedido (conversão do trial)
   - `invoice.payment_failed` - Falha no pagamento

Copie o **Signing secret** para suas variáveis de ambiente:

```bash
STRIPE_WEBHOOK_SECRET="whsec_xxxxx"
```

## 🧪 Testes

### Testar Configuração

```bash
# Verificar todas as configurações
npm run test:stripe-config

# Verificar health check
curl http://localhost:3000/api/admin/stripe-health

# Testar fluxo de trial end-to-end
npm test src/test/stripe/stripe-e2e.test.ts --run
```

### Testar Webhooks

```bash
# Com Stripe CLI (desenvolvimento)
stripe trigger checkout.session.completed
stripe trigger customer.subscription.trial_will_end
stripe trigger invoice.payment_succeeded

# Verificar logs da aplicação para confirmar processamento
tail -f logs/stripe-webhooks.log
```

### Cartões de Teste

Para desenvolvimento, use os cartões de teste do Stripe:

- **Sucesso**: `4242 4242 4242 4242`
- **Falha**: `4000 0000 0000 0002`
- **3D Secure**: `4000 0025 0000 3155`

## 🔍 Monitoramento e Logs

### Dashboard do Stripe

- **Payments**: Visualizar pagamentos
- **Subscriptions**: Gerenciar assinaturas
- **Logs**: Ver eventos de webhook
- **Events**: Histórico de eventos

### Logs da Aplicação

Os webhooks são logados automaticamente. Verifique:

```bash
# Logs do servidor
tail -f logs/stripe-webhooks.log

# Ou no console da aplicação
```

### Health Check

Endpoint para verificar saúde da integração:

```bash
GET /api/admin/stripe-health
```

## 🚨 Solução de Problemas

### Erro: "STRIPE_SECRET_KEY não está definida"

- Verifique se o arquivo `.env` existe
- Confirme se a variável está definida corretamente
- Reinicie a aplicação após mudanças no `.env`

### Erro: "Webhook signature verification failed"

- Verifique se `STRIPE_WEBHOOK_SECRET` está correto
- Para desenvolvimento, use o secret gerado pelo `stripe listen`
- Para produção, use o secret do webhook configurado no Dashboard

### Erro: "Price not found"

- Execute `npm run setup:stripe-products` novamente
- Verifique se `STRIPE_PRO_PLAN_PRICE_ID` está correto
- Confirme se está usando o ambiente correto (test/live)

### Webhooks não funcionam

- Verifique se a URL está acessível publicamente
- Para desenvolvimento local, use ngrok ou Stripe CLI
- Confirme se todos os eventos necessários estão configurados

## 📚 Recursos Adicionais

- [Documentação do Stripe](https://stripe.com/docs)
- [Stripe CLI](https://stripe.com/docs/stripe-cli)
- [Webhooks do Stripe](https://stripe.com/docs/webhooks)
- [Testes com Stripe](https://stripe.com/docs/testing)

## 🔄 Scripts Disponíveis

```bash
# Configurar produtos
npm run setup:stripe-products

# Configurar webhooks
npm run setup:stripe-webhooks

# Listar webhooks existentes
npm run setup:stripe-webhooks list

# Testar configuração
npm run test:stripe-config

# Health check
npm run stripe:health
```

## 📝 Checklist de Deploy

### Desenvolvimento ✅

- [ ] Chaves de teste configuradas
- [ ] Produtos criados no modo test com trial de 7 dias
- [ ] Webhooks configurados com Stripe CLI
- [ ] Testes realizados com cartões de teste
- [ ] **Fluxo de trial testado end-to-end**
- [ ] **Elegibilidade de trial validada**

### Produção ✅

- [ ] Conta Stripe ativada
- [ ] Chaves de produção configuradas
- [ ] Produtos criados no modo live com trial
- [ ] Webhooks configurados no Dashboard
- [ ] URL de produção acessível
- [ ] Health check funcionando
- [ ] Monitoramento configurado
- [ ] **Trial conversion tracking ativo**
- [ ] **Customer portal funcionando**

---

**💡 Dica**: Mantenha sempre backups das configurações e documente qualquer customização específica do seu ambiente.
