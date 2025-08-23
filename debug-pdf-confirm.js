// Script de debug para testar o salvamento das transações PDF
const { createClient } = require('@supabase/supabase-js')

async function testPDFConfirm() {
  // Simular dados que deveriam ser enviados
  const testData = {
    transactions: [
      {
        amount: -25.50,
        description: "PINGO DOCE TESTE",
        suggestedCategory: "Supermercado",
        date: "2025-08-23"
      }
    ],
    target: "acc:1", // ID de uma conta de teste
    receipts: []
  }

  console.log('Dados de teste:', JSON.stringify(testData, null, 2))

  // Fazer requisição para o endpoint
  try {
    const response = await fetch('http://localhost:3001/api/pdf-confirm', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testData)
    })

    const result = await response.json()
    console.log('Resposta do servidor:', result)
    console.log('Status:', response.status)
  } catch (error) {
    console.error('Erro na requisição:', error)
  }
}

testPDFConfirm()
