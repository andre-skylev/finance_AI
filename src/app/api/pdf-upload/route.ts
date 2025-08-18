import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import OpenAI from 'openai'
import path from 'path'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

// Funções para controle de uso do Google Document AI
async function checkDailyUsage(): Promise<number> {
  try {
    const today = new Date().toISOString().split('T')[0]
    const supabase = await createClient()
    
    const { data, error } = await supabase
      .from('google_ai_usage')
      .select('count')
      .eq('date', today)
      .single()
    
    if (error && error.code !== 'PGRST116') { // Não é erro de "não encontrado"
      console.error('Erro ao verificar uso diário:', error)
      return 0
    }
    
    return data?.count || 0
  } catch (error) {
    console.error('Erro ao verificar uso diário:', error)
    return 0
  }
}

async function incrementDailyUsage(): Promise<void> {
  try {
    const today = new Date().toISOString().split('T')[0]
    const supabase = await createClient()
    
    const { error } = await supabase
      .from('google_ai_usage')
      .upsert({
        date: today,
        count: await checkDailyUsage() + 1
      })
    
    if (error) {
      console.error('Erro ao incrementar uso diário:', error)
    }
  } catch (error) {
    console.error('Erro ao incrementar uso diário:', error)
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Verificar autenticação
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File
    
    if (!file) {
      return NextResponse.json({ error: 'Nenhum arquivo fornecido' }, { status: 400 })
    }

    if (file.type !== 'application/pdf') {
      return NextResponse.json({ error: 'Apenas arquivos PDF são aceitos' }, { status: 400 })
    }

    if (file.size > 10 * 1024 * 1024) { // 10MB
      return NextResponse.json({ error: 'Arquivo muito grande (máximo 10MB)' }, { status: 400 })
    }

    console.log(`Processando PDF: ${file.size} bytes`)

    const buffer = Buffer.from(await file.arrayBuffer())
    let extractedText = ''

    // Estratégia simplificada: pdf-parse primeiro, Google Document OCR como fallback
    try {
      // Método 1: pdf-parse (gratuito) para PDFs com texto selecionável
      const Module = require('module')
      const originalRequire = Module.prototype.require

      // Patch temporário para pdf-parse
      Module.prototype.require = function(...args: any[]) {
        if (args[0] === 'fs') {
          const fs = originalRequire.apply(this, arguments)
          return {
            ...fs,
            readFileSync: (path: string, options?: any) => {
              if (typeof path === 'string' && path.includes('pdf-parse')) {
                throw new Error('ENOENT: no such file or directory')
              }
              return fs.readFileSync(path, options)
            }
          }
        }
        return originalRequire.apply(this, arguments)
      }

      const pdfParse = require('pdf-parse')
      
      // Restaurar require original
      Module.prototype.require = originalRequire
      
      const pdfData = await pdfParse(buffer, {
        max: 0, // Processar todas as páginas
        pagerender: () => null, // Evitar renderização de páginas
        normalizeWhitespace: true,
        disableCombineTextItems: false
      })
      
      extractedText = pdfData.text || ''
      console.log(`Texto extraído via pdf-parse: ${extractedText.length} caracteres`)
      
    } catch (parseError) {
      console.log('pdf-parse falhou, usando Google Document OCR...')
      
      // Método 2: Google Cloud Vision OCR (pago) para PDFs escaneados ou complexos
      try {
        // Verificar se atingiu limite diário (controle de custos)
        const dailyUsage = await checkDailyUsage()
        const DAILY_LIMIT = parseInt(process.env.GOOGLE_AI_DAILY_LIMIT || '50')
        
        if (dailyUsage >= DAILY_LIMIT) {
          throw new Error('Limite diário do Google Vision OCR atingido')
        }

        const vision = await import('@google-cloud/vision')
        
        // Resolver caminho das credenciais
        const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS
        const resolvedCredentialsPath = credentialsPath?.startsWith('./') 
          ? path.resolve(process.cwd(), credentialsPath)
          : credentialsPath
        
        const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID
        // Use 'eu' region endpoint for Vision API
        const location = process.env.GOOGLE_CLOUD_REGION || 'eu'
        
        // Configurar cliente Google Vision com endpoint EU
        const client = new vision.ImageAnnotatorClient({
          projectId: projectId,
          keyFilename: resolvedCredentialsPath,
          apiEndpoint: location === 'eu' ? 'eu-vision.googleapis.com' : undefined,
        })

        if (!projectId) {
          throw new Error('Credenciais do Google Cloud não configuradas')
        }

        console.log('Processando com Google Vision OCR (custo aplicado)...')

        // Para PDFs, precisamos processar de forma diferente
        // Vision API tem melhor suporte via async batch processing para PDFs
        try {
          // Primeiro tenta processar como documento
          const [result] = await client.textDetection({
            image: {
              content: buffer,
            },
          })

          if (result.fullTextAnnotation?.text) {
            extractedText = result.fullTextAnnotation.text
            console.log(`Texto extraído via Google Vision OCR: ${extractedText.length} caracteres`)
          } else if (result.textAnnotations && result.textAnnotations.length > 0) {
            // Fallback para texto simples
            extractedText = result.textAnnotations[0].description || ''
            console.log(`Texto extraído via Google Vision OCR (annotations): ${extractedText.length} caracteres`)
          } else {
            // Se ainda não conseguiu, tenta converter PDF para imagem primeiro
            console.log('Vision API não conseguiu processar PDF diretamente, tentando método alternativo...')
            
            // Usar pdf-parse para extrair páginas como texto
            const pdfParse = require('pdf-parse')
            const pdfData = await pdfParse(buffer)
            
            if (pdfData.text && pdfData.text.trim().length > 50) {
              extractedText = pdfData.text
              console.log(`Texto extraído via pdf-parse (fallback): ${extractedText.length} caracteres`)
            } else {
              throw new Error('PDF não contém texto extraível')
            }
          }
          
          // Registrar uso para controle de limite apenas se usou Vision API
          if (extractedText && result) {
            await incrementDailyUsage()
          }
        } catch (visionError: any) {
          console.log('Erro no Vision API, tentando pdf-parse como último recurso...')
          
          // Último recurso: tentar pdf-parse novamente
          const pdfParse = require('pdf-parse')
          try {
            const pdfData = await pdfParse(buffer)
            if (pdfData.text && pdfData.text.trim().length > 50) {
              extractedText = pdfData.text
              console.log(`Texto extraído via pdf-parse (último recurso): ${extractedText.length} caracteres`)
            } else {
              throw new Error('PDF não contém texto extraível')
            }
          } catch (finalError) {
            throw new Error('Google Vision OCR não conseguiu extrair texto deste PDF')
          }
        }

      } catch (googleError: any) {
        console.error('Erro no Google Vision OCR:', googleError)
        
        if (googleError.message?.includes('limite diário')) {
          throw new Error('Limite diário de processamento atingido. Tente novamente amanhã ou use um PDF com texto selecionável.')
        }
        
        if (googleError.message?.includes('não configuradas')) {
          throw new Error('Google Cloud não configurado. Configure as credenciais para processar PDFs escaneados.')
        }
        
        throw new Error('Não foi possível processar este PDF. Verifique se é um documento válido com texto legível.')
      }
    }

    if (!extractedText.trim()) {
      throw new Error('PDF não contém texto extraível')
    }

    // Identificar banco usando IA
    console.log('Identificando banco...')
    
    // Buscar padrões conhecidos para contexto
    const { data: knownBanks } = await supabase
      .from('bank_patterns')
      .select('bank_name, patterns')
      .limit(50)
    
    const knownBanksContext = knownBanks?.map(bank => 
      `${bank.bank_name}: ${bank.patterns}`
    ).join('\n') || ''

    const bankIdentification = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `Você é um especialista em identificação de bancos e instituições financeiras. Analise o texto fornecido e identifique o banco/instituição, mesmo que não esteja na lista de bancos conhecidos. Seja preciso e retorne apenas o nome do banco.`
        },
        {
          role: 'user',
          content: `Analise este texto de extrato/fatura e identifique o banco/instituição, mesmo que seja desconhecido:${knownBanksContext}\n\nTEXTO DO DOCUMENTO:\n${extractedText}`
        }
      ],
      temperature: 0,
      max_tokens: 100
    })

    const detectedBank = bankIdentification.choices[0]?.message?.content?.trim() || 'Banco não identificado'
    console.log(`Banco identificado: ${detectedBank}`)

    // Buscar contas do usuário para contexto
    const { data: accounts } = await supabase
      .from('accounts')
      .select('id, name, bank_name')
      .eq('user_id', user.id)

    // Extrair transações usando IA
    const transactionExtraction = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `Você é um especialista em análise de extratos bancários e faturas de cartão de crédito. Extraia as transações do texto fornecido e retorne em formato JSON.

Formato esperado:
{
  "transactions": [
    {
      "date": "YYYY-MM-DD",
      "description": "Descrição da transação",
      "amount": number (positivo para créditos, negativo para débitos),
      "type": "credit" | "debit",
      "category": "categoria estimada"
    }
  ],
  "account_info": {
    "bank": "nome do banco",
    "account_number": "número da conta se disponível",
    "period": "período do extrato se disponível"
  }
}

Categorias possíveis: alimentacao, transporte, saude, educacao, lazer, casa, roupas, tecnologia, servicos, transferencia, salario, outros`
        },
        {
          role: 'user',
          content: extractedText
        }
      ],
      temperature: 0.1,
      max_tokens: 2000
    })

    const extractionResult = transactionExtraction.choices[0]?.message?.content?.trim()
    
    if (!extractionResult) {
      throw new Error('Não foi possível extrair transações do PDF')
    }

    // Parse do resultado JSON
    let parsedResult
    try {
      parsedResult = JSON.parse(extractionResult)
    } catch {
      throw new Error('Erro ao processar dados extraídos. Tente com um extrato mais claro.')
    }

    return NextResponse.json({
      success: true,
      detected_bank: detectedBank,
      extracted_text_length: extractedText.length,
      transactions: parsedResult.transactions || [],
      account_info: parsedResult.account_info || {},
      user_accounts: accounts || [],
      processing_method: extractedText.length > 1000 ? 'google_ocr' : 'pdf_parse'
    })

  } catch (error: any) {
    console.error('Erro ao processar PDF:', error)
    
    // Mensagens específicas baseadas no tipo de erro
    if (error.message?.includes('Google Cloud não configurado')) {
      return NextResponse.json({ 
        error: 'Este PDF é escaneado e requer OCR. Configure as credenciais do Google Cloud para processamento avançado.',
        suggestion: 'Tente usar um extrato digital (PDF com texto selecionável) do seu banco online.'
      }, { status: 400 })
    }
    
    if (error.message?.includes('limite diário')) {
      return NextResponse.json({ 
        error: 'Limite diário de processamento atingido.',
        suggestion: 'Tente novamente amanhã ou use PDFs com texto selecionável que são processados gratuitamente.'
      }, { status: 429 })
    }
    
    return NextResponse.json({ 
      error: error.message || 'Erro interno do servidor',
      suggestion: 'Verifique se o PDF é um extrato bancário válido e tente novamente.'
    }, { status: 500 })
  }
}

// GET endpoint to check OCR usage
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    // Get current usage
    const today = new Date().toISOString().split('T')[0]
    const { data: usageData } = await supabase
      .from('google_ai_usage')
      .select('count')
      .eq('date', today)
      .single()
    
    const currentUsage = usageData?.count || 0
    const dailyLimit = parseInt(process.env.GOOGLE_AI_DAILY_LIMIT || '50')
    const remaining = Math.max(0, dailyLimit - currentUsage)
    
    return NextResponse.json({
      dailyLimit,
      currentUsage,
      remaining,
      date: today
    })
    
  } catch (error: any) {
    console.error('Usage check error:', error)
    return NextResponse.json({
      error: 'Failed to check usage'
    }, { status: 500 })
  }
}
