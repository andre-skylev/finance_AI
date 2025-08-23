require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

async function verificarColunaReceiptId() {
  console.log('🔍 Verificando se coluna receipt_id existe...')

  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    
    if (!supabaseUrl || !supabaseKey) {
      console.log('❌ Variáveis de ambiente não encontradas')
      return
    }

    const supabase = createClient(supabaseUrl, supabaseKey)

    // Tentar fazer um SELECT simples incluindo receipt_id
    console.log('📋 Testando SELECT com receipt_id...')
    
    const { data, error } = await supabase
      .from('transactions')
      .select('id, receipt_id, description, amount')
      .limit(1)

    if (error) {
      if (error.message.includes('receipt_id') && error.message.includes('does not exist')) {
        console.log('❌ PROBLEMA CONFIRMADO: Coluna receipt_id NÃO existe!')
        console.log('   📋 A migração não foi aplicada corretamente')
        console.log('   🔧 Solução: Execute a migração SQL manualmente')
        
        console.log('\n📝 SQL para executar:')
        console.log('ALTER TABLE transactions ADD COLUMN receipt_id uuid REFERENCES receipts(id) ON DELETE SET NULL;')
        console.log('CREATE INDEX idx_transactions_receipt_id ON transactions(receipt_id);')
        
      } else {
        console.log('⚠️ Erro diferente:', error.message)
      }
    } else {
      console.log('✅ SUCESSO: Coluna receipt_id existe!')
      console.log('   📊 Transações encontradas:', data?.length || 0)
      
      if (data && data.length > 0) {
        const withReceiptId = data.filter(t => t.receipt_id !== null)
        console.log(`   🔗 Com receipt_id: ${withReceiptId.length}`)
        console.log(`   ❌ Sem receipt_id: ${data.length - withReceiptId.length}`)
        
        if (withReceiptId.length > 0) {
          console.log('   📄 Exemplo com receipt_id:', withReceiptId[0])
        }
      }
    }

  } catch (error) {
    console.error('❌ Erro:', error.message)
  }
}

verificarColunaReceiptId()
