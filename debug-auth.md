# Debug - Autenticação Magic Link

## Checklist de Variáveis de Ambiente na Vercel

Verifique se todas essas variáveis estão configuradas na Vercel:

### ✅ Obrigatórias para Magic Link
- [ ] `AUTH_SECRET` - Chave secreta do NextAuth
- [ ] `RESEND_API_KEY` - API Key do Resend
- [ ] `EMAIL_FROM` - Email remetente (deve ser do domínio verificado no Resend)
- [ ] `NEXT_PUBLIC_APP_URL` - URL da aplicação (https://seu-dominio.vercel.app)
- [ ] `DATABASE_URL` - URL do banco de dados

### ✅ Opcionais mas Recomendadas
- [ ] `GOOGLE_CLIENT_ID` - Para login com Google
- [ ] `GOOGLE_CLIENT_SECRET` - Para login com Google

## Possíveis Problemas

### 1. EMAIL_FROM não verificado no Resend
- O email em `EMAIL_FROM` deve ser de um domínio verificado no Resend
- Se usando domínio próprio, verifique se está configurado corretamente
- Para teste, use: `onboarding@resend.dev` (domínio padrão do Resend)

### 2. NEXT_PUBLIC_APP_URL incorreta
- Deve ser a URL completa: `https://seu-app.vercel.app`
- Não deve ter barra no final
- Deve usar HTTPS em produção

### 3. AUTH_SECRET não configurada
- Gere com: `openssl rand -base64 32`
- Deve ser a mesma em todas as instâncias

### 4. RESEND_API_KEY inválida
- Verifique se a chave está ativa no painel do Resend
- Teste a chave fazendo uma requisição manual

## Teste Rápido

Execute este comando para testar as variáveis:

```bash
curl -X POST https://seu-app.vercel.app/api/auth/signin/resend \
  -H "Content-Type: application/json" \
  -d '{"email": "seu-email@gmail.com"}'
```

## Logs para Verificar

1. Vá para Vercel Dashboard > Seu Projeto > Functions
2. Procure por logs de erro nas funções de autenticação
3. Verifique se há erros relacionados a:
   - Resend API
   - Database connection
   - Missing environment variables