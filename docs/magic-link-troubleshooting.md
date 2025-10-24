# Magic Link - Guia de Solução de Problemas

## Erro "Configuration" ao tentar fazer login

### Causas Mais Comuns

#### 1. EMAIL_FROM não verificado no Resend

**Problema**: O email configurado em `EMAIL_FROM` não está verificado no Resend.

**Solução**:
```bash
# Para teste rápido, use o domínio padrão do Resend:
EMAIL_FROM="onboarding@resend.dev"

# Para produção, configure seu próprio domínio:
# 1. Vá para https://resend.com/domains
# 2. Adicione seu domínio
# 3. Configure os registros DNS
# 4. Aguarde verificação
# 5. Use: EMAIL_FROM="noreply@seudominio.com"
```

#### 2. NEXT_PUBLIC_APP_URL incorreta

**Problema**: URL da aplicação não está configurada corretamente.

**Solução**:
```bash
# Formato correto para Vercel:
NEXT_PUBLIC_APP_URL="https://seu-projeto.vercel.app"

# ❌ Formatos incorretos:
# NEXT_PUBLIC_APP_URL="seu-projeto.vercel.app"  # Sem https://
# NEXT_PUBLIC_APP_URL="https://seu-projeto.vercel.app/"  # Com barra final
# NEXT_PUBLIC_APP_URL="http://seu-projeto.vercel.app"  # HTTP em produção
```

#### 3. AUTH_SECRET não configurada

**Problema**: Chave secreta do NextAuth não está definida.

**Solução**:
```bash
# Gere uma chave secreta:
openssl rand -base64 32

# Adicione na Vercel:
AUTH_SECRET="sua_chave_gerada_aqui"
```

#### 4. RESEND_API_KEY inválida

**Problema**: API Key do Resend está incorreta ou expirada.

**Solução**:
1. Vá para https://resend.com/api-keys
2. Verifique se a chave está ativa
3. Se necessário, gere uma nova chave
4. Atualize na Vercel

### Verificação Rápida

#### 1. Teste o endpoint de debug

Acesse: `https://seu-app.vercel.app/api/debug/auth-config`

Deve retornar algo como:
```json
{
  "AUTH_SECRET": true,
  "RESEND_API_KEY": true,
  "EMAIL_FROM": true,
  "NEXT_PUBLIC_APP_URL": true,
  "DATABASE_URL": true,
  "allRequired": true,
  "resendApiWorking": true
}
```

#### 2. Verifique os logs da Vercel

1. Vá para Vercel Dashboard
2. Seu Projeto > Functions
3. Procure por erros nas funções de autenticação

#### 3. Teste manual do Resend

```bash
curl -X POST "https://api.resend.com/emails" \
  -H "Authorization: Bearer sua_resend_api_key" \
  -H "Content-Type: application/json" \
  -d '{
    "from": "onboarding@resend.dev",
    "to": ["seu-email@gmail.com"],
    "subject": "Teste",
    "html": "<p>Teste de configuração</p>"
  }'
```

### Configuração Passo a Passo na Vercel

#### 1. Variáveis de Ambiente Obrigatórias

Na Vercel Dashboard > Seu Projeto > Settings > Environment Variables:

```
AUTH_SECRET = [sua_chave_secreta]
RESEND_API_KEY = [sua_api_key_do_resend]
EMAIL_FROM = onboarding@resend.dev
NEXT_PUBLIC_APP_URL = https://seu-projeto.vercel.app
DATABASE_URL = [sua_url_do_banco]
```

#### 2. Redeploy após configurar

Após adicionar as variáveis:
1. Vá para Deployments
2. Clique nos 3 pontos do último deploy
3. Clique em "Redeploy"

### Problemas Específicos

#### Magic Link não chega no email

**Possíveis causas**:
1. Email está na pasta de spam
2. `EMAIL_FROM` não verificado no Resend
3. Domínio do Resend não configurado
4. Rate limit do Resend atingido

**Soluções**:
1. Verifique spam/lixo eletrônico
2. Use `onboarding@resend.dev` temporariamente
3. Configure domínio próprio no Resend
4. Aguarde alguns minutos e tente novamente

#### Erro "Invalid URL" no magic link

**Causa**: `NEXT_PUBLIC_APP_URL` incorreta

**Solução**: Verifique se a URL está exatamente como:
```
https://seu-projeto.vercel.app
```

#### Erro de CORS

**Causa**: Configuração de cookies ou domínio

**Solução**: Verifique se `NEXT_PUBLIC_APP_URL` corresponde ao domínio real

### Teste Completo

Para testar se tudo está funcionando:

1. **Acesse**: `https://seu-app.vercel.app/api/debug/auth-config`
2. **Verifique**: Se `allRequired: true`
3. **Teste login**: Vá para `/login` e tente fazer login
4. **Verifique logs**: Na Vercel Dashboard
5. **Verifique email**: Incluindo pasta de spam

### Configuração de Desenvolvimento vs Produção

#### Desenvolvimento (.env.local)
```bash
AUTH_SECRET="sua_chave_local"
RESEND_API_KEY="re_test_..."
EMAIL_FROM="onboarding@resend.dev"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
DATABASE_URL="postgresql://..."
```

#### Produção (Vercel)
```bash
AUTH_SECRET="sua_chave_producao"
RESEND_API_KEY="re_live_..."
EMAIL_FROM="noreply@seudominio.com"  # Domínio verificado
NEXT_PUBLIC_APP_URL="https://seu-app.vercel.app"
DATABASE_URL="postgresql://..."  # Banco de produção
```

### Contato para Suporte

Se o problema persistir:

1. **Logs da Vercel**: Copie os logs de erro
2. **Configuração**: Screenshot das variáveis de ambiente (sem expor secrets)
3. **Teste**: Resultado do `/api/debug/auth-config`
4. **Comportamento**: Descreva exatamente o que acontece

---

**Dica**: Sempre teste primeiro com `EMAIL_FROM="onboarding@resend.dev"` antes de configurar domínio próprio.