require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

async function verificarTransacoesExistentes() {
  console.log('🔍 Verificando transações existentes...')

  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Buscar transações recentes
    const { data: transactions, error: txError } = await supabase
      .from('transactions')
      .select('id, receipt_id, description, amount, created_at')
      .order('created_at', { ascending: false })
      .limit(10)

    if (txError) {
      console.log('❌ Erro ao buscar transações:', txError.message)
      return
    }

    console.log(`📊 Total de transações recentes: ${transactions?.length || 0}`)
    
    if (transactions && transactions.length > 0) {
      const comReceiptId = transactions.filter(t => t.receipt_id !== null)
      const semReceiptId = transactions.filter(t => t.receipt_id === null)
      
      console.log(`✅ Com receipt_id: ${comReceiptId.length}`)
      console.log(`❌ Sem receipt_id: ${semReceiptId.length}`)
      
      console.log('\n📋 Últimas transações:')
      transactions.slice(0, 5).forEach((t, i) => {
        console.log(`  ${i + 1}. ${t.description} - €${t.amount}`)
        console.log(`     Receipt ID: ${t.receipt_id || 'NULL'}`)
        console.log(`     Criada: ${t.created_at}`)
        console.log()
      })
    }

    // Buscar recibos existentes
    const { data: receipts, error: recError } = await supabase
      .from('receipts')
      .select('id, merchant_name, receipt_date, total')
      .order('created_at', { ascending: false })
      .limit(5)

    if (recError) {
      console.log('❌ Erro ao buscar recibos:', recError.message)
    } else {
      console.log(`🧾 Total de recibos: ${receipts?.length || 0}`)
      
      if (receipts && receipts.length > 0) {
        console.log('\n🏪 Últimos recibos:')
        receipts.forEach((r, i) => {
          console.log(`  ${i + 1}. ${r.merchant_name} - €${r.total}`)
          console.log(`     Data: ${r.receipt_date}`)
          console.log(`     ID: ${r.id}`)
          console.log()
        })
      }
    }

  } catch (error) {
    console.error('❌ Erro:', error.message)
  }
}

verificarTransacoesExistentes()
