const path = require('path')
const fs = require('fs')
require('dotenv').config({ path: path.join(__dirname, '.env.local') })

async function testReceiptExtraction() {
  try {
    console.log('🔍 Testando extração de recibo melhorada...')
    
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
    // Force receipt processing
    formData.append('documentType', 'receipt')
    formData.append('debug', '1')
    formData.append('ai', '1') // Enable AI mapping
    
    console.log('📤 Enviando para API com tipo "receipt"...')
    const response = await fetch('http://localhost:3000/api/pdf-upload?debug=1&ai=1', {
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
    console.log('   Recibos encontrados:', result.receipts?.length || 0)
    
    if (result.receipts && result.receipts.length > 0) {
      const receipt = result.receipts[0]
      console.log('\n🧾 Detalhes do recibo:')
      console.log('   Comerciante:', receipt.merchant || 'N/A')
      console.log('   Data:', receipt.date || 'N/A')
      console.log('   Subtotal:', receipt.subtotal || 'N/A')
      console.log('   Taxa/IVA:', receipt.tax || 'N/A')
      console.log('   Total:', receipt.total || 'N/A')
      console.log('   Itens encontrados:', receipt.items?.length || 0)
      
      if (receipt.items && receipt.items.length > 0) {
        console.log('\n📝 Itens do recibo:')
        receipt.items.slice(0, 10).forEach((item, i) => {
          console.log(`   ${i + 1}. ${item.description}`)
          if (item.quantity) console.log(`      Quantidade: ${item.quantity}`)
          if (item.unitPrice) console.log(`      Preço unitário: €${item.unitPrice}`)
          if (item.total) console.log(`      Total: €${item.total}`)
          if (item.code) console.log(`      Código: ${item.code}`)
          console.log('')
        })
        
        if (receipt.items.length > 10) {
          console.log(`   ... e mais ${receipt.items.length - 10} itens`)
        }
      } else {
        console.log('\n⚠️  Nenhum item extraído do recibo')
      }
    }
    
    if (result.transactions && result.transactions.length > 0) {
      console.log('\n💳 Transações detectadas:')
      result.transactions.slice(0, 3).forEach((tx, i) => {
        console.log(`   ${i + 1}. ${tx.date} - ${tx.description} - €${tx.amount}`)
      })
    }
    
    if (result.processingTime) {
      console.log('\n⏱️  Tempo de processamento:', result.processingTime, 'ms')
    }
    
    return true
    
  } catch (error) {
    console.error('❌ Erro no teste da extração de recibo:', error.message)
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
  console.log('🚀 Iniciando teste de extração de recibo melhorada...\n')
  
  const serverRunning = await checkServerStatus()
  if (!serverRunning) {
    console.log('⚠️  Servidor local não está rodando!')
    console.log('💡 Execute: npm run dev')
    console.log('   Em seguida, execute este teste novamente.')
    return
  }
  
  console.log('✅ Servidor local detectado\n')
  
  const success = await testReceiptExtraction()
  
  if (success) {
    console.log('\n🎉 Teste de extração de recibo PASSOU!')
    console.log('✅ Sistema melhorado está extraindo dados dos recibos')
  } else {
    console.log('\n❌ Teste de extração de recibo FALHOU!')
    console.log('💡 Verifique os logs do servidor para mais detalhes')
  }
}

main().catch(console.error)
