/**
 * Teste de Debug - Criação de Conta com Moeda BRL
 * Verifica se a moeda está sendo enviada corretamente para o backend
 */

const testAccountCreation = async () => {
  const testData = {
    name: 'Conta Teste BRL',
    bank_name: 'Banco Teste',
    account_type: 'checking',
    currency: 'BRL',
    balance: 1000
  }

  console.log('🔍 TESTE DE CRIAÇÃO DE CONTA COM BRL')
  console.log('📤 Dados sendo enviados:')
  console.log(JSON.stringify(testData, null, 2))

  try {
    const response = await fetch('/api/accounts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testData)
    })
    
    const data = await response.json()
    
    console.log('📨 Resposta do servidor:')
    console.log('Status:', response.status)
    console.log('Data:', JSON.stringify(data, null, 2))
    
    if (data.account) {
      console.log('✅ Conta criada com sucesso!')
      console.log('💰 Moeda salva:', data.account.currency)
      
      if (data.account.currency === 'BRL') {
        console.log('🎉 SUCESSO: Moeda BRL foi salva corretamente!')
      } else {
        console.log('❌ ERRO: Moeda deveria ser BRL, mas foi salva como:', data.account.currency)
      }
    } else {
      console.log('❌ Erro ao criar conta:', data.error)
    }
    
  } catch (error) {
    console.error('❌ Erro na requisição:', error)
  }
}

// Executar se estivermos no browser
if (typeof window !== 'undefined') {
  console.log('Executando teste no browser...')
  testAccountCreation()
} else {
  console.log('❌ Este teste deve ser executado no browser (console do DevTools)')
  console.log('📋 Cole este código no DevTools da página de contas:')
  console.log(`
  const testData = {
    name: 'Conta Teste BRL',
    bank_name: 'Banco Teste', 
    account_type: 'checking',
    currency: 'BRL',
    balance: 1000
  }
  
  fetch('/api/accounts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(testData)
  })
  .then(r => r.json())
  .then(data => console.log('Resultado:', data))
  `)
}
