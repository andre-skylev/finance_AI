const path = require('path')
const fs = require('fs')
require('dotenv').config({ path: path.join(__dirname, '.env.local') })

async function testPDFUploadAPI() {
  try {
    console.log('🔍 Testando API de upload de PDF melhorada...')
    
    const testFile = path.join(__dirname, 'teste-fatura.pdf')
    if (!fs.existsSync(testFile)) {
      throw new Error('Arquivo teste-fatura.pdf não encontrado')
    }
    
    const fileBuffer = fs.readFileSync(testFile)
    console.log('📁 Arquivo:', testFile)
    console.log('📊 Tamanho:', fileBuffer.length, 'bytes')
    
    const FormData = require('form-data')
    const fetch = require('node-fetch')
    
    const formData = new FormData()
    formData.append('file', fileBuffer, {
      filename: 'teste-fatura.pdf',
      contentType: 'application/pdf'
    })
    formData.append('documentType', 'credit_card')
    formData.append('debug', '1')
    
    console.log('📤 Enviando para API local...')
    const response = await fetch('http://localhost:3000/api/pdf-upload?debug=1', {
      method: 'POST',
      body: formData,
      headers: formData.getHeaders()
    })
    
    console.log('📡 Status da resposta:', response.status, response.statusText)
    
    if (!response.ok) {
      const errorText = await response.text()
      console.error('❌ Erro na API:', errorText)
      return false
    }
    
    const result = await response.json()
    console.log('✅ Resposta da API recebida!')
    
    console.log('📄 Resultado do processamento:')
    console.log('   Tipo do documento:', result.documentType)
    console.log('   Instituição:', result.institution)
    console.log('   Transações encontradas:', result.transactions?.length || 0)
    console.log('   Cartões encontrados:', result.receipts?.length || 0)
    console.log('   Recibos encontrados:', result.cardCandidate ? 1 : 0)
    
    if (result.transactions && result.transactions.length > 0) {
      console.log('\n💳 Primeiras transações:')
      result.transactions.slice(0, 3).forEach((tx, i) => {
        console.log(`   ${i + 1}. ${tx.date} - ${tx.description} - €${tx.amount}`)
      })
    }
    
    if (result.processingTime) {
      console.log('\n⏱️  Tempo de processamento:', result.processingTime, 'ms')
    }
    
    return true
    
  } catch (error) {
    console.error('❌ Erro no teste da API:', error.message)
    console.error('🔍 Detalhes:', error)
    return false
  }
}

// Verificar se o servidor local está rodando
async function checkServerStatus() {
  try {
    const fetch = require('node-fetch')
    const response = await fetch('http://localhost:3000/api/health', { method: 'GET', timeout: 2000 })
    return response.ok
  } catch {
    return false
  }
}

async function main() {
  console.log('🚀 Iniciando teste completo da API de PDF...\n')
  
  const serverRunning = await checkServerStatus()
  if (!serverRunning) {
    console.log('⚠️  Servidor local não está rodando!')
    console.log('💡 Execute: npm run dev')
    console.log('   Em seguida, execute este teste novamente.')
    return
  }
  
  console.log('✅ Servidor local detectado\n')
  
  const success = await testPDFUploadAPI()
  
  if (success) {
    console.log('\n🎉 Teste da API PASSOU!')
    console.log('✅ Sistema de extração de PDF está funcionando')
  } else {
    console.log('\n❌ Teste da API FALHOU!')
    console.log('💡 Verifique os logs do servidor para mais detalhes')
  }
}

main().catch(console.error)
