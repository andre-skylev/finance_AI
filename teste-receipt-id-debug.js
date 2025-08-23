require('dotenv').config({ path: '.env.local' })

async function testarReceiptIdDebug() {
  console.log('🐛 Debug: Testando salvamento com receipt_id...')

  try {
    const BASE_URL = 'http://localhost:3001'

    // Dados exatos que seriam enviados pelo pdf-upload
    const testData = {
      target: 'rec',
      transactions: [
        {
          description: 'Pão de forma integral',
          amount: 2.50,
          date: '2025-08-23',
          suggestedCategory: 'Supermercado - Padaria'
        },
        {
          description: 'Leite meio gordo 1L',
          amount: 1.80,
          date: '2025-08-23',
          suggestedCategory: 'Supermercado - Cesta Básica'
        }
      ],
      receipts: [
        {
          merchant: 'Continente Matosinhos',
          date: '2025-08-23',
          subtotal: 3.87,
          tax: 0.43,
          total: 4.30,
          items: [
            {
              description: 'Pão de forma integral',
              quantity: 1,
              unitPrice: 2.50,
              total: 2.50,
              code: 'PAO001'
            },
            {
              description: 'Leite meio gordo 1L',
              quantity: 1,
              unitPrice: 1.80,
              total: 1.80,
              code: 'LEI002'
            }
          ]
        }
      ]
    }

    console.log('📤 Enviando dados para /api/pdf-confirm...')
    console.log('📊 Dados enviados:')
    console.log(`   - ${testData.transactions.length} transações`)
    console.log(`   - ${testData.receipts.length} recibos`)
    console.log(`   - Target: ${testData.target}`)
    
    const response = await fetch(`${BASE_URL}/api/pdf-confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testData)
    })

    console.log(`\n📨 Status da resposta: ${response.status}`)
    
    if (!response.ok) {
      const errorText = await response.text()
      console.log('❌ Erro HTTP:', errorText)
      
      if (response.status === 401) {
        console.log('\n💡 ISSO É ESPERADO: Erro 401 = precisa de autenticação')
        console.log('   Mas os logs do servidor devem aparecer no terminal do "npm run dev"')
        console.log('   Verifique o terminal onde está rodando o servidor Next.js')
      }
      return
    }

    const result = await response.json()
    console.log('✅ Resposta recebida:')
    console.log(JSON.stringify(result, null, 2))

  } catch (error) {
    console.error('❌ Erro no teste:', error.message)
  }
}

testarReceiptIdDebug()
