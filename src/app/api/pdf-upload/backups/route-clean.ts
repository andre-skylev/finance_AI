import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { GoogleAuth } from 'google-auth-library'
import { DocumentProcessorServiceClient } from '@google-cloud/documentai'

// Função básica para obter variáveis de ambiente
function getEnv(key: string, defaultValue = '') {
  return process.env[key] || defaultValue
}

// Função OpenAI para parsing (versão simplificada)
async function parseWithOpenAI(documentText: string, debug = false) {
  try {
    const OpenAI = require('openai')
    const openai = new OpenAI({
      apiKey: getEnv('OPENAI_API_KEY')
    })

    if (debug) console.log('[OPENAI-PARSER] 🤖 Iniciando parsing com OpenAI...')

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 4000,
      temperature: 0.1,
      messages: [
        {
          role: "system",
          content: `Você é um especialista em extrair dados de documentos financeiros portugueses.
Extraia as informações do documento em formato JSON válido com esta estrutura:
{
  "documentType": "receipt|invoice|bank_statement|credit_card",
  "establishment": {
    "name": "Nome do estabelecimento",
    "address": "Endereço se disponível"
  },
  "date": "YYYY-MM-DD",
  "totalAmount": 123.45,
  "items": [
    {
      "description": "Descrição do item",
      "quantity": 1,
      "unitPrice": 10.50,
      "totalPrice": 10.50,
      "category": "Categoria sugerida"
    }
  ],
  "metadata": {
    "confidence": "high|medium|low",
    "notes": "Observações sobre a extração"
  }
}

IMPORTANTE:
- Use apenas números decimais para valores monetários
- Forneça sempre um JSON válido
- Se não conseguir extrair items individuais, deixe o array vazio
- Use categorias em português (ex: "Alimentação", "Transporte", "Compras", etc.)`
        },
        {
          role: "user",
          content: `Extraia os dados deste documento financeiro português:\n\n${documentText}`
        }
      ]
    })

    let aiResponse = completion.choices[0]?.message?.content || ''
    if (debug) console.log('[OPENAI-PARSER] Resposta recebida, tamanho:', aiResponse.length)

    // Limpar resposta
    let cleanedResponse = aiResponse.trim()
    if (cleanedResponse.startsWith('```json')) {
      cleanedResponse = cleanedResponse.replace(/```json\n?/, '').replace(/\n?```$/, '')
    } else if (cleanedResponse.startsWith('```')) {
      cleanedResponse = cleanedResponse.replace(/```\n?/, '').replace(/\n?```$/, '')
    }

    // Parse JSON
    try {
      const parsedData = JSON.parse(cleanedResponse)
      if (debug) {
        console.log('[OPENAI-PARSER] ✅ JSON válido recebido')
        console.log('[OPENAI-PARSER] Tipo de documento:', parsedData.documentType)
        console.log('[OPENAI-PARSER] Estabelecimento:', parsedData.establishment?.name)
        console.log('[OPENAI-PARSER] Total:', parsedData.totalAmount)
        console.log('[OPENAI-PARSER] Itens encontrados:', parsedData.items?.length || 0)
      }
      return parsedData
    } catch (jsonError) {
      if (debug) console.log('[OPENAI-PARSER] ❌ JSON inválido recebido')
      return null
    }

  } catch (error) {
    console.error('[OPENAI-PARSER] ❌ Erro na chamada OpenAI:', error)
    return null
  }
}

export async function POST(request: NextRequest) {
  const startTime = Date.now()
  try {
    console.log('[PDF-UPLOAD] 🚀 Iniciando processamento...')

    const supabase = await createClient()
    const url = new URL(request.url)
    const formData = await request.formData()
    
    // Permitir bypass da autenticação para testes
    const isTestMode = getEnv('NODE_ENV') === 'development' && (
      url.searchParams.get('test') === '1' || 
      formData.get('test') === '1' ||
      request.headers.get('authorization')?.includes('test-token')
    )

    let user: any = null
    if (!isTestMode) {
      const { data: { user: authUser }, error } = await supabase.auth.getUser()
      if (error || !authUser) {
        return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
      }
      user = authUser
    } else {
      user = { id: 'test-user-id' }
      console.log('[PDF-UPLOAD] 🧪 Modo de teste ativado')
    }

    // Extrair parâmetros
    const file = formData.get('file') as File
    const debug = formData.get('debug') === 'true' || url.searchParams.get('debug') === '1'
    const useOpenAI = formData.get('useOpenAI') === 'true' || 
                     url.searchParams.get('useOpenAI') === '1' || 
                     getEnv('DEFAULT_USE_OPENAI') === 'true'

    if (!file) {
      return NextResponse.json({ error: 'Arquivo não fornecido' }, { status: 400 })
    }

    if (debug) {
      console.log('[PDF-UPLOAD] 📄 Arquivo:', file.name, 'Tamanho:', file.size)
      console.log('[PDF-UPLOAD] 🤖 OpenAI habilitado:', useOpenAI)
    }

    // Processar com Google Document AI
    const auth = new GoogleAuth({
      credentials: getEnv('GOOGLE_CREDENTIALS_BASE64') ? 
        JSON.parse(Buffer.from(getEnv('GOOGLE_CREDENTIALS_BASE64'), 'base64').toString()) : 
        undefined,
      scopes: ['https://www.googleapis.com/auth/cloud-platform']
    })

    const client = new DocumentProcessorServiceClient({ auth })
    const projectId = getEnv('GOOGLE_CLOUD_PROJECT_ID')
    const location = getEnv('GOOGLE_CLOUD_REGION') || getEnv('GOOGLE_CLOUD_LOCATION') || 'eu'
    const processorId = getEnv('GOOGLE_DOCUMENT_AI_PROCESSOR_ID')

    const name = `projects/${projectId}/locations/${location}/processors/${processorId}`
    const buffer = Buffer.from(await file.arrayBuffer())

    const requestDoc = {
      name,
      rawDocument: {
        content: buffer.toString('base64'),
        mimeType: file.type || 'application/pdf',
      },
    }

    const [result] = await client.processDocument(requestDoc as any)
    const document = (result as any).document as { text?: string; entities?: any[]; pages?: any[] }

    if (!document) {
      return NextResponse.json({ error: 'Falha no processamento do Document AI' }, { status: 500 })
    }

    if (debug) {
      console.log('[PDF-UPLOAD] 📊 Document AI processado')
      console.log('[PDF-UPLOAD] 📝 Texto extraído:', (document.text || '').length, 'caracteres')
    }

    let transactions: any[] = []
    let detectedBank = ''
    let isReceiptMode = false
    let parsingMethod = 'document-ai-fallback'

    // 🤖 Tentar parsing com OpenAI se habilitado
    if (useOpenAI && document.text) {
      const openAIResult = await parseWithOpenAI(document.text, debug)
      
      if (openAIResult) {
        console.log('[PDF-UPLOAD] ✅ OpenAI parsing bem-sucedido!')
        parsingMethod = 'openai'
        detectedBank = openAIResult.establishment?.name || 'OpenAI-Detected'
        isReceiptMode = openAIResult.documentType === 'receipt' || openAIResult.documentType === 'invoice'
        
        // Converter items do OpenAI para formato de transações
        if (openAIResult.items && openAIResult.items.length > 0) {
          transactions = openAIResult.items.map((item: any) => ({
            date: openAIResult.date || new Date().toISOString().split('T')[0],
            description: item.description || 'Item sem descrição',
            amount: item.totalPrice ? -Math.abs(item.totalPrice) : 0,
            category: item.category || 'Outros',
            quantity: item.quantity,
            unitPrice: item.unitPrice
          }))
        } else if (openAIResult.totalAmount && openAIResult.totalAmount > 0) {
          // Se não há items individuais, criar uma transação única
          transactions = [{
            date: openAIResult.date || new Date().toISOString().split('T')[0],
            description: `${openAIResult.establishment?.name || 'Estabelecimento'} - Total`,
            amount: -Math.abs(openAIResult.totalAmount),
            category: 'Compras',
            quantity: 1,
            unitPrice: openAIResult.totalAmount
          }]
        }
        
        if (debug) {
          console.log('[PDF-UPLOAD] 📦 Transações criadas:', transactions.length)
          console.log('[PDF-UPLOAD] 💰 Valor total detectado:', openAIResult.totalAmount)
        }
      }
    }

    // Se OpenAI não funcionou, usar fallback básico
    if (transactions.length === 0) {
      console.log('[PDF-UPLOAD] ⚠️ Fallback para extração básica')
      transactions = [{
        date: new Date().toISOString().split('T')[0],
        description: 'Documento processado (extração automática)',
        amount: 0,
        category: 'Outros'
      }]
      parsingMethod = 'fallback'
    }

    const processingTime = Date.now() - startTime
    const responseBody: any = {
      success: true,
      message: `Processado com ${parsingMethod} em ${processingTime}ms`,
      data: transactions,
      accounts: [],
      creditCards: [],
      bankInfo: {
        detectedBank,
        parsingMethod,
        documentType: isReceiptMode ? 'receipt' : 'bank_document',
        transactionsFound: transactions.length
      }
    }

    if (debug) {
      responseBody.debug = {
        config: {
          location,
          processorId,
          useOpenAI
        },
        result: {
          textLength: (document.text || '').length,
          transactionsFound: transactions.length,
          parsingMethod
        }
      }
    }

    console.log('[PDF-UPLOAD] ✅ Processamento concluído:', {
      transações: transactions.length,
      método: parsingMethod,
      tempo: processingTime + 'ms'
    })

    return NextResponse.json(responseBody)
  } catch (error: any) {
    console.error('[PDF-UPLOAD] ❌ Erro no processamento:', error)
    const msg = error?.message || 'Erro ao processar PDF'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({
    status: 'ready',
    method: 'simplified-openai-document-ai',
    description: 'Processamento com OpenAI + Google Document AI (versão simplificada)',
    configuration: {
      openaiEnabled: !!getEnv('OPENAI_API_KEY'),
      documentAiEnabled: !!getEnv('GOOGLE_CLOUD_PROJECT_ID'),
      defaultUseOpenAI: getEnv('DEFAULT_USE_OPENAI') === 'true'
    }
  })
}
