# Configuração de Ambiente - Stripe

Este documento detalha todas as variáveis de ambiente relacionadas ao Stripe e como configurá-las para diferentes ambientes.

## 📋 Variáveis de Ambiente

### Obrigatórias

| Variável | Descrição | Formato | Exemplo |
|----------|-----------|---------|---------|
| `STRIPE_SECRET_KEY` | Chave secreta do Stripe | `sk_test_*` ou `sk_live_*` | `sk_test_51H...` |
| `STRIPE_WEBHOOK_SECRET` | Secret do webhook | `whsec_*` | `whsec_1234...` |
| `STRIPE_PRO_PLAN_PRICE_ID` | ID do preço do plano Pro | `price_*` | `price_1H...` |
| `NEXT_PUBLIC_APP_URL` | URL pública da aplicação | URL válida | `https://app.com` |

### Opcionais

| Variável | Descrição | Padrão | Exemplo |
|----------|-----------|--------|---------|
| `STRIPE_PUBLISHABLE_KEY` | Chave pública do Stripe | - | `pk_test_51H...` |
| `STRIPE_PRO_PLAN_YEARLY_PRICE_ID` | ID do preço anual | - | `price_1H...` |
| `STRIPE_PRO_PRODUCT_ID` | ID do produto Pro | - | `prod_1H...` |
| `STRIPE_WEBHOOK_TOLERANCE` | Tolerância do webhook (s) | `300` | `600` |
| `STRIPE_TIMEOUT` | Timeout das requests (ms) | `80000` | `120000` |
| `STRIPE_MAX_RETRIES` | Máximo de tentativas | `3` | `5` |
| `STRIPE_TRIAL_PERIOD_DAYS` | Dias de trial | `7` | `14` |

## 🔧 Configuração por Ambiente

### Desenvolvimento Local

```bash
# .env.local
NODE_ENV="development"
NEXT_PUBLIC_APP_URL="http://localhost:3000"

# Stripe - Teste
STRIPE_SECRET_KEY="sk_test_51H..."
STRIPE_PUBLISHABLE_KEY="pk_test_51H..."
STRIPE_WEBHOOK_SECRET="whsec_..." # Do Stripe CLI
STRIPE_PRO_PLAN_PRICE_ID="price_..."

# Configurações de desenvolvimento
STRIPE_WEBHOOK_TOLERANCE="600" # Maior tolerância
STRIPE_TIMEOUT="120000" # Timeout maior para debug
```

**Setup:**
```bash
# 1. Configurar produtos
npm run setup:stripe-products

# 2. Escutar webhooks localmente
stripe listen --forward-to localhost:3000/api/webhooks/stripe

# 3. Testar configuração
npm run test:stripe-config
```

### Staging/Homologação

```bash
# .env.staging
NODE_ENV="production"
NEXT_PUBLIC_APP_URL="https://staging.seu-app.com"

# Stripe - Teste (mesmo em staging)
STRIPE_SECRET_KEY="sk_test_51H..."
STRIPE_PUBLISHABLE_KEY="pk_test_51H..."
STRIPE_WEBHOOK_SECRET="whsec_..." # Do webhook configurado
STRIPE_PRO_PLAN_PRICE_ID="price_..."

# Configurações padrão
STRIPE_WEBHOOK_TOLERANCE="300"
STRIPE_TIMEOUT="80000"
```

**Setup:**
```bash
# 1. Configurar webhook no Dashboard
npm run setup:stripe-webhooks

# 2. Testar health check
curl https://staging.seu-app.com/api/admin/stripe-health
```

### Produção

```bash
# .env.production
NODE_ENV="production"
NEXT_PUBLIC_APP_URL="https://seu-app.com"

# Stripe - Produção
STRIPE_SECRET_KEY="sk_live_51H..."
STRIPE_PUBLISHABLE_KEY="pk_live_51H..."
STRIPE_WEBHOOK_SECRET="whsec_..." # Do webhook de produção
STRIPE_PRO_PLAN_PRICE_ID="price_..." # Preço de produção

# Configurações otimizadas
STRIPE_WEBHOOK_TOLERANCE="300"
STRIPE_TIMEOUT="80000"
STRIPE_MAX_RETRIES="3"
```

**Setup:**
```bash
# 1. Ativar conta Stripe para produção
# 2. Configurar produtos de produção
npm run setup:stripe-products

# 3. Configurar webhooks de produção
npm run setup:stripe-webhooks

# 4. Verificar health check
curl https://seu-app.com/api/admin/stripe-health
```

## 🔍 Validação de Configuração

### Validação Automática

A aplicação valida automaticamente a configuração na inicialização:

```typescript
// src/lib/stripe.ts
import { validateStripeConfigOrThrow } from "./stripe-config-validator"

// Valida na inicialização
validateStripeConfigOrThrow()
```

### Validação Manual

```bash
# Testar configuração
npm run test:stripe-config

# Health check completo
npm run stripe:health

# Verificar via API
curl http://localhost:3000/api/admin/stripe-health
```

### Erros Comuns

| Erro | Causa | Solução |
|------|-------|---------|
| `STRIPE_SECRET_KEY não está definida` | Variável não configurada | Adicionar ao `.env` |
| `deve começar com 'sk_'` | Formato inválido | Verificar chave no Dashboard |
| `Webhook signature verification failed` | Secret incorreto | Reconfigurar webhook |
| `Price not found` | Preço não existe | Executar setup de produtos |

## 🚀 Scripts de Configuração

### Produtos e Preços

```bash
# Criar produtos automaticamente
npm run setup:stripe-products

# Listar produtos existentes
stripe products list
```

### Webhooks

```bash
# Configurar webhook automaticamente
npm run setup:stripe-webhooks

# Listar webhooks existentes
npm run setup:stripe-webhooks list

# Testar webhook manualmente
stripe trigger checkout.session.completed
```

### Testes

```bash
# Validar configuração
npm run test:stripe-config

# Health check
npm run stripe:health

# Testes de segurança
npm run test:security
```

## 📊 Monitoramento

### Health Check Endpoint

```bash
GET /api/admin/stripe-health
```

Retorna:
- Status da configuração
- Conectividade com API
- Status dos produtos/preços
- Status dos webhooks

### Logs

```bash
# Logs de webhook
tail -f logs/stripe-webhooks.log

# Logs de erro
tail -f logs/stripe-errors.log
```

### Métricas

- Taxa de sucesso de webhooks
- Tempo de resposta da API
- Falhas de pagamento
- Conversões de trial

## 🔒 Segurança

### Boas Práticas

1. **Separação de Ambientes**
   - Nunca use chaves de produção em desenvolvimento
   - Mantenha ambientes isolados

2. **Rotação de Chaves**
   - Rotacione chaves periodicamente
   - Monitore uso de chaves antigas

3. **Webhook Security**
   - Sempre valide assinatura
   - Use HTTPS em produção
   - Configure tolerância adequada

4. **Monitoramento**
   - Alerte sobre falhas
   - Monitore tentativas suspeitas
   - Log todas as transações

### Checklist de Segurança

- [ ] Chaves de produção seguras
- [ ] Webhooks com HTTPS
- [ ] Validação de assinatura ativa
- [ ] Rate limiting configurado
- [ ] Logs de auditoria ativos
- [ ] Monitoramento de falhas
- [ ] Backup das configurações

## 📚 Recursos

- [Stripe Dashboard](https://dashboard.stripe.com)
- [Documentação do Stripe](https://stripe.com/docs)
- [Stripe CLI](https://stripe.com/docs/stripe-cli)
- [Webhooks Guide](https://stripe.com/docs/webhooks)
- [Testing Guide](https://stripe.com/docs/testing)

## 🆘 Suporte

### Problemas Comuns

1. **Webhook não funciona**
   - Verificar URL acessível
   - Confirmar eventos configurados
   - Validar assinatura

2. **Pagamentos falham**
   - Verificar chaves corretas
   - Confirmar produtos ativos
   - Testar com cartões de teste

3. **Trial não funciona**
   - Verificar configuração do produto
   - Confirmar lógica de elegibilidade
   - Testar fluxo completo

### Contato

- Documentação interna: `docs/`
- Issues: GitHub Issues
- Slack: #stripe-integration