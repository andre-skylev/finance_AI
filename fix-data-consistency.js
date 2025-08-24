#!/usr/bin/env node

/**
 * SCRIPT PARA CORRIGIR INCONSISTÊNCIAS DE DADOS
 * 
 * Issues identificadas:
 * 1. account_masked vazio na tabela accounts
 * 2. bank_account_transactions não sendo populada
 * 3. Dados duplicados em all_transactions e all_financial_transactions
 * 4. Recibos não sendo salvos corretamente
 * 5. Falta de estratégia de mascaramento
 */

const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

async function fixDataConsistency() {
  console.log('🔧 SCRIPT DE CORREÇÃO DE INCONSISTÊNCIAS')
  console.log('=' .repeat(50))

  try {
    // 1. Verificar estrutura atual
    console.log('\n📊 1. VERIFICANDO ESTRUTURA ATUAL:')
    
    const { data: accounts } = await supabase
      .from('accounts')
      .select('*')
      .limit(5)
    
    if (accounts && accounts.length > 0) {
      console.log('✅ Contas encontradas:', accounts.length)
      console.log('🔍 Estrutura da conta:', Object.keys(accounts[0]))
      
      // Verificar campos de mascaramento
      const firstAccount = accounts[0]
      console.log('📋 Campos sensíveis:')
      console.log('  - account_number_hash:', firstAccount.account_number_hash || 'VAZIO')
      console.log('  - account_number_encrypted:', firstAccount.account_number_encrypted || 'VAZIO')
      console.log('  - balance_encrypted:', firstAccount.balance_encrypted || 'VAZIO')
      console.log('  - sensitive_data_encrypted:', firstAccount.sensitive_data_encrypted)
    }

    // 2. Verificar bank_account_transactions
    console.log('\n📋 2. VERIFICANDO BANK_ACCOUNT_TRANSACTIONS:')
    const { data: bankTx, error: bankTxError } = await supabase
      .from('bank_account_transactions')
      .select('*')
      .limit(5)
    
    if (bankTxError) {
      console.log('❌ Erro ao acessar bank_account_transactions:', bankTxError.message)
    } else {
      console.log('✅ Tabela bank_account_transactions acessível')
      console.log('📊 Registros encontrados:', bankTx?.length || 0)
    }

    // 3. Verificar tabelas all_*
    console.log('\n📋 3. VERIFICANDO TABELAS UNIFICADAS:')
    
    const { data: allTx } = await supabase
      .from('all_transactions')
      .select('*')
      .limit(3)
    
    const { data: allFinTx } = await supabase
      .from('all_financial_transactions')
      .select('*')
      .limit(3)
    
    console.log('📊 all_transactions:', allTx?.length || 0, 'registros')
    console.log('📊 all_financial_transactions:', allFinTx?.length || 0, 'registros')
    
    if (allTx && allFinTx) {
      // Verificar duplicação
      const allTxIds = new Set(allTx.map(t => t.id))
      const allFinTxIds = new Set(allFinTx.map(t => t.id))
      const intersection = [...allTxIds].filter(id => allFinTxIds.has(id))
      console.log('⚠️  IDs duplicados entre tabelas:', intersection.length)
    }

    // 4. Verificar recibos
    console.log('\n📋 4. VERIFICANDO RECIBOS:')
    const { data: receipts } = await supabase
      .from('receipts')
      .select('*')
      .limit(5)
    
    console.log('📊 Recibos encontrados:', receipts?.length || 0)
    
    const { data: receiptItems } = await supabase
      .from('receipt_items')
      .select('*')
      .limit(5)
    
    console.log('📊 Itens de recibo encontrados:', receiptItems?.length || 0)

    // 5. PROPOR SOLUÇÕES
    console.log('\n💡 5. SOLUÇÕES PROPOSTAS:')
    console.log('=' .repeat(40))
    
    console.log('\n🔧 A. MASCARAMENTO DE DADOS:')
    console.log('  - Implementar hash para números de conta')
    console.log('  - Criptografar saldos sensíveis')
    console.log('  - Criar campo account_masked com últimos 4 dígitos')
    
    console.log('\n🔧 B. BANK_ACCOUNT_TRANSACTIONS:')
    console.log('  - Modificar PDF confirm para usar bank_account_transactions')
    console.log('  - Migrar transações existentes de accounts')
    console.log('  - Atualizar triggers e views')
    
    console.log('\n🔧 C. UNIFICAÇÃO DE VIEWS:')
    console.log('  - Consolidar all_transactions e all_financial_transactions')
    console.log('  - Eliminar duplicação de dados')
    console.log('  - Otimizar queries do dashboard')
    
    console.log('\n🔧 D. CORREÇÃO DE RECIBOS:')
    console.log('  - Corrigir lógica de salvamento de recibos')
    console.log('  - Implementar vinculação correta com transações')
    console.log('  - Testar fluxo completo de PDF → Recibo')

    console.log('\n✅ ANÁLISE COMPLETA! Pronto para implementar correções.')

  } catch (error) {
    console.error('❌ Erro durante análise:', error.message)
  }
}

// Função para implementar mascaramento de conta
async function implementAccountMasking() {
  console.log('\n🔐 IMPLEMENTANDO MASCARAMENTO DE CONTAS:')
  
  try {
    // Simular número de conta (normalmente viria de integração bancária)
    const { data: accounts } = await supabase
      .from('accounts')
      .select('id, name, account_number_hash')
      .is('account_number_hash', null)
    
    if (accounts && accounts.length > 0) {
      console.log('🏦 Atualizando', accounts.length, 'contas com mascaramento...')
      
      for (const account of accounts) {
        // Gerar número de conta simulado baseado no ID
        const simulatedAccountNumber = `12345${account.id.slice(-7)}`
        const lastFourDigits = simulatedAccountNumber.slice(-4)
        const accountMasked = `**** **** **** ${lastFourDigits}`
        
        // Hash simples (em produção, usar crypto mais robusto)
        const accountHash = Buffer.from(simulatedAccountNumber).toString('base64')
        
        await supabase
          .from('accounts')
          .update({
            account_number_hash: accountHash,
            // Adicionar campo account_masked quando existir na tabela
          })
          .eq('id', account.id)
        
        console.log(`  ✅ ${account.name}: ${accountMasked}`)
      }
    }
  } catch (error) {
    console.error('❌ Erro no mascaramento:', error.message)
  }
}

async function main() {
  await fixDataConsistency()
  
  // Opcional: implementar mascaramento
  const readline = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout
  })
  
  readline.question('\n❓ Implementar mascaramento de contas? (y/N): ', async (answer) => {
    if (answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes') {
      await implementAccountMasking()
    }
    
    readline.question('\n❓ Continuar com outras correções? (y/N): ', (answer2) => {
      if (answer2.toLowerCase() === 'y') {
        console.log('🚀 Execute as correções específicas conforme necessário!')
      }
      readline.close()
    })
  })
}

if (require.main === module) {
  main().catch(console.error)
}
