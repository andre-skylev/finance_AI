import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

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

    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: 'Arquivo muito grande (máximo 10MB)' }, { status: 400 })
    }

    console.log(`📄 Processando PDF: ${file.size} bytes`)

    const buffer = Buffer.from(await file.arrayBuffer())
    let extractedText = ''
    let extractionMethod = 'unknown'

    // Estratégia simplificada: sempre usa pdf-parse
    try {
      console.log('Tentando extrair texto com pdf-parse...')
      const pdfParse = require('pdf-parse')
      
      const pdfData = await pdfParse(buffer, {
        max: 0, // Processar todas as páginas
        normalizeWhitespace: true,
      })
      
      extractedText = pdfData.text || ''
      extractionMethod = 'pdf-parse'
      
      if (extractedText.trim().length < 100) {
        console.log('⚠️ Texto extraído muito curto, pode ser PDF escaneado')
        // Continue mesmo assim, OpenAI pode tentar processar
      } else {
        console.log(`✅ Texto extraído: ${extractedText.length} caracteres`)
      }
      
    } catch (parseError: any) {
      console.error('❌ Erro no pdf-parse:', parseError.message)
      return NextResponse.json({ 
        error: 'Não foi possível processar o PDF. Tente com um arquivo diferente.',
        details: 'PDF pode estar corrompido ou ser escaneado. Use PDFs digitais do seu banco.',
        suggestion: 'Baixe o extrato/fatura diretamente do site do banco em formato PDF.'
      }, { status: 400 })
    }

    if (!extractedText.trim()) {
      return NextResponse.json({ 
        error: 'PDF não contém texto extraível',
        suggestion: 'Use um PDF digital (não escaneado) baixado diretamente do banco.'
      }, { status: 400 })
    }

    // Identificar tipo de documento e banco
    console.log('🏦 Identificando banco e tipo de documento...')
    
    // Verificar se é fatura de cartão
    const isCreditCard = /cart[ãa]o|cr[ée]dito|fatura|invoice|statement/i.test(extractedText)
    const documentType = isCreditCard ? 'credit_card_statement' : 'bank_statement'
    
    // Detectar banco por palavras-chave
    let detectedBank = 'Banco não identificado'
    const bankPatterns = [
      { name: 'Novo Banco', pattern: /novo\s*banco/i },
      { name: 'Millennium BCP', pattern: /millennium|bcp/i },
      { name: 'Santander', pattern: /santander/i },
      { name: 'Caixa Geral de Depósitos', pattern: /caixa\s*geral|cgd/i },
      { name: 'BPI', pattern: /\bbpi\b/i },
      { name: 'Montepio', pattern: /montepio/i },
      { name: 'Nubank', pattern: /nubank|nu\s*pagamentos/i },
      { name: 'Itaú', pattern: /ita[uú]/i },
      { name: 'Bradesco', pattern: /bradesco/i },
    ]
    
    for (const bank of bankPatterns) {
      if (bank.pattern.test(extractedText)) {
        detectedBank = bank.name
        break
      }
    }
    
    console.log(`📋 Tipo: ${documentType}, Banco: ${detectedBank}`)

    // Buscar contas do usuário
    const { data: accounts } = await supabase
      .from('accounts')
      .select('id, name, bank_name')
      .eq('user_id', user.id)

    // Buscar cartões do usuário
    const { data: creditCards } = await supabase
      .from('credit_cards')
      .select('id, card_name, bank_name, last_four_digits')
      .eq('user_id', user.id)
      .eq('is_active', true)

    // Extrair transações usando OpenAI
    console.log('🤖 Processando transações com IA...')
    
    const systemPrompt = isCreditCard 
      ? `Você é um especialista em análise de faturas de cartão de crédito. 
         Extraia TODAS as transações da fatura, incluindo:
         - Data, comerciante/descrição, valor (sempre positivo para compras)
         - Parcelas (formato X/Y se houver)
         - Categorize: alimentacao, transporte, saude, educacao, lazer, casa, compras, servicos, outros`
      : `Você é um especialista em análise de extratos bancários.
         Extraia TODAS as transações, incluindo:
         - Data, descrição, valor (negativo para débitos, positivo para créditos)
         - Categorize: alimentacao, transporte, saude, educacao, lazer, casa, servicos, transferencia, salario, outros`

    const transactionExtraction = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `${systemPrompt}
          
Retorne APENAS um JSON válido no formato:
{
  "transactions": [
    {
      "date": "YYYY-MM-DD",
      "merchant": "nome do comerciante (para cartão)",
      "description": "descrição da transação",
      "amount": number,
      "category": "categoria",
      "type": "debit" ou "credit",
      "installments": null ou número total de parcelas,
      "installment_info": null ou "X/Y"
    }
  ],
  "summary": {
    "period": "período do extrato/fatura",
    "total_debits": number,
    "total_credits": number,
    "balance": number
  }
}`
        },
        {
          role: 'user',
          content: `Extraia todas as transações deste ${documentType === 'credit_card_statement' ? 'fatura de cartão' : 'extrato bancário'}:\n\n${extractedText.substring(0, 15000)}`
        }
      ],
      temperature: 0.1,
      max_tokens: 4000,
      response_format: { type: "json_object" }
    })

    const extractionResult = transactionExtraction.choices[0]?.message?.content?.trim()
    
    if (!extractionResult) {
      throw new Error('Não foi possível extrair transações do PDF')
    }

    let parsedResult
    try {
      parsedResult = JSON.parse(extractionResult)
    } catch (e) {
      console.error('Erro ao fazer parse do JSON:', e)
      throw new Error('Erro ao processar dados extraídos')
    }

    // Detectar cartões múltiplos se for fatura
    let detectedCards: any[] = []
    if (isCreditCard) {
      const cardNumberRegex = /\d{4}\*{6,8}\d{4}/g
      const cardNumbers = [...new Set([...extractedText.matchAll(cardNumberRegex)].map(m => m[0]))]
      
      detectedCards = cardNumbers.map((cardNumber, index) => ({
        cardNumber,
        lastFourDigits: cardNumber.slice(-4),
        isMain: index === 0,
        bank: detectedBank
      }))
      
      console.log(`💳 Detectados ${detectedCards.length} cartões`)
    }

    // Resultado final
    const response = {
      success: true,
      document_type: documentType,
      detected_bank: detectedBank,
      extracted_text_length: extractedText.length,
      transactions: parsedResult.transactions || [],
      summary: parsedResult.summary || {},
      detected_cards: detectedCards,
      user_accounts: accounts || [],
      user_credit_cards: creditCards || [],
      processing_method: extractionMethod,
      processing_time: Date.now() - processingStart,
    }

    console.log(`✅ Processamento concluído: ${response.transactions.length} transações`)

    return NextResponse.json(response)

  } catch (error: any) {
    console.error('❌ Erro ao processar PDF:', error)
    
    return NextResponse.json({ 
      error: error.message || 'Erro interno do servidor',
      suggestion: 'Verifique se o PDF é um extrato/fatura válido baixado do banco.'
    }, { status: 500 })
  }
}

const processingStart = Date.now()