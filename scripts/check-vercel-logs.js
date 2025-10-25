#!/usr/bin/env node

/**
 * Script para verificar logs da Vercel
 * 
 * Uso:
 * 1. Instale a Vercel CLI: npm i -g vercel
 * 2. Faça login: vercel login
 * 3. Execute: node scripts/check-vercel-logs.js
 */

const { execSync } = require('child_process');

console.log('🔍 Verificando logs da Vercel...\n');

try {
  // Verificar se a Vercel CLI está instalada
  try {
    execSync('vercel --version', { stdio: 'pipe' });
  } catch (error) {
    console.error('❌ Vercel CLI não está instalada.');
    console.log('📦 Instale com: npm i -g vercel');
    process.exit(1);
  }

  // Obter informações do projeto
  console.log('📋 Informações do projeto:');
  try {
    const projectInfo = execSync('vercel project ls', { encoding: 'utf8' });
    console.log(projectInfo);
  } catch (error) {
    console.log('⚠️  Execute "vercel" no diretório do projeto primeiro');
  }

  // Obter logs recentes
  console.log('\n📊 Logs recentes (últimos 100):');
  try {
    const logs = execSync('vercel logs --limit 100', { encoding: 'utf8' });
    console.log(logs);
  } catch (error) {
    console.error('❌ Erro ao obter logs:', error.message);
  }

  // Obter logs de build
  console.log('\n🏗️  Logs de build:');
  try {
    const buildLogs = execSync('vercel logs --limit 50 --since 1h', { encoding: 'utf8' });
    console.log(buildLogs);
  } catch (error) {
    console.error('❌ Erro ao obter logs de build:', error.message);
  }

  // Comandos úteis
  console.log('\n🛠️  Comandos úteis:');
  console.log('vercel logs --follow          # Logs em tempo real');
  console.log('vercel logs --since 1h        # Logs da última hora');
  console.log('vercel logs --limit 200       # Mais logs');
  console.log('vercel inspect <deployment>   # Inspecionar deployment específico');

} catch (error) {
  console.error('❌ Erro:', error.message);
  process.exit(1);
}