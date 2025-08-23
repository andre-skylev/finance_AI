/**
 * Test the new hybrid approach with bank-specific parsing
 * This test uploads the Novo Banco PDF and checks if bank-specific parser is used
 */

const FormData = require('form-data')
const fs = require('fs')
const https = require('https')
const http = require('http')
const { URL } = require('url')

const API_URL = 'http://localhost:3000/api/pdf-upload'
const PDF_PATH = './teste-fatura.pdf'

// Simple fetch alternative using http/https
function fetch(url, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url)
    const isHttps = urlObj.protocol === 'https:'
    const lib = isHttps ? https : http
    
    const reqOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port || (isHttps ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'GET',
      headers: options.headers || {}
    }

    const req = lib.request(reqOptions, (res) => {
      let data = ''
      res.on('data', chunk => data += chunk)
      res.on('end', () => {
        res.text = () => Promise.resolve(data)
        res.json = () => Promise.resolve(JSON.parse(data))
        res.ok = res.statusCode >= 200 && res.statusCode < 300
        res.status = res.statusCode
        res.statusText = res.statusMessage
        resolve(res)
      })
    })

    req.on('error', reject)
    
    if (options.body) {
      if (options.body.pipe) {
        options.body.pipe(req)
      } else {
        req.write(options.body)
        req.end()
      }
    } else {
      req.end()
    }
  })
}

async function testHybridApproach() {
  console.log('🧪 Testando abordagem híbrida (Document AI + Bank Parsers)\n')

  if (!fs.existsSync(PDF_PATH)) {
    console.error(`❌ Arquivo ${PDF_PATH} não encontrado`)
    return
  }

  try {
    // Create form data
    const form = new FormData()
    form.append('file', fs.createReadStream(PDF_PATH))
    form.append('raw', 'true') // Get detailed output
    form.append('debug', 'true') // Enable debug mode

    console.log('📤 Enviando arquivo para API...')
    
    const response = await fetch(API_URL, {
      method: 'POST',
      body: form,
      headers: form.getHeaders()
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    const result = await response.json()
    
    console.log('📊 RESULTADO DO TESTE HÍBRIDO:')
    console.log('=' .repeat(50))

    // Check if bank was detected
    if (result.bankInfo) {
      console.log('\n🏦 INFORMAÇÕES DO BANCO:')
      console.log(`   Banco detectado: ${result.bankInfo.detectedBank}`)
      console.log(`   Método usado: ${result.bankInfo.parsingMethod}`)
      console.log(`   Transações encontradas: ${result.bankInfo.transactionsFound}`)
      
      if (result.bankInfo.period && result.bankInfo.period.start) {
        console.log(`   Período: ${result.bankInfo.period.start} até ${result.bankInfo.period.end}`)
      }
    }

    // Show parsing results
    console.log('\n💰 TRANSAÇÕES EXTRAÍDAS:')
    if (result.data && result.data.length > 0) {
      console.log(`   Total: ${result.data.length} transações`)
      
      // Show first 5 transactions as sample
      const sampleCount = Math.min(5, result.data.length)
      console.log(`   Amostra (primeiras ${sampleCount}):`)
      
      for (let i = 0; i < sampleCount; i++) {
        const tx = result.data[i]
        console.log(`   ${i + 1}. ${tx.date} | ${tx.description} | ${tx.amount} €`)
      }
      
      if (result.data.length > 5) {
        console.log(`   ... e mais ${result.data.length - 5} transações`)
      }
    } else {
      console.log('   ❌ Nenhuma transação extraída')
    }

    // Check for success indicators
    console.log('\n✅ INDICADORES DE SUCESSO:')
    console.log(`   Banco detectado: ${result.bankInfo?.detectedBank !== 'unknown' ? '✅' : '❌'}`)
    console.log(`   Parser específico usado: ${result.bankInfo?.parsingMethod === 'bank-specific' ? '✅' : '❌'}`)
    console.log(`   Transações extraídas: ${result.data && result.data.length > 0 ? '✅' : '❌'}`)

    // Show detailed debug if available
    if (result.debug && result.debug.logs) {
      console.log('\n🔍 DEBUG LOGS:')
      result.debug.logs.forEach(log => console.log(`   ${log}`))
    }

    // Performance metrics
    if (result.message.includes('ms')) {
      const timeMatch = result.message.match(/(\d+)ms/)
      if (timeMatch) {
        console.log(`\n⏱️  Tempo de processamento: ${timeMatch[1]}ms`)
      }
    }

    return result

  } catch (error) {
    console.error('❌ Erro no teste:', error.message)
    return null
  }
}

// Run the test
testHybridApproach()
  .then(result => {
    if (result) {
      console.log('\n🎉 Teste concluído com sucesso!')
      
      if (result.bankInfo?.parsingMethod === 'bank-specific') {
        console.log('🚀 Sistema híbrido funcionando! Parser específico do banco foi usado.')
      } else {
        console.log('⚠️  Sistema híbrido em fallback. Usando Document AI.')
      }
    }
  })
  .catch(error => {
    console.error('💥 Falha no teste:', error)
  })
