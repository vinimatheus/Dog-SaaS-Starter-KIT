# Configurações de Segurança

## Magic Link - Logs de Desenvolvimento

### ⚠️ IMPORTANTE: Segurança em Produção

O sistema está configurado para **NUNCA** exibir magic links no terminal em produção.

### Como funciona:

#### 🟢 Desenvolvimento (`NODE_ENV=development`)
- Magic links aparecem no terminal para facilitar testes
- Logs detalhados de autenticação são exibidos
- Exemplo: `🔗 Magic Link (DEV ONLY): https://...`

#### 🔴 Produção (`NODE_ENV=production`)
- **NENHUM** magic link é exibido no terminal
- Logs de autenticação são suprimidos
- Links são enviados APENAS por email

### Arquivos protegidos:
- `src/auth.config.ts` - Configuração do NextAuth
- `src/auth.ts` - Callbacks e eventos de autenticação

### Verificação:
Para confirmar que está funcionando corretamente:

1. **Em desenvolvimento**: `npm run dev`
   - Magic links aparecem no terminal
   
2. **Em produção**: `NODE_ENV=production npm start`
   - Magic links NÃO aparecem no terminal
   - Apenas logs de erro são mantidos

### Código de segurança:
```typescript
// SEGURANÇA: Log do magic link apenas em desenvolvimento
if (process.env.NODE_ENV === 'development') {
  console.log("🔗 Magic Link (DEV ONLY):", url);
}
```

Esta configuração garante que informações sensíveis nunca vazem em logs de produção.