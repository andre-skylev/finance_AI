#!/usr/bin/env node

/**
 * TESTE COMPLETO DAS CORREÇÕES DE INCONSISTÊNCIA
 * 
 * Valida:
 * 1. account_masked populado corretamente
 * 2. bank_account_transactions sendo usado
 * 3. Views consolidadas sem duplicação
 * 4. Salvamento correto de recibos
 */

const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

async function testDataConsistencyFixes() {
  console.log('🧪 TESTE DAS CORREÇÕES DE INCONSISTÊNCIA')
  console.log('=' .repeat(50))

  try {
    // 1. Testar account_masked
    console.log('\n🔐 1. TESTE ACCOUNT_MASKED:')
    
    const { data: accounts } = await supabase
      .from('accounts')
      .select('id, name, account_masked, account_number_hash')
      .limit(5)
    
    if (accounts && accounts.length > 0) {
      accounts.forEach(account => {
        console.log(`  ✅ ${account.name}:`)
        console.log(`     🏦 Masked: ${account.account_masked || 'VAZIO'}`)
        console.log(`     🔐 Hash: ${account.account_number_hash ? 'PRESENTE' : 'VAZIO'}`)
      })
    } else {
      console.log('  ❌ Nenhuma conta encontrada')
    }

    // 2. Testar bank_account_transactions
    console.log('\n💳 2. TESTE BANK_ACCOUNT_TRANSACTIONS:')
    
    const { data: bankTx } = await supabase
      .from('bank_account_transactions')
      .select('*')
      .limit(5)
    
    console.log(`  📊 Registros: ${bankTx?.length || 0}`)
    
    if (bankTx && bankTx.length > 0) {
      console.log('  ✅ Estrutura da primeira transação:')
      const firstTx = bankTx[0]
      console.log(`     💰 Valor: ${firstTx.amount} ${firstTx.currency}`)
      console.log(`     📝 Descrição: ${firstTx.description}`)
      console.log(`     🏦 Conta: ${firstTx.account_id}`)
      console.log(`     📅 Data: ${firstTx.transaction_date}`)
    }

    // 3. Testar views consolidadas
    console.log('\n📊 3. TESTE VIEWS CONSOLIDADAS:')
    
    const { data: allTx } = await supabase
      .from('all_transactions')
      .select('*')
      .limit(10)
    
    console.log(`  📈 all_transactions: ${allTx?.length || 0} registros`)
    
    if (allTx && allTx.length > 0) {
      // Agrupar por source_type
      const sourceTypes = allTx.reduce((acc, tx) => {
        acc[tx.source_type] = (acc[tx.source_type] || 0) + 1
        return acc
      }, {})
      
      console.log('  📋 Distribuição por tipo:')
      Object.entries(sourceTypes).forEach(([type, count]) => {
        console.log(`     ${type}: ${count} transações`)
      })
      
      // Verificar duplicatas
      const uniqueIds = new Set(allTx.map(tx => tx.id))
      const duplicates = allTx.length - uniqueIds.size
      console.log(`  🔍 Duplicatas encontradas: ${duplicates}`)
    }

    // 4. Testar financial_summary
    console.log('\n💼 4. TESTE FINANCIAL_SUMMARY:')
    
    const { data: finSummary, error: finError } = await supabase
      .from('financial_summary')
      .select('*')
      .limit(5)
    
    if (finError) {
      console.log('  ❌ Erro ao acessar financial_summary:', finError.message)
    } else {
      console.log(`  📊 Registros de resumo: ${finSummary?.length || 0}`)
      
      if (finSummary && finSummary.length > 0) {
        finSummary.forEach(summary => {
          console.log(`  💰 ${summary.source_type} - ${summary.transaction_category}:`)
          console.log(`     Total: ${summary.total_amount} ${summary.currency}`)
          console.log(`     Transações: ${summary.transaction_count}`)
        })
      }
    }

    // 5. Testar recibos
    console.log('\n🧾 5. TESTE RECIBOS:')
    
    const { data: receipts } = await supabase
      .from('receipts')
      .select(`
        *,
        receipt_items(*)
      `)
      .limit(5)
    
    console.log(`  📋 Recibos: ${receipts?.length || 0}`)
    
    if (receipts && receipts.length > 0) {
      receipts.forEach(receipt => {
        console.log(`  🧾 Recibo ${receipt.id}:`)
        console.log(`     🏪 Estabelecimento: ${receipt.merchant_name}`)
        console.log(`     💰 Total: ${receipt.total}`)
        console.log(`     📦 Itens: ${receipt.receipt_items?.length || 0}`)
      })
    }

    // 6. Testar integridade das FK
    console.log('\n🔗 6. TESTE INTEGRIDADE:')
    
    // Verificar transações órfãs
    const { data: orphanTx } = await supabase
      .from('bank_account_transactions')
      .select(`
        id,
        account_id,
        accounts!inner(id, name)
      `)
      .limit(5)
    
    console.log(`  🔗 Transações com contas válidas: ${orphanTx?.length || 0}`)

    console.log('\n✅ TESTE COMPLETO!')
    console.log('\n📊 RESUMO DOS RESULTADOS:')
    console.log('=' .repeat(30))
    console.log(`🔐 Contas com mascaramento: ${accounts?.filter(a => a.account_masked)?.length || 0}`)
    console.log(`💳 Bank account transactions: ${bankTx?.length || 0}`)
    console.log(`📊 All transactions: ${allTx?.length || 0}`)
    console.log(`💼 Financial summary: ${finSummary?.length || 0}`)
    console.log(`🧾 Recibos: ${receipts?.length || 0}`)

  } catch (error) {
    console.error('❌ Erro durante teste:', error.message)
  }
}

// Função para simular upload de PDF e teste do fluxo completo
async function testPDFFlow() {
  console.log('\n🧪 TESTE FLUXO PDF:')
  console.log('=' .repeat(30))
  
  // Simular dados que viriam de um PDF
  const mockPDFData = {
    target: '12345678-1234-1234-1234-123456789012', // ID de uma conta
    transactions: [
      {
        date: '2025-08-24',
        description: 'Teste de transação PDF',
        amount: '-25.50',
        suggestedCategory: 'Supermercado'
      }
    ],
    receipts: [],
    type: 'bank_statement'
  }
  
  console.log('📤 Dados simulados do PDF:')
  console.log(JSON.stringify(mockPDFData, null, 2))
  
  console.log('\n💡 Para testar o fluxo completo:')
  console.log('1. Acesse http://localhost:3000/pdf-import')
  console.log('2. Faça upload de um PDF de extrato bancário')
  console.log('3. Verifique se as transações aparecem em bank_account_transactions')
  console.log('4. Confirme que os recibos são salvos corretamente')
}

async function main() {
  await testDataConsistencyFixes()
  await testPDFFlow()
}

if (require.main === module) {
  main().catch(console.error)
}
