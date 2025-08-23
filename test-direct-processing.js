const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '.env.local') })

async function testDirectProcessing() {
  try {
    console.log('🔍 Testando processamento direto de documento...')
    
    // Get credentials
    const credentials = JSON.parse(Buffer.from(process.env.GOOGLE_CREDENTIALS_BASE64, 'base64').toString())
    console.log('✅ Credenciais decodificadas')
    console.log('   Email:', credentials.client_email)
    
    const { DocumentProcessorServiceClient } = require('@google-cloud/documentai')
    
    const client = new DocumentProcessorServiceClient({
      credentials,
      apiEndpoint: 'eu-documentai.googleapis.com',
    })
    
    // Test with existing processor ID
    const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID
    const location = process.env.GOOGLE_CLOUD_LOCATION || 'eu'
    const processorId = process.env.GOOGLE_DOCUMENT_AI_PROCESSOR_ID
    
    console.log('📋 Configuração:')
    console.log('   Project:', projectId)
    console.log('   Location:', location)
    console.log('   Processor:', processorId)
    
    const processorPath = client.processorPath(projectId, location, processorId)
    console.log('   Processor Path:', processorPath)
    
    // Use existing test PDF file
    const fs = require('fs')
    const testPdfPath = path.join(__dirname, 'teste-fatura.pdf')
    
    if (!fs.existsSync(testPdfPath)) {
      throw new Error('Arquivo teste-fatura.pdf não encontrado')
    }
    
    const fileBuffer = fs.readFileSync(testPdfPath)
    const base64Content = fileBuffer.toString('base64')
    
    console.log('📁 Arquivo de teste:', testPdfPath)
    console.log('📊 Tamanho:', fileBuffer.length, 'bytes')
    
    const request = {
      name: processorPath,
      rawDocument: {
        content: base64Content,
        mimeType: 'application/pdf',
      },
    }
    
    console.log('📤 Enviando documento para processamento...')
    const [result] = await client.processDocument(request)
    
    console.log('✅ Documento processado com sucesso!')
    console.log('📄 Resultado:')
    if (result.document?.text) {
      console.log('   Texto extraído:', result.document.text.substring(0, 100) + '...')
    }
    if (result.document?.entities) {
      console.log('   Entidades encontradas:', result.document.entities.length)
    }
    
    return true
    
  } catch (error) {
    console.error('❌ Erro no processamento direto:', error.message)
    console.error('🔍 Detalhes:', error.details || error)
    return false
  }
}

testDirectProcessing()
  .then(success => {
    if (success) {
      console.log('\n🎉 Teste de processamento direto PASSOU!')
      console.log('✅ O sistema está configurado corretamente')
      process.exit(0)
    } else {
      console.log('\n❌ Teste de processamento direto FALHOU!')
      process.exit(1)
    }
  })
  .catch(error => {
    console.error('💥 Erro inesperado:', error)
    process.exit(1)
  })
