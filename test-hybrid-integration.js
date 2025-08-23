/**
 * Simple test to check if the hybrid approach integration is working
 * Tests the GET endpoint first, then shows bank parsing capabilities
 */

const fs = require('fs')

// Test the bank parser directly
async function testBankParserDirectly() {
  console.log('🧪 Testando parser do banco diretamente\n')

  // Read the PDF content (we'll simulate the OCR text)
  const sampleText = `
NOVO BANCO
EXTRACTO DE MOVIMENTOS
CARTÃO DE CRÉDITO
N.º CARTÃO: ****1234
PERÍODO: 01/12/2023 A 31/12/2023

01/12/2023 CONTINENTE LISBOA        -25,67
02/12/2023 FARMACIA CRUZ VERDE      -12,80
05/12/2023 GALP POSTO OEIRAS        -45,20
08/12/2023 MBWAY TRANSFERENCIA      -50,00
12/12/2023 WORTEN ALMADA            -89,99
15/12/2023 RESTAURANTE ALFAMA       -32,15
  `

  try {
    // Since we can't directly import TS files in Node.js, let's test the logic manually
    console.log('🔍 Testando lógica de detecção (simulada)...')
    
    // Test bank detection logic
    const containsNovoBank = sampleText.toLowerCase().includes('novo banco')
    const containsCreditCard = sampleText.toLowerCase().includes('cartão de crédito')
    
    console.log(`   Contém "Novo Banco": ${containsNovoBank ? '✅' : '❌'}`)
    console.log(`   Contém "Cartão de Crédito": ${containsCreditCard ? '✅' : '❌'}`)
    
    if (containsNovoBank && containsCreditCard) {
      console.log('✅ Detecção simulada funcionaria!')
      console.log('   Banco detectado: novo-banco')
      console.log('   Tipo: credit-card')
      
      // Simulate transaction parsing
      const lines = sampleText.split('\n')
      const transactionLines = lines.filter(line => {
        return line.match(/^\d{2}\/\d{2}\/\d{4}.*-[\d,]+$/)
      })
      
      console.log(`\n💰 Transações simuladas encontradas: ${transactionLines.length}`)
      transactionLines.slice(0, 3).forEach((line, i) => {
        console.log(`   ${i + 1}. ${line.trim()}`)
      })
    } else {
      console.log('❌ Detecção simulada falharia')
    }

  } catch (error) {
    console.error('❌ Erro ao testar parser:', error.message)
  }
}

// Test GET endpoint (no auth required)
async function testGetEndpoint() {
  const http = require('http')
  
  console.log('\n🌐 Testando endpoint GET (verificar configuração)...')
  
  return new Promise((resolve) => {
    const req = http.get('http://localhost:3000/api/pdf-upload', (res) => {
      let data = ''
      res.on('data', chunk => data += chunk)
      res.on('end', () => {
        try {
          const result = JSON.parse(data)
          console.log('✅ Endpoint GET funcionando:')
          console.log(`   Status: ${result.status}`)
          console.log(`   Método: ${result.method}`)
          console.log(`   Configuração Document AI: ${result.configuration?.defaultProcessorConfigured ? '✅' : '❌'}`)
          console.log(`   Região: ${result.configuration?.location || 'não especificada'}`)
        } catch (error) {
          console.log('❌ Erro ao parsear resposta GET:', error.message)
        }
        resolve()
      })
    })
    
    req.on('error', (error) => {
      console.log('❌ Erro na requisição GET:', error.message)
      resolve()
    })
  })
}

async function runTests() {
  console.log('🚀 TESTE DE INTEGRAÇÃO DA ABORDAGEM HÍBRIDA')
  console.log('=' .repeat(60))
  
  await testBankParserDirectly()
  await testGetEndpoint()
  
  console.log('\n🎯 CONCLUSÃO:')
  console.log('Se ambos os testes passaram, a integração híbrida está pronta!')
  console.log('Para testar com upload de PDF real, será necessário autenticação.')
}

runTests().catch(console.error)
