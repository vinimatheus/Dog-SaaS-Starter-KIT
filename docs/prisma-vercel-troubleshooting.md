# Prisma + Vercel - Guia de Solução de Problemas

## Erro: "Prisma Client could not locate the Query Engine"

### Causa
O Prisma Query Engine não está sendo incluído corretamente no build da Vercel devido a incompatibilidades de runtime.

### Soluções Implementadas

#### 1. Binary Targets Configurados
```prisma
generator client {
  provider = "prisma-client-js"
  binaryTargets = ["native", "rhel-openssl-1.0.x", "rhel-openssl-3.0.x"]
}
```

#### 2. Script de Build Otimizado
```bash
# scripts/vercel-build.sh
npm install --legacy-peer-deps
npx prisma generate
npx prisma db push --accept-data-loss  # Apenas para preview
npx next build
```

#### 3. Configuração do Next.js
```typescript
// next.config.ts
webpack: (config, { isServer }) => {
  if (isServer) {
    config.externals.push({
      '@prisma/client': 'commonjs @prisma/client',
    });
  }
  return config;
}
```

#### 4. Configuração da Vercel
```json
// vercel.json
{
  "build": {
    "env": {
      "PRISMA_GENERATE_SKIP_AUTOINSTALL": "true"
    }
  },
  "installCommand": "npm install --legacy-peer-deps && npx prisma generate"
}
```

### Verificação Pós-Deploy

#### 1. Verifique os Logs de Build
- Vá para Vercel Dashboard > Seu Projeto > Deployments
- Clique no deployment mais recente
- Verifique se "Generating Prisma client..." aparece nos logs

#### 2. Teste a Conexão com o Banco
```bash
# Acesse este endpoint após o deploy:
https://seu-app.vercel.app/api/debug/auth-config
```

#### 3. Variáveis de Ambiente Necessárias
```
DATABASE_URL=postgresql://...
AUTH_SECRET=sua_chave_secreta
RESEND_API_KEY=re_...
EMAIL_FROM=onboarding@resend.dev
NEXT_PUBLIC_APP_URL=https://seu-app.vercel.app
```

### Problemas Comuns e Soluções

#### Erro: "Database connection failed"
**Causa**: URL do banco incorreta ou banco inacessível
**Solução**: 
1. Verifique se `DATABASE_URL` está correta
2. Teste conexão com o banco externamente
3. Verifique se o banco permite conexões externas

#### Erro: "Migration failed"
**Causa**: Schema não sincronizado
**Solução**:
```bash
# Execute localmente primeiro:
npx prisma db push
npx prisma generate

# Depois faça o deploy
```

#### Build Timeout
**Causa**: Build muito longo
**Solução**: Otimizar dependências e usar cache
```json
// vercel.json
{
  "functions": {
    "src/app/api/**/*.ts": {
      "maxDuration": 30
    }
  }
}
```

### Comandos de Debug

#### Local
```bash
# Gerar cliente Prisma
npx prisma generate

# Verificar schema
npx prisma validate

# Testar conexão
npx prisma db pull --print
```

#### Vercel
```bash
# Forçar redeploy
vercel --prod

# Ver logs em tempo real
vercel logs seu-app.vercel.app
```

### Checklist de Deploy

- [ ] `DATABASE_URL` configurada na Vercel
- [ ] Binary targets incluídos no schema.prisma
- [ ] Script vercel-build.sh executável
- [ ] Todas as variáveis de ambiente configuradas
- [ ] Schema sincronizado com o banco
- [ ] Build local funcionando

### Alternativas se o Problema Persistir

#### 1. Usar Prisma Data Platform
```bash
# Configure Prisma Accelerate
npx prisma generate --accelerate
```

#### 2. Build Manual
```bash
# No package.json
"vercel-build": "npm ci && npx prisma generate && npx next build"
```

#### 3. Serverless Functions Separadas
Mover operações do Prisma para funções serverless dedicadas.

### Monitoramento

#### Logs de Produção
```bash
# Ver logs da Vercel
vercel logs --follow

# Filtrar erros do Prisma
vercel logs | grep -i prisma
```

#### Health Check
Endpoint: `/api/debug/auth-config`
- Deve retornar status das configurações
- Inclui teste de conexão com banco

---

**Nota**: Após implementar essas correções, faça um redeploy completo na Vercel para garantir que todas as configurações sejam aplicadas.