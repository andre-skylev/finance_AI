require('dotenv').config({ path: '.env.local' })
const fs = require('fs')
const FormData = require('form-data')
const path = require('path')

const BASE_URL = 'http://localhost:3000'

async function testarTransacoesRecibo() {
  console.log('📄 Testando processamento e salvamento de transações de recibo...')

  try {
    // 1. Upload do PDF para processamento
    console.log('\n1️⃣ Fazendo upload do PDF...')
    
    const pdfPath = path.join(__dirname, 'teste-fatura.pdf')
    if (!fs.existsSync(pdfPath)) {
      console.log('❌ Arquivo teste-fatura.pdf não encontrado')
      return
    }

    const formData = new FormData()
    formData.append('file', fs.createReadStream(pdfPath))
    formData.append('target', 'rec') // Para recibos

    const uploadResponse = await fetch(`${BASE_URL}/api/pdf-upload`, {
      method: 'POST',
      body: formData,
      headers: {
        ...formData.getHeaders()
      }
    })

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text()
      throw new Error(`Upload falhou: ${uploadResponse.status} - ${errorText}`)
    }

    const uploadResult = await uploadResponse.json()
    console.log('✅ Upload processado com sucesso!')
    console.log(`📊 Transações encontradas: ${uploadResult.transactions?.length || 0}`)
    console.log(`🧾 Recibos encontrados: ${uploadResult.receipts?.length || 0}`)

    if (uploadResult.transactions && uploadResult.transactions.length > 0) {
      console.log('\n📋 Primeiras 3 transações encontradas:')
      uploadResult.transactions.slice(0, 3).forEach((t, i) => {
        console.log(`  ${i + 1}. ${t.description} - €${t.amount} (${t.suggestedCategory || 'Sem categoria'})`)
      })
    }

    // 2. Confirmação das transações
    console.log('\n2️⃣ Confirmando salvamento das transações...')
    
    const confirmResponse = await fetch(`${BASE_URL}/api/pdf-confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        target: 'rec',
        transactions: uploadResult.transactions || [],
        receipts: uploadResult.receipts || []
      })
    })

    if (!confirmResponse.ok) {
      const errorText = await confirmResponse.text()
      throw new Error(`Confirmação falhou: ${confirmResponse.status} - ${errorText}`)
    }

    const confirmResult = await confirmResponse.json()
    console.log('✅ Confirmação processada!')
    console.log(`📤 Resultado: ${confirmResult.message}`)
    console.log(`🧾 Recibos salvos: ${confirmResult.receiptsSaved || 0}`)
    console.log(`💰 Transações salvas: ${confirmResult.transactionsSaved || 0}`)

    if (confirmResult.transactionsSaved > 0) {
      console.log('\n🎉 SUCESSO! As transações de recibo agora estão sendo salvas corretamente!')
    } else {
      console.log('\n⚠️ Nenhuma transação foi salva. Verificar logs do servidor.')
    }

  } catch (error) {
    console.error('❌ Erro no teste:', error.message)
  }
}

testarTransacoesRecibo()
