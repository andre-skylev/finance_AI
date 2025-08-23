const path = require('path')
const fs = require('fs')
require('dotenv').config({ path: path.join(__dirname, '.env.local') })

async function analyzeDocumentStructure() {
  try {
    console.log('🔍 Analisando estrutura do Document AI...')
    
    const credentials = JSON.parse(Buffer.from(process.env.GOOGLE_CREDENTIALS_BASE64, 'base64').toString())
    const { DocumentProcessorServiceClient } = require('@google-cloud/documentai')
    
    const client = new DocumentProcessorServiceClient({
      credentials,
      apiEndpoint: 'eu-documentai.googleapis.com',
    })
    
    const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID
    const location = process.env.GOOGLE_CLOUD_LOCATION || 'eu'
    const processorId = process.env.GOOGLE_DOCUMENT_AI_PROCESSOR_ID
    
    const processorPath = client.processorPath(projectId, location, processorId)
    
    const testFile = path.join(__dirname, 'teste-fatura.pdf')
    const fileBuffer = fs.readFileSync(testFile)
    const base64Content = fileBuffer.toString('base64')
    
    const request = {
      name: processorPath,
      rawDocument: {
        content: base64Content,
        mimeType: 'application/pdf',
      },
    }
    
    console.log('📤 Processando documento...')
    const [result] = await client.processDocument(request)
    
    if (!result.document) {
      throw new Error('Nenhum documento retornado')
    }
    
    const document = result.document
    
    console.log('\n📄 ESTRUTURA DO DOCUMENTO:')
    console.log('- Páginas:', document.pages?.length || 0)
    console.log('- Entidades:', document.entities?.length || 0)
    console.log('- Texto total:', (document.text || '').length, 'caracteres')
    
    // Analisar entidades
    if (document.entities && document.entities.length > 0) {
      console.log('\n🏷️  TIPOS DE ENTIDADES ENCONTRADAS:')
      const entityTypes = {}
      document.entities.forEach(entity => {
        const type = entity.type || 'undefined'
        entityTypes[type] = (entityTypes[type] || 0) + 1
      })
      
      Object.entries(entityTypes).forEach(([type, count]) => {
        console.log(`   ${type}: ${count}`)
      })
      
      console.log('\n📋 AMOSTRA DE ENTIDADES:')
      document.entities.slice(0, 10).forEach((entity, i) => {
        console.log(`\n   Entidade ${i + 1}:`)
        console.log(`   - Tipo: ${entity.type || 'N/A'}`)
        console.log(`   - Texto: "${entity.mentionText || 'N/A'}"`)
        console.log(`   - Valor normalizado: ${entity.normalizedValue?.text || entity.normalizedValue?.numberValue || 'N/A'}`)
        if (entity.properties && entity.properties.length > 0) {
          console.log(`   - Propriedades: ${entity.properties.length}`)
          entity.properties.slice(0, 3).forEach((prop, j) => {
            console.log(`     ${j + 1}. ${prop.type || 'N/A'}: "${prop.mentionText || 'N/A'}"`)
          })
        }
      })
    }
    
    // Analisar tabelas
    if (document.pages) {
      let totalTables = 0
      document.pages.forEach(page => {
        if (page.tables) {
          totalTables += page.tables.length
        }
      })
      
      console.log(`\n📊 TABELAS ENCONTRADAS: ${totalTables}`)
      
      if (totalTables > 0) {
        const firstPage = document.pages[0]
        if (firstPage.tables && firstPage.tables.length > 0) {
          const firstTable = firstPage.tables[0]
          console.log('\n   Estrutura da primeira tabela:')
          console.log(`   - Linhas de cabeçalho: ${firstTable.headerRows?.length || 0}`)
          console.log(`   - Linhas de dados: ${firstTable.bodyRows?.length || 0}`)
          
          if (firstTable.headerRows && firstTable.headerRows.length > 0) {
            const headerRow = firstTable.headerRows[0]
            console.log('\n   Cabeçalhos detectados:')
            headerRow.cells?.forEach((cell, i) => {
              const cellText = extractCellText(cell, document.text || '')
              console.log(`     ${i + 1}. "${cellText}"`)
            })
          }
          
          if (firstTable.bodyRows && firstTable.bodyRows.length > 0) {
            console.log('\n   Primeiras linhas de dados:')
            firstTable.bodyRows.slice(0, 3).forEach((row, i) => {
              console.log(`     Linha ${i + 1}:`)
              row.cells?.forEach((cell, j) => {
                const cellText = extractCellText(cell, document.text || '')
                console.log(`       ${j + 1}. "${cellText}"`)
              })
            })
          }
        }
      }
    }
    
    // Analisar texto bruto
    console.log('\n📝 AMOSTRA DO TEXTO BRUTO:')
    const lines = (document.text || '').split('\n').slice(0, 20)
    lines.forEach((line, i) => {
      if (line.trim()) {
        console.log(`   ${i + 1}. "${line.trim()}"`)
      }
    })
    
    return true
    
  } catch (error) {
    console.error('❌ Erro na análise:', error.message)
    return false
  }
}

function extractCellText(cell, fullText) {
  if (!cell.layout?.textAnchor?.textSegments) return ''
  
  let text = ''
  for (const segment of cell.layout.textAnchor.textSegments) {
    const start = segment.startIndex || 0
    const end = segment.endIndex
    if (typeof end === 'number' && end > start) {
      text += fullText.substring(start, end)
    }
  }
  return text.trim()
}

analyzeDocumentStructure()
  .then(success => {
    if (success) {
      console.log('\n✅ Análise concluída!')
    } else {
      console.log('\n❌ Análise falhou!')
    }
  })
  .catch(console.error)
