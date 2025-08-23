require('dotenv').config({ path: '.env.local' })

async function testarTransacoesSimples() {
  console.log('🧪 Teste simples: salvamento de transações de recibo...')

  try {
    const BASE_URL = 'http://localhost:3000'

    // Simular dados de transações extraídas de um recibo
    const testData = {
      target: 'rec',
      transactions: [
        {
          description: 'Pão integral',
          amount: 2.50,
          date: '2025-08-23',
          suggestedCategory: 'Supermercado'
        },
        {
          description: 'Leite',
          amount: 1.80,
          date: '2025-08-23',
          suggestedCategory: 'Supermercado'
        }
      ],
      receipts: [
        {
          merchant: 'Supermercado Teste',
          date: '2025-08-23',
          total: 4.30
        }
      ]
    }

    console.log('📤 Enviando dados de teste para /api/pdf-confirm...')
    
    const response = await fetch(`${BASE_URL}/api/pdf-confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testData)
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.log('❌ Erro HTTP:', response.status)
      console.log('📄 Resposta:', errorText)
      return
    }

    const result = await response.json()
    console.log('✅ Resposta recebida:')
    console.log('📊 Resultado:', JSON.stringify(result, null, 2))
    
    if (result.transactionsSaved > 0) {
      console.log('\n🎉 SUCESSO! Transações de recibo foram salvas!')
      console.log(`💰 ${result.transactionsSaved} transações salvas`)
      console.log(`🧾 ${result.receiptsSaved} recibos salvos`)
    } else {
      console.log('\n⚠️ Nenhuma transação foi salva')
    }

  } catch (error) {
    console.error('❌ Erro:', error.message)
  }
}

testarTransacoesSimples()
