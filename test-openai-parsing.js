/**
 * Test the new OpenAI parsing functionality
 */

const FormData = require('form-data')
const fs = require('fs')
const http = require('http')
const { URL } = require('url')

const API_URL = 'http://localhost:3000/api/pdf-upload'
const PDF_PATH = './teste-fatura.pdf'

// Simple fetch implementation
function fetch(url, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url)
    const isHttps = urlObj.protocol === 'https:'
    const lib = isHttps ? require('https') : http
    
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

async function testOpenAIParsing() {
  console.log('🤖 TESTE DE PARSING COM OPENAI')
  console.log('=' .repeat(50))

  if (!fs.existsSync(PDF_PATH)) {
    console.error(`❌ Arquivo ${PDF_PATH} não encontrado`)
    return
  }

  try {
    // Test 1: Regular parsing (current system)
    console.log('\n1️⃣ Teste com sistema atual (regex + bank parsers)...')
    
    const form1 = new FormData()
    form1.append('file', fs.createReadStream(PDF_PATH))
    form1.append('debug', 'true')

    const response1 = await fetch(API_URL, {
      method: 'POST',
      body: form1,
      headers: form1.getHeaders()
    })

    const result1 = await response1.json()
    
    console.log('📊 Resultado sistema atual:')
    console.log(`   Método: ${result1.bankInfo?.parsingMethod}`)
    console.log(`   Banco/Loja: ${result1.bankInfo?.detectedBank}`)
    console.log(`   Transações: ${result1.bankInfo?.transactionsFound}`)
    
    // Test 2: OpenAI parsing
    console.log('\n2️⃣ Teste com OpenAI parsing...')
    
    const form2 = new FormData()
    form2.append('file', fs.createReadStream(PDF_PATH))
    form2.append('openai', '1')  // 🤖 This enables OpenAI parsing
    form2.append('debug', 'true')

    const response2 = await fetch(API_URL, {
      method: 'POST',
      body: form2,
      headers: form2.getHeaders()
    })

    const result2 = await response2.json()
    
    console.log('🤖 Resultado OpenAI:')
    console.log(`   Método: ${result2.bankInfo?.parsingMethod}`)
    console.log(`   Banco/Loja: ${result2.bankInfo?.detectedBank}`)
    console.log(`   Transações: ${result2.bankInfo?.transactionsFound}`)
    
    if (result2.bankInfo?.openAI) {
      console.log(`   Confiança OpenAI: ${result2.bankInfo.openAI.confidence}`)
      console.log(`   Tipo documento: ${result2.bankInfo.openAI.documentType}`)
      console.log(`   Total OpenAI: €${result2.bankInfo.openAI.totalAmount}`)
      if (result2.bankInfo.openAI.notes) {
        console.log(`   Notas: ${result2.bankInfo.openAI.notes}`)
      }
    }
    
    // Compare results
    console.log('\n📊 COMPARAÇÃO DOS RESULTADOS:')
    console.log('=' .repeat(40))
    
    console.log('🔧 Sistema Atual (regex):')
    if (result1.data && result1.data.length > 0) {
      result1.data.slice(0, 3).forEach((tx, i) => {
        console.log(`   ${i + 1}. ${tx.description} - €${Math.abs(tx.amount)}`)
      })
    } else {
      console.log('   ❌ Nenhuma transação extraída')
    }
    
    console.log('\n🤖 Sistema OpenAI:')
    if (result2.data && result2.data.length > 0) {
      result2.data.slice(0, 3).forEach((tx, i) => {
        console.log(`   ${i + 1}. ${tx.description} - €${Math.abs(tx.amount)}`)
      })
    } else {
      console.log('   ❌ Nenhuma transação extraída')
    }
    
    // Performance comparison
    const time1 = result1.message?.match(/(\d+)ms/)?.[1] || 'N/A'
    const time2 = result2.message?.match(/(\d+)ms/)?.[1] || 'N/A'
    
    console.log('\n⏱️  PERFORMANCE:')
    console.log(`   Sistema atual: ${time1}ms`)
    console.log(`   Sistema OpenAI: ${time2}ms`)
    
    console.log('\n✅ CONCLUSÃO:')
    if (result2.bankInfo?.parsingMethod === 'openai') {
      console.log('🎉 OpenAI parsing funcionou!')
      console.log('💡 A OpenAI conseguiu organizar o texto OCR automaticamente')
      console.log('🔥 Agora você pode processar qualquer tipo de documento financeiro!')
    } else {
      console.log('⚠️ OpenAI parsing falhou, mas sistema atual funcionou como fallback')
    }

  } catch (error) {
    console.error('❌ Erro no teste:', error.message)
  }
}

// Instructions
console.log('🚀 NOVA FUNCIONALIDADE: PARSING COM OPENAI')
console.log('=' .repeat(60))
console.log('')
console.log('📝 COMO USAR:')
console.log('1. Adicione o parâmetro "openai=1" ao fazer upload')
console.log('2. A OpenAI vai organizar o texto OCR automaticamente')
console.log('3. Funciona com qualquer tipo de documento financeiro!')
console.log('')
console.log('🔗 EXEMPLOS DE USO:')
console.log('• Interface web: adicionar checkbox "Usar IA para organizar"')
console.log('• API direta: POST com formData.append("openai", "1")')
console.log('• URL params: ?openai=1')
console.log('')
console.log('🎯 VANTAGENS:')
console.log('• Muito mais flexível que regex')
console.log('• Funciona com documentos mal formatados')
console.log('• Categorização automática inteligente')
console.log('• Detecta qualquer tipo de estabelecimento')
console.log('• Extrai informações estruturadas complexas')
console.log('')

// Run the test
testOpenAIParsing()
  .then(() => {
    console.log('\n🎊 Teste concluído!')
    console.log('Agora você pode usar tanto regex quanto IA para parsing!')
  })
  .catch(error => {
    console.error('💥 Falha no teste:', error)
  })
