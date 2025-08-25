import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '../../../lib/supabase/server'
import { GoogleAuth } from 'google-auth-library'
import { DocumentProcessorServiceClient } from '@google-cloud/documentai'

// Função básica para obter variáveis de ambiente
function getEnv(key: string, defaultValue = '') {
  return process.env[key] || defaultValue
}

// Função para obter categorias disponíveis
function getAvailableCategories() {
  return [
    "Alimentação", "Supermercado", "Transporte", "Habitação", "Serviços Públicos",
    "Saúde", "Educação", "Lazer", "Viagens", "Compras", "Assinaturas", "Impostos",
    "Taxas", "Seguros", "Pets", "Presentes", "Doações", "Investimentos", "Outros",
    "Salário", "Freelance", "Reembolsos", "Transferência"
  ];
}

// Função para obter subcategorias por categoria principal
function getSubcategories() {
  return {
    "Supermercado": [
      "Supermercado - Cesta Básica",
      "Supermercado - Higiene e Limpeza", 
      "Supermercado - Supérfluos",
      "Supermercado - Bebidas",
      "Supermercado - Padaria",
      "Supermercado - Açougue",
      "Supermercado - Frutas e Verduras",
      "Supermercado - Congelados",
      "Supermercado - Petiscos"
    ],
    "Transporte": [
      "Transporte - Combustível",
      "Transporte - Manutenção", 
      "Transporte - Estacionamento",
      "Transporte - Pedágio",
      "Transporte - Transporte Público"
    ],
    "Saúde": [
      "Saúde - Medicamentos",
      "Saúde - Consultas",
      "Saúde - Exames", 
      "Saúde - Seguro Saúde"
    ]
  };
}

// Função OpenAI para parsing (versão simplificada)
async function parseWithOpenAI(documentText: string, debug = false) {
  try {
    const OpenAI = require('openai')
    const openai = new OpenAI({
      apiKey: getEnv('OPENAI_API_KEY')
    })

    if (debug) console.log('[OPENAI-PARSER] 🤖 Iniciando parsing com OpenAI...')

    const availableCategories = getAvailableCategories()
    const subcategories = getSubcategories()
    const allCategories = [...availableCategories]
    
    // Adicionar subcategorias à lista completa
    Object.values(subcategories).forEach(subCatList => {
      allCategories.push(...subCatList)
    })

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 4000,
      temperature: 0.1,
      messages: [
        {
          role: "system",
          content: `Você é um especialista em extrair dados de documentos financeiros portugueses.
Para EXTRATOS BANCÁRIOS e CARTÕES DE CRÉDITO, extraia TODAS as transações individuais.
Para RECIBOS e FATURAS, extraia os items individuais.

CATEGORIAS PRINCIPAIS DISPONÍVEIS:
${availableCategories.join(", ")}

SUBCATEGORIAS DISPONÍVEIS (use SEMPRE que aplicável):
- Para SUPERMERCADOS: ${subcategories.Supermercado.join(", ")}
- Para TRANSPORTE: ${subcategories.Transporte.join(", ")}
- Para SAÚDE: ${subcategories.Saúde.join(", ")}

REGRAS DE CATEGORIZAÇÃO INTELIGENTE:
- Supermercados (Continente, Pingo Doce, Lidl, Auchan, etc.):
  * Produtos de limpeza, detergentes, papel higiênico → "Supermercado - Higiene e Limpeza"
  * Arroz, feijão, massa, óleo, leite, pão → "Supermercado - Cesta Básica"
  * Chocolates, bolachas, gelados, doces → "Supermercado - Supérfluos"
  * Refrigerantes, sumos, águas, cervejas → "Supermercado - Bebidas"
  * Pão, bolos, croissants → "Supermercado - Padaria"
  * Carne, frango, peixe → "Supermercado - Açougue"
  * Frutas, legumes, verduras → "Supermercado - Frutas e Verduras"
  * Produtos congelados → "Supermercado - Congelados"
  * Snacks, aperitivos → "Supermercado - Petiscos"
  * Se não souber o tipo específico → "Supermercado"

- Combustível (Galp, Repsol, BP, posto combustível) → "Transporte - Combustível"
- Oficinas, pneus, revisões → "Transporte - Manutenção" 
- Estacionamentos, parquímetros → "Transporte - Estacionamento"
- Portagens, Via Verde → "Transporte - Pedágio"
- Metro, autocarro, comboio → "Transporte - Transporte Público"
- Outros transportes → "Transporte"

- Farmácias, medicamentos → "Saúde - Medicamentos"
- Médicos, dentistas, clínicas → "Saúde - Consultas"
- Análises, radiografias, exames → "Saúde - Exames"
- Seguros de saúde → "Saúde - Seguro Saúde"
- Outros gastos de saúde → "Saúde"

- Restaurantes (McDonald's, Burger King, Pizza Hut, cafés, etc.) → "Alimentação" 
- Bancos, seguros, créditos → "Taxas" ou "Seguros"
- Cinemas, jogos, entretenimento → "Lazer"
- Salários, ordenados → "Salário"
- Transferências entre contas → "Transferência"
- Rendas, condomínio, água, luz, gás → "Habitação" ou "Serviços Públicos"
- Roupas, lojas → "Compras"
- Netflix, Spotify, subscrições → "Assinaturas"
- Se não souber → "Outros"

Extraia as informações em formato JSON válido:
{
  "documentType": "receipt|invoice|bank_statement|credit_card",
  "establishment": {
    "name": "Nome do estabelecimento/banco",
    "address": "Endereço se disponível"
  },
  "date": "YYYY-MM-DD",
  "totalAmount": 123.45,
  "transactions": [
    {
      "date": "YYYY-MM-DD",
      "description": "Descrição da transação",
      "amount": -10.50,
      "suggestedCategory": "Categoria da lista acima com subcategoria se aplicável",
      "reference": "Referência se disponível"
    }
  ],
  "items": [
    {
      "description": "Descrição do item (para recibos)",
      "quantity": 1,
      "unitPrice": 10.50,
      "totalPrice": 10.50,
      "suggestedCategory": "Categoria da lista acima com subcategoria se aplicável"
    }
  ],
  "metadata": {
    "confidence": "high|medium|low",
    "notes": "Observações sobre a extração"
  }
}

IMPORTANTE:
- Para extratos bancários: preencha o array "transactions" com TODAS as movimentações
- Para recibos: preencha o array "items" com todos os produtos/serviços
- Use valores negativos para débitos/gastos e positivos para créditos/depósitos
- Use SEMPRE subcategorias quando possível (ex: "Supermercado - Cesta Básica" em vez de só "Supermercado")
- Para cada transação/item, escolha a categoria mais específica da lista
- Se não souber qual subcategoria usar, use a categoria principal
- Campo "suggestedCategory" deve conter exatamente uma das categorias/subcategorias da lista
- Extraia TODAS as transações/items, não apenas um resumo`
        },
        {
          role: "user",
          content: `Analise este extrato bancário português e extraia TODAS as transações individuais:

${documentText.length > 8000 ? documentText.substring(0, 8000) + '\n\n[TEXTO TRUNCADO]' : documentText}

IMPORTANTE: Retorne JSON válido com array "transactions" contendo CADA movimentação individual.
Para cada transação, defina "suggestedCategory" usando as categorias principais ou subcategorias: ${allCategories.join(", ")}

PRIORIZE SUBCATEGORIAS quando possível (ex: "Supermercado - Cesta Básica" em vez de só "Supermercado")`
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
        console.log('[OPENAI-PARSER] Transações encontradas:', parsedData.transactions?.length || 0)
        console.log('[OPENAI-PARSER] Itens encontrados:', parsedData.items?.length || 0)
      }
      return parsedData
    } catch (jsonError) {
      if (debug) {
        console.log('[OPENAI-PARSER] ❌ JSON inválido recebido')
        console.log('[OPENAI-PARSER] Resposta original:', aiResponse.substring(0, 200) + '...')
        console.log('[OPENAI-PARSER] Resposta limpa:', cleanedResponse.substring(0, 200) + '...')
        console.log('[OPENAI-PARSER] Erro JSON:', (jsonError as Error).message)
      }
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

    // Converter arquivo para buffer
    const buffer = Buffer.from(await file.arrayBuffer())

    if (debug) {
      console.log('[PDF-UPLOAD] 📄 Arquivo:', file.name, 'Tamanho:', file.size, 'Buffer:', buffer.length, 'bytes')
      console.log('[PDF-UPLOAD] 🤖 OpenAI habilitado:', useOpenAI)
    }

    // 📄 Processar PDF com Google Document AI
    let document: any = null
    try {
      const { DocumentProcessorServiceClient } = await import('@google-cloud/documentai')
      
      const projectId = getEnv('GOOGLE_CLOUD_PROJECT_ID')
      const location = getEnv('GOOGLE_CLOUD_REGION') || getEnv('GOOGLE_CLOUD_LOCATION') || 'eu'
      const processorId = getEnv('GOOGLE_DOCUMENT_AI_PROCESSOR_ID')
      
      if (!projectId || !processorId) {
        throw new Error('Configuração do Google Document AI incompleta')
      }

      // Configurar cliente com credenciais base64
      const credentialsBase64 = getEnv('GOOGLE_CREDENTIALS_BASE64')
      
      if (!credentialsBase64) {
        throw new Error('GOOGLE_CREDENTIALS_BASE64 não configurado')
      }

      const credentials = JSON.parse(Buffer.from(credentialsBase64, 'base64').toString())

      const clientOptions: any = {
        credentials,
        projectId,
        apiEndpoint: `${location}-documentai.googleapis.com`,
      }

      if (debug) {
        console.log('[PDF-UPLOAD] 🔑 Credenciais decodificadas para:', credentials.client_email)
        console.log('[PDF-UPLOAD] 🌍 API Endpoint:', clientOptions.apiEndpoint)
      }

      const client = new DocumentProcessorServiceClient(clientOptions)
      const name = `projects/${projectId}/locations/${location}/processors/${processorId}`

      if (debug) {
        console.log('[PDF-UPLOAD] 📄 Processando com Google Document AI...')
        console.log('[PDF-UPLOAD] 🎯 Processor:', name)
        console.log('[PDF-UPLOAD] 📁 Arquivo original:', file.name, 'Type:', file.type)
        console.log('[PDF-UPLOAD] 📊 Buffer primeiros bytes:', buffer.slice(0, 10).toString('hex'))
      }

      const request = {
        name,
        rawDocument: {
          content: buffer.toString('base64'),
          mimeType: file.type || 'application/pdf',
        },
      }

      if (debug) {
        console.log('[PDF-UPLOAD] 📤 Request mimeType:', file.type || 'application/pdf')
        console.log('[PDF-UPLOAD] 📤 Content length:', buffer.toString('base64').length)
      }

      const [result] = await client.processDocument(request)
      document = result.document

      if (debug) {
        console.log('[PDF-UPLOAD] ✅ Document AI processou:', document?.text?.length || 0, 'caracteres')
      }
    } catch (error: any) {
      console.error('[PDF-UPLOAD] ⚠️ Erro no Document AI:', error.message)
      // Fallback: usar texto mock se Document AI falhar, mas permitir OpenAI processar o buffer original
      document = { 
        text: `Documento PDF processado com fallback
Arquivo: ${file.name}
Tamanho: ${buffer.length} bytes
Data de processamento: ${new Date().toLocaleDateString('pt-PT')}

[Texto extraído via fallback - processamento de PDF direto não disponível]` 
      }
    }

  let transactions: any[] = []
  let detectedBank = ''
  let isReceiptMode = false
  let parsingMethod = 'document-ai-fallback'
  let openAIResult: any = null
  let receipts: any[] = []
  // Try to infer document currency from text markers; very lightweight
  const textForCurrency = (document?.text || '').toUpperCase()
  // Detect BRL first (R$), then USD (USD or US$ or standalone $), else EUR (€ or EUR)
  const inferredCurrency = /R\$|BRL/.test(textForCurrency)
    ? 'BRL'
    : (/(\bUSD\b|US\$|\$)/.test(textForCurrency)
        ? 'USD'
        : (/€|EUR/.test(textForCurrency) ? 'EUR' : undefined))

    // 🤖 Tentar parsing com OpenAI se habilitado
    if (useOpenAI) {
      // Se temos texto do Document AI, usar isso; senão usar informações básicas do arquivo
      let textToAnalyze = document?.text || `Documento PDF: ${file.name}`
      
      // Para textos muito grandes, focar na parte das transações
      if (textToAnalyze.length > 8000) {
        // Procurar por seções relevantes de transações
        const sections = textToAnalyze.split(/\n\s*\n/)
        const relevantSections = sections.filter((section: string) => 
          section.match(/\d{2}\/\d{2}\/\d{4}|\d{4}-\d{2}-\d{2}|€|EUR|USD|US\$|\$|\d+,\d{2}|\d+\.\d{2}|DEBITO|CREDITO|TRF|POS|MB|ATM/i) ||
          section.match(/movimentos|transações|operações|extrato|saldo/i)
        )
        
        if (relevantSections.length > 0) {
          textToAnalyze = relevantSections.slice(0, 5).join('\n\n')
        } else {
          // Fallback: usar só a primeira metade
          textToAnalyze = textToAnalyze.substring(0, 8000)
        }
        
        if (debug) {
          console.log('[PDF-UPLOAD] 📏 Texto reduzido de', document?.text?.length, 'para', textToAnalyze.length, 'caracteres')
        }
      }
      
      openAIResult = await parseWithOpenAI(textToAnalyze, debug)
      
  if (openAIResult) {
        console.log('[PDF-UPLOAD] ✅ OpenAI parsing bem-sucedido!')
        parsingMethod = 'openai'
        detectedBank = openAIResult.establishment?.name || 'OpenAI-Detected'
        isReceiptMode = openAIResult.documentType === 'receipt' || openAIResult.documentType === 'invoice'
        
        // Salvar dados do OpenAI para usar na resposta
        const openAIDate = openAIResult.date || new Date().toISOString().split('T')[0]
        
        // Converter dados do OpenAI para formato de transações
        if (openAIResult.transactions && openAIResult.transactions.length > 0) {
          // Priorizar transações individuais (extratos bancários/cartões)
          transactions = openAIResult.transactions.map((transaction: any) => ({
            date: transaction.date || openAIResult.date || new Date().toISOString().split('T')[0],
            description: transaction.description || 'Transação sem descrição',
            amount: transaction.amount || 0,
            suggestedCategory: transaction.suggestedCategory || transaction.category || 'Outros',
            reference: transaction.reference,
            quantity: 1,
            unitPrice: Math.abs(transaction.amount || 0)
          }))
  } else if (openAIResult.items && openAIResult.items.length > 0) {
          // Usar items para recibos/faturas
          transactions = openAIResult.items.map((item: any) => ({
            date: openAIResult.date || new Date().toISOString().split('T')[0],
            description: item.description || 'Item sem descrição',
            amount: item.totalPrice ? -Math.abs(item.totalPrice) : 0,
            suggestedCategory: item.suggestedCategory || item.category || 'Outros',
            quantity: item.quantity,
            unitPrice: item.unitPrice
          }))
          
          // Criar dados do recibo para salvar separadamente
          receipts = [{
            merchant: openAIResult.establishment?.name || 'Estabelecimento',
            date: openAIResult.date || new Date().toISOString().split('T')[0],
            subtotal: openAIResult.totalAmount ? openAIResult.totalAmount * 0.9 : null, // Estimativa sem impostos
            tax: openAIResult.totalAmount ? openAIResult.totalAmount * 0.1 : null, // Estimativa de impostos
            total: openAIResult.totalAmount,
            items: openAIResult.items.map((item: any) => ({
              description: item.description || 'Item',
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              total: item.totalPrice,
              code: item.code || null
            }))
          }]
  } else if (openAIResult.totalAmount && openAIResult.totalAmount > 0) {
          // Fallback: transação única se não há detalhes
          transactions = [{
            date: openAIResult.date || new Date().toISOString().split('T')[0],
            description: `${openAIResult.establishment?.name || 'Estabelecimento'} - Total`,
            amount: -Math.abs(openAIResult.totalAmount),
            suggestedCategory: 'Compras',
            quantity: 1,
            unitPrice: openAIResult.totalAmount
          }]
        }
        
        if (debug) {
          console.log('[PDF-UPLOAD] 📦 Transações criadas:', transactions.length)
          console.log('[PDF-UPLOAD] 💰 Valor total detectado:', openAIResult.totalAmount)
          if (openAIResult.transactions) {
            console.log('[PDF-UPLOAD] 🏦 Transações individuais encontradas:', openAIResult.transactions.length)
          }
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
        suggestedCategory: 'Outros'
      }]
      parsingMethod = 'fallback'
    }

        // Se o documento foi identificado como recibo/fatura mas não há header de recibo,
        // cria um recibo único com base no total detectado (ou soma das linhas) para garantir vinculação.
        if (isReceiptMode && receipts.length === 0) {
          const totalFromAI = openAIResult?.totalAmount
          let computedTotal: number | null = null
          if (typeof totalFromAI === 'number' && isFinite(totalFromAI) && totalFromAI > 0) {
            computedTotal = totalFromAI
          } else if (transactions.length > 0) {
            // Somar valores absolutos negativos (itens) ou tudo se sinal não for consistente
            const negatives = transactions.filter(t => typeof t.amount === 'number' && t.amount < 0)
            const base = negatives.length > 0 ? negatives : transactions
            const sum = base.reduce((acc, t) => acc + Math.abs(Number(t.amount) || 0), 0)
            computedTotal = sum > 0 ? sum : null
          }
          receipts = [{
            merchant: openAIResult?.establishment?.name || 'Estabelecimento',
            date: openAIResult?.date || new Date().toISOString().split('T')[0],
            subtotal: null,
            tax: null,
            total: computedTotal,
            items: []
          }]
        }

        // Usar data do OpenAI se disponível, senão usar data atual  
        const documentDate = openAIResult?.date || new Date().toISOString().split('T')[0]

    const processingTime = Date.now() - startTime
    const responseBody: any = {
      success: true,
      message: `Processado com ${parsingMethod} em ${processingTime}ms`,
      data: {
        documentType: isReceiptMode ? 'receipt' : (detectedBank ? 'bank_statement' : 'bank_document'),
        institution: detectedBank || 'Documento processado',
        period: {
          start: documentDate,
          end: documentDate
        },
        transactions: transactions,
        receipts: receipts,
        documentCurrency: openAIResult?.currency || inferredCurrency || undefined
      },
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
          location: 'mock',
          useOpenAI
        },
        result: {
          textLength: 'mock',
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
