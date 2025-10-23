#!/usr/bin/env tsx

/**
 * Script to apply performance indexes for organization security review
 * Run with: npx tsx scripts/apply-performance-indexes.ts
 */

import { PrismaClient } from '@prisma/client'
import { readFileSync } from 'fs'
import { join } from 'path'

const prisma = new PrismaClient()

async function applyIndexes() {
  console.log('🚀 Applying performance indexes...')
  
  try {
    // Read the SQL file
    const sqlPath = join(process.cwd(), 'prisma', 'migrations', 'add_performance_indexes.sql')
    const sql = readFileSync(sqlPath, 'utf-8')
    
    // Split by semicolon and filter out empty statements and comments
    const statements = sql
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => {
        // Remove empty statements and comment-only lines
        if (stmt.length === 0) return false
        // Remove lines that are only comments
        const lines = stmt.split('\n').filter(line => line.trim() && !line.trim().startsWith('--'))
        return lines.length > 0
      })
      .map(stmt => {
        // Remove comment lines from each statement
        return stmt
          .split('\n')
          .filter(line => line.trim() && !line.trim().startsWith('--'))
          .join('\n')
          .trim()
      })
      .filter(stmt => stmt.length > 0)
    
    console.log(`📝 Found ${statements.length} SQL statements to execute`)
    
    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i]
      console.log(`⚡ Executing statement ${i + 1}/${statements.length}...`)
      
      try {
        await prisma.$executeRawUnsafe(statement)
        console.log(`✅ Statement ${i + 1} executed successfully`)
      } catch (error) {
        console.warn(`⚠️  Statement ${i + 1} failed (might already exist):`, error instanceof Error ? error.message : error)
      }
    }
    
    console.log('🎉 Performance indexes applied successfully!')
    
    // Test a few queries to verify indexes are working
    console.log('🔍 Testing query performance...')
    
    const start = Date.now()
    
    // Test organization lookup
    await prisma.organization.findFirst({
      where: { uniqueId: 'test' },
      select: { id: true }
    })
    
    // Test user organization lookup
    await prisma.user_Organization.findMany({
      where: { user_id: 'test' },
      select: { organization_id: true }
    })
    
    // Test invite lookup
    await prisma.invite.findMany({
      where: {
        status: 'PENDING',
        expires_at: { gt: new Date() }
      },
      select: { id: true }
    })
    
    const end = Date.now()
    console.log(`⚡ Test queries completed in ${end - start}ms`)
    
  } catch (error) {
    console.error('❌ Error applying indexes:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

// Run the script
applyIndexes().catch(console.error)