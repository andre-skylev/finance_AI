require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

async function verificarEstruturaBanco() {
  console.log('🔍 Verificando estrutura do banco de dados...')

  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    
    if (!supabaseUrl || !supabaseKey) {
      console.log('❌ Variáveis de ambiente não encontradas')
      return
    }

    const supabase = createClient(supabaseUrl, supabaseKey)

    // Verificar se a coluna receipt_id existe na tabela transactions
    console.log('\n1️⃣ Verificando coluna receipt_id na tabela transactions...')
    
    const { data: columns, error: columnsError } = await supabase
      .rpc('get_table_columns', { table_name: 'transactions' })
      .catch(() => {
        // Se a função não existir, usar uma query direta
        return supabase
          .from('information_schema.columns')
          .select('column_name, data_type, is_nullable')
          .eq('table_name', 'transactions')
          .eq('table_schema', 'public')
      })

    if (columnsError) {
      console.log('⚠️ Não foi possível verificar colunas via RPC, tentando query direta...')
      
      // Tentar inserir uma transação de teste para ver se a coluna existe
      const testTransaction = {
        user_id: '00000000-0000-0000-0000-000000000000', // UUID fictício
        account_id: '00000000-0000-0000-0000-000000000000',
        receipt_id: '00000000-0000-0000-0000-000000000000',
        amount: -1.00,
        description: 'Teste estrutura',
        transaction_date: new Date().toISOString().split('T')[0],
        currency: 'EUR',
        type: 'expense'
      }

      const { error: testError } = await supabase
        .from('transactions')
        .insert(testTransaction)
        .select()

      if (testError) {
        if (testError.message.includes('receipt_id')) {
          if (testError.message.includes('column') && testError.message.includes('does not exist')) {
            console.log('❌ PROBLEMA ENCONTRADO: Coluna receipt_id NÃO existe!')
            console.log('   A migração 015_add_receipt_id_to_transactions.sql não foi aplicada')
            console.log('   Execute: npx supabase db push ou aplique a migração manualmente')
          } else {
            console.log('✅ Coluna receipt_id existe (erro foi de dados/permissão)')
            console.log('   Erro:', testError.message)
          }
        } else {
          console.log('⚠️ Erro diferente (provavelmente coluna existe):', testError.message)
        }
      } else {
        console.log('✅ Coluna receipt_id existe e funciona')
      }
    } else {
      console.log('✅ Conseguiu acessar estrutura da tabela')
      const receiptIdColumn = columns?.find(col => col.column_name === 'receipt_id')
      
      if (receiptIdColumn) {
        console.log('✅ Coluna receipt_id encontrada:')
        console.log(`   Tipo: ${receiptIdColumn.data_type}`)
        console.log(`   Nullable: ${receiptIdColumn.is_nullable}`)
      } else {
        console.log('❌ Coluna receipt_id NÃO encontrada!')
        console.log('   Colunas disponíveis:', columns?.map(c => c.column_name).join(', '))
      }
    }

    console.log('\n2️⃣ Verificando tabela receipts...')
    
    const { data: receipts, error: receiptsError } = await supabase
      .from('receipts')
      .select('id, merchant_name, receipt_date')
      .limit(1)

    if (receiptsError) {
      console.log('❌ Erro ao acessar tabela receipts:', receiptsError.message)
    } else {
      console.log('✅ Tabela receipts acessível')
      console.log(`   Recibos na tabela: ${receipts?.length || 0}`)
    }

  } catch (error) {
    console.error('❌ Erro na verificação:', error.message)
  }
}

verificarEstruturaBanco()
