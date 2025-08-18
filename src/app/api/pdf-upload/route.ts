import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

// Helper: Limpar e normalizar texto extraído
function cleanExtractedText(text: string): string {
  return text
    .replace(/\s+/g, ' ') // Múltiplos espaços para um
    .replace(/[\r\n]+/g, '\n') // Normalizar quebras de linha
    .replace(/[^\S\r\n]+/g, ' ') // Remover espaços estranhos
    .trim()
}

export async function POST(request: NextRequest) {
  const startTime = Date.now()
  
  try {
    const supabase = await createClient()
    
    // Auth check
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File
    
    // Validações
    if (!file) {
      return NextResponse.json({ error: 'Nenhum arquivo fornecido' }, { status: 400 })
    }

    if (file.type !== 'application/pdf') {
      return NextResponse.json({ error: 'Apenas PDFs são aceitos' }, { status: 400 })
    }

    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: 'Arquivo muito grande (máximo 10MB)' }, { status: 400 })
    }

    console.log(`\n📄 Processando PDF: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`)
    console.log('='.repeat(50))

    const buffer = Buffer.from(await file.arrayBuffer())
    let extractedText = ''
    let extractionMethod = ''
    let confidence = 0

    // ========================================
    // MÉTODO PRINCIPAL: pdf-parse com configuração correta
    // ========================================
    try {
      console.log('🔍 Extraindo texto do PDF...')
      
      // Importar pdf-parse de forma segura
      let pdfParse: any
      try {
        pdfParse = require('pdf-parse/lib/pdf-parse')
      } catch {
        pdfParse = require('pdf-parse')
      }
      
      // Configuração robusta para pdf-parse
      const pdfData = await pdfParse(buffer)
      
      if (pdfData && pdfData.text) {
        extractedText = cleanExtractedText(pdfData.text)
        extractionMethod = 'pdf-parse'
        confidence = 95
        console.log(`✅ Texto extraído: ${extractedText.length} caracteres`)
        console.log(`   Páginas: ${pdfData.numpages || 'desconhecido'}`)
        console.log(`   Info: ${pdfData.info?.Title || 'sem título'}`)
      }
    } catch (error: any) {
      console.log(`⚠️ pdf-parse encontrou problema: ${error.message}`)
      console.log('   Tentando método alternativo...')
    }

    // ========================================
    // FALLBACK: Tentar com pdfjs-dist se disponível
    // ========================================
    if (!extractedText || extractedText.length < 200) {
      try {
        console.log('🔍 Tentando método alternativo com pdfjs...')
        
        // Tentar importar pdfjs-dist
        const pdfjsLib = await import('pdfjs-dist')
        
        // Configurar worker inline
        pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`
        
        const loadingTask = pdfjsLib.getDocument({ data: buffer })
        const pdfDocument = await loadingTask.promise
        
        let fullText = ''
        const numPages = pdfDocument.numPages
        console.log(`   Processando ${numPages} páginas...`)
        
        for (let i = 1; i <= numPages; i++) {
          const page = await pdfDocument.getPage(i)
          const textContent = await page.getTextContent()
          
          const pageText = textContent.items
            .map((item: any) => item.str)
            .join(' ')
          
          fullText += pageText + '\n'
        }
        
        if (fullText.trim().length > 200) {
          extractedText = cleanExtractedText(fullText)
          extractionMethod = 'pdfjs-dist'
          confidence = 90
          console.log(`✅ Texto extraído via pdfjs: ${extractedText.length} caracteres`)
        }
      } catch (error: any) {
        console.log(`   pdfjs não disponível ou falhou: ${error.message}`)
      }
    }

    // ========================================
    // VALIDAÇÃO FINAL
    // ========================================
    if (!extractedText || extractedText.length < 100) {
      console.log('\n❌ FALHA: Não foi possível extrair texto suficiente')
      console.log('   Possíveis causas:')
      console.log('   1. PDF escaneado (imagem em vez de texto)')
      console.log('   2. PDF protegido ou corrompido')
      console.log('   3. PDF com estrutura não padrão')
      
      return NextResponse.json({
        error: 'Não foi possível extrair texto do PDF',
        details: {
          textLength: extractedText.length,
          fileSize: file.size,
          fileName: file.name,
          suggestion: 'Por favor, use um PDF digital (não escaneado) baixado diretamente do seu banco. PDFs escaneados precisam de OCR que não está disponível no momento.'
        }
      }, { status: 400 })
    }

    console.log('\n' + '='.repeat(50))
    console.log(`✅ TEXTO EXTRAÍDO COM SUCESSO`)
    console.log(`   Método: ${extractionMethod}`)
    console.log(`   Tamanho: ${extractedText.length} caracteres`)
    console.log(`   Confiança: ${confidence}%`)
    console.log('='.repeat(50) + '\n')

    // ========================================
    // PROCESSAMENTO COM IA
    // ========================================
    console.log('🤖 Analisando documento com OpenAI...')
    
    // Detectar tipo de documento
    const docTypeCheck = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'Identifique o tipo de documento e o banco. Responda APENAS em JSON: {"type": "credit_card" ou "bank_statement", "bank": "nome do banco", "period": "período se disponível"}'
        },
        {
          role: 'user',
          content: extractedText.substring(0, 2000)
        }
      ],
      temperature: 0,
      max_tokens: 100,
      response_format: { type: "json_object" }
    })
    
    const docInfo = JSON.parse(docTypeCheck.choices[0].message.content || '{}')
    console.log(`📋 Documento: ${docInfo.type}, Banco: ${docInfo.bank}`)
    
    // Extrair transações
    const isCard = docInfo.type === 'credit_card'
    
    const transactionPrompt = isCard
      ? `Você é um especialista em faturas de cartão de crédito. Extraia TODAS as transações.
         Para cada transação: data (formato YYYY-MM-DD), comerciante, valor (sempre positivo), categoria.
         Se houver parcelas, indique como "X/Y" no campo installment_info.
         Detecte múltiplos cartões se houver (diferentes números terminados em ****XXXX).`
      : `Você é um especialista em extratos bancários. Extraia TODAS as transações.
         Para cada transação: data (formato YYYY-MM-DD), descrição, valor (negativo para débitos, positivo para créditos), categoria.`
    
    const extraction = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `${transactionPrompt}
          
Categorias disponíveis: alimentacao, transporte, saude, educacao, lazer, casa, roupas, tecnologia, servicos, transferencia, salario, compras_parceladas, outros

IMPORTANTE: Retorne APENAS um JSON válido, sem texto adicional. Limite-se a 50 transações principais se houver muitas.

Formato esperado:
{
  "transactions": [
    {
      "date": "YYYY-MM-DD",
      "merchant": "nome",
      "description": "descrição curta",
      "amount": number,
      "category": "categoria",
      "type": "debit",
      "installment_info": null ou "X/Y"
    }
  ],
  "cards": [
    {
      "last_four": "XXXX",
      "holder_name": "nome",
      "brand": "visa"
    }
  ],
  "summary": {
    "total": number,
    "period": "MM/YYYY a MM/YYYY",
    "currency": "EUR"
  }
}`
        },
        {
          role: 'user',
          content: `Extraia as transações principais (máximo 50) deste documento:\n\n${extractedText.substring(0, 10000)}`
        }
      ],
      temperature: 0.1,
      max_tokens: 3500,
      response_format: { type: "json_object" }
    })
    
    // Tratamento robusto do JSON
    let result: any = {}
    try {
      const rawContent = extraction.choices[0]?.message?.content || '{}'
      console.log(`   Resposta da IA: ${rawContent.length} caracteres`)
      
      // Tentar fazer parse direto
      result = JSON.parse(rawContent)
    } catch (parseError: any) {
      console.log(`⚠️  Erro ao fazer parse do JSON: ${parseError.message}`)
      console.log('   Tentando correção automática...')
      
      try {
        // Tentar extrair apenas a parte JSON válida
        const rawContent = extraction.choices[0]?.message?.content || ''
        const jsonMatch = rawContent.match(/\{[\s\S]*\}/)
        
        if (jsonMatch) {
          // Tentar consertar JSON truncado
          let fixedJson = jsonMatch[0]
          
          // Adicionar fechamentos se necessário
          const openBrackets = (fixedJson.match(/\[/g) || []).length
          const closeBrackets = (fixedJson.match(/\]/g) || []).length
          const openBraces = (fixedJson.match(/\{/g) || []).length
          const closeBraces = (fixedJson.match(/\}/g) || []).length
          
          // Adicionar colchetes faltantes
          for (let i = closeBrackets; i < openBrackets; i++) {
            fixedJson += ']'
          }
          
          // Adicionar chaves faltantes
          for (let i = closeBraces; i < openBraces; i++) {
            fixedJson += '}'
          }
          
          // Remover vírgula final se houver
          fixedJson = fixedJson.replace(/,\s*([}\]])/g, '$1')
          
          result = JSON.parse(fixedJson)
          console.log('   ✅ JSON corrigido com sucesso')
        } else {
          throw new Error('Não foi possível extrair JSON válido')
        }
      } catch (fixError) {
        console.log('   ❌ Não foi possível corrigir o JSON')
        // Criar estrutura mínima
        result = {
          transactions: [],
          cards: [],
          summary: {
            total: 0,
            period: 'Não identificado',
            currency: 'EUR'
          }
        }
      }
    }
    
    console.log(`✅ Extraídas ${result.transactions?.length || 0} transações`)
    if (result.cards?.length > 0) {
      console.log(`💳 Detectados ${result.cards.length} cartões`)
    }
    
    // Detectar informações adicionais de cartões no texto
    const cardNumbers = [...extractedText.matchAll(/\d{4}\*{6,8}\d{4}/g)].map(m => m[0])
    const uniqueCards = [...new Set(cardNumbers)]
    
    if (uniqueCards.length > 0 && (!result.cards || result.cards.length === 0)) {
      result.cards = uniqueCards.map(num => ({
        last_four: num.slice(-4),
        full_number: num,
        holder_name: null,
        brand: null
      }))
    }
    
    // ========================================
    // RESPOSTA FINAL
    // ========================================
    const processingTime = Date.now() - startTime
    
    const response = {
      success: true,
      document: {
        type: docInfo.type,
        bank: docInfo.bank || 'Não identificado',
        period: docInfo.period || result.summary?.period
      },
      extraction: {
        method: extractionMethod,
        confidence: confidence,
        textLength: extractedText.length,
        processingTimeMs: processingTime
      },
      transactions: result.transactions || [],
      cards: result.cards || [],
      summary: result.summary || {},
      metadata: {
        fileName: file.name,
        fileSize: file.size,
        processingTime: processingTime,
        extractionMethod: extractionMethod
      }
    }
    
    console.log('\n✅ Processamento concluído com sucesso!')
    console.log(`   Tempo total: ${processingTime}ms`)
    
    return NextResponse.json(response)
    
  } catch (error: any) {
    console.error('❌ Erro fatal:', error)
    return NextResponse.json({
      error: error.message || 'Erro ao processar PDF',
      suggestion: 'Tente com um PDF diferente ou contate o suporte'
    }, { status: 500 })
  }
}

// GET: Verificar status do sistema
export async function GET() {
  return NextResponse.json({
    status: 'ready',
    methods: {
      'pdf-parse': { 
        status: 'active', 
        description: 'Extração de texto de PDFs digitais',
        cost: 'free', 
        confidence: 95 
      },
      'pdfjs-dist': { 
        status: 'fallback', 
        description: 'Método alternativo para PDFs complexos',
        cost: 'free', 
        confidence: 90 
      },
      'ocr': {
        status: 'not_available',
        description: 'OCR para PDFs escaneados não disponível',
        suggestion: 'Use PDFs digitais baixados do banco'
      }
    },
    limits: {
      maxFileSize: '10MB',
      supportedFormats: ['application/pdf'],
      requirements: 'PDF deve conter texto selecionável (não escaneado)'
    }
  })
}