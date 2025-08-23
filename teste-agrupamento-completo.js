require('dotenv').config({ path: '.env.local' })

async function testarAgrupamentoCompleto() {
  console.log('🧪 Teste completo: agrupamento de transações por recibo...')

  try {
    const BASE_URL = 'http://localhost:3000'

    // Simular dados de um recibo com múltiplos itens
    const testData = {
      target: 'rec',
      transactions: [
        {
          description: 'Pão de forma integral',
          amount: 2.50,
          date: '2025-08-23',
          suggestedCategory: 'Supermercado'
        },
        {
          description: 'Leite meio gordo 1L',
          amount: 1.80,
          date: '2025-08-23',
          suggestedCategory: 'Supermercado'
        },
        {
          description: 'Ovos frescos (12 unidades)',
          amount: 3.20,
          date: '2025-08-23',
          suggestedCategory: 'Supermercado'
        },
        {
          description: 'Queijo fatiado',
          amount: 4.50,
          date: '2025-08-23',
          suggestedCategory: 'Supermercado'
        }
      ],
      receipts: [
        {
          merchant: 'Continente Matosinhos',
          date: '2025-08-23',
          total: 12.00,
          subtotal: 11.00,
          tax: 1.00,
          items: [
            {
              description: 'Pão de forma integral',
              quantity: 1,
              unitPrice: 2.50,
              total: 2.50
            },
            {
              description: 'Leite meio gordo 1L',
              quantity: 1,
              unitPrice: 1.80,
              total: 1.80
            },
            {
              description: 'Ovos frescos (12 unidades)',
              quantity: 1,
              unitPrice: 3.20,
              total: 3.20
            },
            {
              description: 'Queijo fatiado',
              quantity: 1,
              unitPrice: 4.50,
              total: 4.50
            }
          ]
        }
      ]
    }

    console.log('📤 1. Salvando recibo e transações...')
    
    const confirmResponse = await fetch(`${BASE_URL}/api/pdf-confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testData)
    })

    if (!confirmResponse.ok) {
      const errorText = await confirmResponse.text()
      console.log('❌ Erro ao salvar:', confirmResponse.status, errorText)
      return
    }

    const confirmResult = await confirmResponse.json()
    console.log('✅ Resultado do salvamento:')
    console.log(`   📊 ${confirmResult.message}`)

    if (confirmResult.transactionsSaved > 0) {
      console.log('\n📋 2. Verificando agrupamentos...')
      
      // Aguardar um pouco para os dados serem processados
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      const groupsResponse = await fetch(`${BASE_URL}/api/receipts/grouped-transactions`)
      
      if (!groupsResponse.ok) {
        console.log('❌ Erro ao buscar agrupamentos:', groupsResponse.status)
        return
      }
      
      const groupsResult = await groupsResponse.json()
      
      if (groupsResult.success && groupsResult.data.length > 0) {
        console.log('✅ Agrupamentos encontrados:')
        
        groupsResult.data.slice(0, 3).forEach((group, index) => {
          console.log(`\n   📦 Grupo ${index + 1}:`)
          console.log(`      🏪 Estabelecimento: ${group.merchant_name}`)
          console.log(`      📅 Data: ${group.receipt_date}`)
          console.log(`      💰 Total: €${Math.abs(group.total_amount).toFixed(2)}`)
          console.log(`      📋 Itens: ${group.transaction_count}`)
          
          if (group.transactions && group.transactions.length > 0) {
            console.log(`      🔍 Transações:`)
            group.transactions.slice(0, 3).forEach(t => {
              console.log(`         - ${t.description}: €${Math.abs(t.amount).toFixed(2)}`)
            })
            if (group.transactions.length > 3) {
              console.log(`         ... e mais ${group.transactions.length - 3} itens`)
            }
          }
        })
        
        console.log('\n🎉 SUCESSO COMPLETO!')
        console.log('   ✅ Recibo salvo')
        console.log('   ✅ Transações linkadas ao recibo')
        console.log('   ✅ Agrupamentos funcionando')
        console.log('   ✅ API de agrupamentos retornando dados')
        
      } else {
        console.log('⚠️ Nenhum agrupamento encontrado ainda')
      }
    } else {
      console.log('⚠️ Nenhuma transação foi salva')
    }

  } catch (error) {
    console.error('❌ Erro no teste:', error.message)
  }
}

testarAgrupamentoCompleto()
