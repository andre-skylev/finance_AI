require('dotenv').config({ path: '.env.local' })

async function testarSaldosRecibo() {
  console.log('🧪 Testando se saldos de conta são atualizados com transações de recibo...')

  try {
    const BASE_URL = 'http://localhost:3000'

    // 1. Buscar contas existentes antes
    console.log('\n1️⃣ Verificando contas existentes...')
    const accountsResponse = await fetch(`${BASE_URL}/api/accounts`)
    
    if (!accountsResponse.ok) {
      throw new Error(`Erro ao buscar contas: ${accountsResponse.status}`)
    }

    const accountsData = await accountsResponse.json()
    console.log(`📊 Contas encontradas: ${accountsData.length}`)
    
    if (accountsData.length > 0) {
      console.log('💰 Saldos atuais:')
      accountsData.forEach(acc => {
        console.log(`  - ${acc.account_name}: €${acc.balance || 0}`)
      })
    }

    // 2. Testar transações de recibo simples
    console.log('\n2️⃣ Testando salvamento de transações de recibo...')
    
    const testTransactions = [
      {
        description: 'Compra teste supermercado',
        amount: 25.50,
        date: new Date().toISOString().split('T')[0],
        suggestedCategory: 'Supermercado'
      },
      {
        description: 'Compra teste farmácia',
        amount: 12.30,
        date: new Date().toISOString().split('T')[0],
        suggestedCategory: 'Saúde'
      }
    ]

    const testReceipts = [
      {
        merchant: 'Teste Supermercado',
        date: new Date().toISOString().split('T')[0],
        total: 37.80,
        items: [
          { description: 'Produto 1', quantity: 1, unitPrice: 25.50, total: 25.50 },
          { description: 'Produto 2', quantity: 1, unitPrice: 12.30, total: 12.30 }
        ]
      }
    ]

    const confirmResponse = await fetch(`${BASE_URL}/api/pdf-confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        target: 'rec',
        transactions: testTransactions,
        receipts: testReceipts
      })
    })

    if (!confirmResponse.ok) {
      const errorText = await confirmResponse.text()
      throw new Error(`Erro ao confirmar transações: ${confirmResponse.status} - ${errorText}`)
    }

    const confirmResult = await confirmResponse.json()
    console.log('✅ Transações processadas!')
    console.log(`📤 Resultado: ${confirmResult.message}`)

    // 3. Verificar saldos após transações
    console.log('\n3️⃣ Verificando saldos após transações...')
    
    const accountsAfterResponse = await fetch(`${BASE_URL}/api/accounts`)
    if (!accountsAfterResponse.ok) {
      throw new Error(`Erro ao buscar contas após transações: ${accountsAfterResponse.status}`)
    }

    const accountsAfterData = await accountsAfterResponse.json()
    console.log('💰 Saldos após transações:')
    accountsAfterData.forEach(acc => {
      console.log(`  - ${acc.account_name}: €${acc.balance || 0}`)
    })

    // 4. Verificar se as transações aparecem na lista
    console.log('\n4️⃣ Verificando se transações aparecem na lista...')
    
    const transactionsResponse = await fetch(`${BASE_URL}/api/transactions?limit=10`)
    if (!transactionsResponse.ok) {
      throw new Error(`Erro ao buscar transações: ${transactionsResponse.status}`)
    }

    const transactionsData = await transactionsResponse.json()
    console.log(`📋 Transações encontradas: ${transactionsData.length}`)
    
    const recentReceipts = transactionsData.filter(t => 
      t.description.includes('teste') || t.description.includes('Teste')
    )
    
    if (recentReceipts.length > 0) {
      console.log('🧾 Transações de recibo recentes:')
      recentReceipts.forEach(t => {
        console.log(`  - ${t.description}: €${t.amount} (${t.type})`)
      })
      console.log('\n🎉 SUCESSO! As transações estão sendo salvas e aparecem nas movimentações!')
    } else {
      console.log('\n⚠️ Nenhuma transação de teste encontrada na lista')
    }

  } catch (error) {
    console.error('❌ Erro no teste:', error.message)
  }
}

testarSaldosRecibo()
