import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import path from 'path'
import { getGoogleCredentials } from '@/lib/google-auth'
import { parseBankDocument } from '@/lib/bank-parsers'
import OpenAI from 'openai'

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

// Use OpenAI to parse and organize OCR text
async function parseWithOpenAI(ocrText: string, debug: boolean = false): Promise<any> {
  try {
    console.log('[OPENAI-PARSER] 🤖 Enviando texto para OpenAI organizar...')
    console.log('[OPENAI-PARSER] Tamanho do texto:', ocrText.length, 'caracteres')
    
    if (debug) {
      console.log('[OPENAI-PARSER] Texto enviado (primeiros 300 chars):', ocrText.substring(0, 300))
    }

    const prompt = `
Analisa este texto extraído via OCR de um documento financeiro português (fatura, recibo, extrato bancário ou cartão de crédito) e organiza a informação em JSON estruturado.

TEXTO OCR:
${ocrText}

Por favor, retorna APENAS um JSON válido com esta estrutura:

{
  "documentType": "receipt|invoice|bank_statement|credit_card",
  "establishment": {
    "name": "nome da loja/banco",
    "nif": "número se encontrado",
    "address": "morada se encontrado"
  },
  "date": "YYYY-MM-DD",
  "totalAmount": 0.00,
  "currency": "EUR",
  "items": [
    {
      "description": "nome do produto/transação",
      "quantity": 1,
      "unitPrice": 0.00,
      "totalPrice": 0.00,
      "category": "categoria sugerida"
    }
  ],
  "summary": {
    "itemCount": 0,
    "subtotal": 0.00,
    "tax": 0.00,
    "total": 0.00
  },
  "metadata": {
    "confidence": "high|medium|low",
    "notes": "observações sobre a qualidade do OCR ou parsing"
  }
}

INSTRUÇÕES:
- Se for fatura/recibo: extrai produtos, preços, quantidades
- Se for extrato bancário: extrai transações com datas, descrições, valores
- Se for cartão de crédito: extrai movimentos do cartão
- Valores em formato português (vírgula decimal): 12,50 = 12.50
- Categorias sugeridas: Alimentação, Transporte, Saúde, Vestuário, etc.
- Se não conseguires identificar algo, usa null ou ""
- Confidence "high" se texto claro, "medium" se alguma incerteza, "low" se muito fragmentado
- IMPORTANTE: Se há muitos items (>20), extrai apenas os 20 primeiros para evitar resposta muito longa
- Mantém o JSON sempre válido e completo

Retorna APENAS o JSON, sem explicações.`

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "És um especialista em análise de documentos financeiros portugueses. Respondes sempre com JSON válido."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.1,
      max_tokens: 4000  // Aumentado de 2000 para 4000
    })

    const aiResponse = response.choices[0]?.message?.content?.trim()
    
    if (!aiResponse) {
      console.log('[OPENAI-PARSER] ❌ Resposta vazia da OpenAI')
      return null
    }

    console.log('[OPENAI-PARSER] ✅ Resposta recebida da OpenAI')
    if (debug) {
      console.log('[OPENAI-PARSER] Resposta completa:', aiResponse)
    }

    // Limpar markdown se presente
    let cleanedResponse = aiResponse;
    if (aiResponse.startsWith('```json')) {
      cleanedResponse = aiResponse.replace(/```json\n?/, '').replace(/\n?```$/, '');
    } else if (aiResponse.startsWith('```')) {
      cleanedResponse = aiResponse.replace(/```\n?/, '').replace(/\n?```$/, '');
    }

    // Parse JSON response
    try {
      const parsedData = JSON.parse(cleanedResponse)
      console.log('[OPENAI-PARSER] ✅ JSON válido recebido')
      console.log('[OPENAI-PARSER] Tipo de documento:', parsedData.documentType)
      console.log('[OPENAI-PARSER] Estabelecimento:', parsedData.establishment?.name)
      console.log('[OPENAI-PARSER] Total:', parsedData.totalAmount)
      console.log('[OPENAI-PARSER] Itens encontrados:', parsedData.items?.length || 0)
      console.log('[OPENAI-PARSER] Confiança:', parsedData.metadata?.confidence)
      
      return parsedData
    } catch (jsonError) {
      console.log('[OPENAI-PARSER] ❌ JSON incompleto ou malformado. Tentando reparar...')
      
      // Tentar reparar JSON incompleto
      try {
        let repairedJson = cleanedResponse;
        
        // Se termina com vírgula e abre chaves, completar o JSON
        if (repairedJson.includes('"items": [') && !repairedJson.includes(']')) {
          const itemsStart = repairedJson.indexOf('"items": [');
          const beforeItems = repairedJson.substring(0, itemsStart);
          
          // Criar um JSON simplificado sem os items incompletos
          repairedJson = beforeItems + `"items": [],
  "summary": {
    "itemCount": 0,
    "subtotal": 0,
    "tax": 0,
    "total": 0
  },
  "metadata": {
    "confidence": "medium",
    "notes": "Resposta truncada, items não extraídos completamente"
  }
}`;
        }
        
        const repairedData = JSON.parse(repairedJson);
        console.log('[OPENAI-PARSER] ✅ JSON reparado com sucesso')
        console.log('[OPENAI-PARSER] Dados básicos salvos:', repairedData.documentType, repairedData.totalAmount)
        
        return repairedData;
        
      } catch (repairError: any) {
        console.log('[OPENAI-PARSER] ❌ Falha ao reparar JSON:', repairError?.message || repairError)
        console.log('[OPENAI-PARSER] Resposta que falhou (primeiros 500 chars):', cleanedResponse.substring(0, 500))
        return null
      }
    }

  } catch (error) {
    console.error('[OPENAI-PARSER] ❌ Erro na chamada OpenAI:', error)
    return null
  }
}

type DocAIEntity = {
  type?: string
  mentionText?: string
  properties?: DocAIEntity[]
  normalizedValue?: { text?: string; numberValue?: number }
};

// Controle de uso (opcional, para custos)
async function checkDailyUsage(): Promise<number> {
  try {
    const today = new Date().toISOString().split('T')[0]
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('google_ai_usage')
      .select('count')
      .eq('date', today)
      .single()
    if (error && (error as any).code !== 'PGRST116') return 0
    return data?.count || 0
  } catch {
    return 0
  }
}

async function incrementDailyUsage(delta = 1): Promise<void> {
  try {
    const today = new Date().toISOString().split('T')[0]
    const supabase = await createClient()
    const current = await checkDailyUsage()
    const { error } = await supabase
      .from('google_ai_usage')
  .upsert({ date: today, count: current + (Number.isFinite(delta) ? delta : 1) })
    if (error) console.error('Erro ao incrementar uso diário:', error)
  } catch (e) {
    console.error('Erro ao incrementar uso diário:', e)
  }
}

function getEnv(name: string, fallback?: string) {
  const v = process.env[name]
  return v && v.length > 0 ? v : fallback
}

function resolveCredentialsPath(p?: string | undefined) {
  if (!p) return undefined
  return p.startsWith('./') ? path.resolve(process.cwd(), p) : p
}

type DocKind = 'receipt' | 'credit_card' | 'bank_statement'

function guessDocTypeFromEntities(entities: DocAIEntity[] = []): DocKind | undefined {
  const types = new Set(entities.map(e => (e.type || '').toLowerCase()))
  if ([...types].some(t => /credit_card|card_limit|available_limit|last_four|billing_period/i.test(t))) return 'credit_card'
  if ([...types].some(t => /line_item|receipt_date|merchant|supplier_name/i.test(t))) return 'receipt'
  if ([...types].some(t => /iban|bic|account|bank_transaction|statement_line/i.test(t))) return 'bank_statement'
  const docType = entities.find(e => /document_type/i.test(e.type || ''))
  const val = (textOf(docType) || '').toLowerCase()
  if (val.includes('receipt') || val.includes('recibo')) return 'receipt'
  if (val.includes('credit')) return 'credit_card'
  if (val.includes('statement') || val.includes('extrato') || val.includes('extrato') || val.includes('extrato bancario')) return 'bank_statement'
  return undefined
}

function guessDocTypeFromText(text: string = ''): DocKind | undefined {
  const t = (text || '').toLowerCase()
  // Credit card signals
  if (/fatura.*cart[aã]o|credit\s*card|limite.*dispon[ií]vel|vencimento|data\s*de\s*corte|ultima.*quatro|last\s*four/.test(t)) return 'credit_card'
  // Bank statement signals
  if (/iban|bic|nib|saldo|saldo\s*anterior|saldo\s*final|account\s*statement|movimentos|ag[eê]ncia|conta\s*corrente/.test(t)) return 'bank_statement'
  // Receipt signals
  if (/recibo|receipt|iva|vat|nif|nipc|supplier|merchant|total\s*\:?\s*[0-9]/.test(t)) return 'receipt'
  return undefined
}

// Enhanced document type detection
function detectDocumentType(text: string, fileName: string): string {
  const content = text.toLowerCase()
  const name = fileName.toLowerCase()
  
  // Receipt indicators
  const receiptKeywords = [
    'recibo', 'receipt', 'fatura', 'invoice', 'cupom', 'ticket',
    'taxa de serviço', 'service charge', 'iva', 'vat', 'tax',
    'subtotal', 'total a pagar', 'total amount', 'amount due'
  ]
  
  // Credit card indicators
  const creditCardKeywords = [
    'cartão', 'card', 'crédito', 'credit', 'fatura do cartão',
    'card statement', 'limite', 'limit', 'minimum payment',
    'pagamento mínimo', 'due date', 'data de vencimento'
  ]
  
  // Bank statement indicators
  const bankKeywords = [
    'extrato', 'statement', 'saldo', 'balance', 'movimento',
    'transactions', 'débito', 'debit', 'transferência',
    'transfer', 'depósito', 'deposit', 'conta corrente'
  ]
  
  // Check filename first
  if (/recibo|receipt|invoice|fatura/i.test(name)) return 'receipt'
  if (/cartao|card|credit/i.test(name)) return 'credit_card'
  if (/extrato|statement|bank/i.test(name)) return 'bank_statement'
  
  // Check content
  const receiptScore = receiptKeywords.filter(k => content.includes(k)).length
  const cardScore = creditCardKeywords.filter(k => content.includes(k)).length
  const bankScore = bankKeywords.filter(k => content.includes(k)).length
  
  if (receiptScore > cardScore && receiptScore > bankScore) return 'receipt'
  if (cardScore > bankScore) return 'credit_card'
  return 'bank_statement'
}

// Enhanced bank transaction extraction
function extractBankTransactions(document: any): any[] {
  const entities = document.entities || []
  
  // Try entity-based extraction first
  let transactions = mapTransactions(entities)
  
  // Fallback to table extraction
  if (!transactions || transactions.length === 0) {
    transactions = extractTransactionsFromTables(document)
  }
  
  // Fallback to line extraction
  if (!transactions || transactions.length === 0) {
    transactions = extractTransactionsFromLines(document)
  }
  
  // Final fallback to text extraction
  if (!transactions || transactions.length === 0) {
    transactions = extractTransactionsFromText(document.text || '')
  }
  
  return transactions || []
}

// Enhanced credit card extraction
function extractCreditCardTransactions(document: any): any {
  const entities = document.entities || []
  const text = document.text || ''
  
  const cardInfo = extractCardInfo(entities)
  let transactions = mapTransactions(entities)
  
  // Fallback extractions for credit cards
  if (!transactions || transactions.length === 0) {
    transactions = extractTransactionsFromTables(document)
  }
  
  if (!transactions || transactions.length === 0) {
    transactions = extractTransactionsFromText(text)
  }
  
  // Extract credit card specific information
  const institution = extractInstitution(text, entities)
  const period = detectPeriod(text)
  
  return {
    institution,
    period,
    transactions: transactions || [],
    cardInfo
  }
}

// Enhanced receipt extraction
function extractReceiptData(document: any): any {
  const entities = document.entities || []
  
  let receipt = extractReceiptFromEntities(entities)
  
  // Fallback to table extraction for receipts
  if (!receipt) {
    receipt = extractReceiptFromTables(document)
  }
  
  // Fallback to text extraction
  if (!receipt) {
    receipt = extractReceiptFromText(document)
  }
  
  return receipt || { items: [], total: 0, date: '' }
}

// Helper to extract institution name
function extractInstitution(text: string, entities: DocAIEntity[]): string {
  // Try entities first
  const institutionEntity = entities.find(e => 
    /bank|issuer|institution|institution_name/i.test(e.type || ''))
  if (institutionEntity) {
    const institutionName = textOf(institutionEntity)
    if (institutionName) return institutionName
  }
  
  // Fallback to known banks in text
  const banks = [
    'Nubank', 'Itaú', 'Caixa Geral', 'CGD', 'Millennium', 
    'Santander', 'BB', 'Novo Banco', 'BCP', 'Revolut', 'Wise'
  ]
  
  for (const bank of banks) {
    if (new RegExp(`\\b${bank}\\b`, 'i').test(text)) {
      return bank
    }
  }
  
  return 'Não identificado'
}

function pickProp(entity: DocAIEntity | undefined, names: string[]): DocAIEntity | undefined {
  if (!entity?.properties) return undefined
  const set = new Set(names.map(n => n.toLowerCase()))
  return entity.properties.find(p => p.type && set.has(p.type.toLowerCase()))
}

function textOf(entity?: DocAIEntity): string | undefined {
  return entity?.normalizedValue?.text || entity?.mentionText
}

function numberOf(entity?: DocAIEntity): number | undefined {
  if (!entity) return undefined
  if (typeof entity.normalizedValue?.numberValue === 'number') return entity.normalizedValue.numberValue
  const t = textOf(entity)
  if (!t) return undefined
  const cleaned = t.replace(/[^0-9,.-]/g, '').replace(',', '.')
  const n = Number(cleaned)
  return isFinite(n) ? n : undefined
}

function mapTransactions(entities: DocAIEntity[] = []): Array<{
  date: string
  description: string
  amount: number
  suggestedCategory: string
}> {
  // Broaden the types we recognize - be more permissive
  const txTypes = /^(transaction|line_item|table_item|table_row|bank_transaction|statement_line|installments?|movement|movimento|entry)$/i
  const dateKeys = [
    'date',
    'transaction_date',
    'processed_date',
    'date_transaction',
    'data',
    'dt',
    'value_date',
    'processing_date'
  ]
  const descKeys = ['description', 'merchant', 'comerciante', 'descricao', 'historic', 'historico', 'detail', 'detalhe']
  const amountKeys = [
    'amount',
    'installment_amount',
    'amount_refund',
    'valor',
    'value',
    'total',
    'debit_amount',
    'credit_amount',
    'transaction_amount'
  ]
  const categoryKeys = ['category', 'categoria', 'type', 'tipo']

  // Collect all transaction-like entities with more aggressive matching
  const collected: DocAIEntity[] = []
  const stack = [...entities]
  while (stack.length) {
    const e = stack.pop()!
    if (!e) continue
    
    // More liberal matching - include any entity that might be a transaction
    if (e.type && (txTypes.test(e.type) || 
                   e.type.toLowerCase().includes('line') || 
                   e.type.toLowerCase().includes('row') ||
                   e.type.toLowerCase().includes('entry'))) {
      collected.push(e)
    }
    
    // Also look for entities that have amount-like properties
    if (e.properties && e.properties.length) {
      const hasAmount = e.properties.some(p => p.type && amountKeys.some(key => p.type?.toLowerCase().includes(key.toLowerCase())))
      const hasDate = e.properties.some(p => p.type && dateKeys.some(key => p.type?.toLowerCase().includes(key.toLowerCase())))
      if (hasAmount || hasDate) {
        collected.push(e)
      }
      for (const p of e.properties) stack.push(p)
    }
  }

  const txs: any[] = []
  for (const e of collected) {
    let date = textOf(pickProp(e, dateKeys)) || ''
    let desc = textOf(pickProp(e, descKeys)) || e.mentionText || ''
    let amt = numberOf(pickProp(e, amountKeys))
    const cat = (textOf(pickProp(e, categoryKeys)) || 'outros').toString()

    // Enhanced fallback scanning
    if ((!date || typeof amt !== 'number' || !desc) && e.properties && e.properties.length) {
      const baseYear = new Date().getFullYear()
      let bestDate = date
      let bestAmt = amt
      let bestDesc = desc
      
      for (const p of e.properties) {
        const t = textOf(p) || ''
        if (!t) continue
        
        // More aggressive date detection
        if (!bestDate) {
          const iso = parseFlexibleDate(t, baseYear) || toISODate(t)
          if (iso) bestDate = iso
          // Also try parsing common date patterns directly
          else if (/\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]?\d{2,4}/.test(t)) {
            const dateMatch = t.match(/(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]?\d{2,4})/)
            if (dateMatch) {
              const parsed = parseFlexibleDate(dateMatch[1], baseYear) || toISODate(dateMatch[1])
              if (parsed) bestDate = parsed
            }
          }
        }
        
        // More aggressive amount detection
        if (typeof bestAmt !== 'number') {
          const n = numberOf(p)
          if (typeof n === 'number') bestAmt = n
          else {
            const n2 = parseAmount(t)
            if (typeof n2 === 'number') bestAmt = n2
          }
        }
        
        // Better description detection
        if (!bestDesc || bestDesc.length < 3) {
          // Prefer text that has both letters and some length
          if (/[A-Za-zÀ-ÿ]/.test(t) && t.length >= 3 && t.length >= (bestDesc?.length || 0)) {
            bestDesc = t
          }
        }
      }
      
      date = bestDate || date
      amt = typeof bestAmt === 'number' ? bestAmt : amt
      desc = bestDesc || desc
    }

    // Be more lenient about what we accept as a transaction
    if ((date || typeof amt === 'number') && desc && desc.length > 0) {
      // If no date, use today as fallback
      const finalDate = date || new Date().toISOString().slice(0, 10)
      
      txs.push({
        date: finalDate,
        description: desc || 'Transação',
        amount: typeof amt === 'number' ? amt : 0,
        suggestedCategory: cat,
      })
    }
  }
  return txs
}

function extractCardInfo(entities: DocAIEntity[] = []) {
  // Traverse all entities (including nested) and collect by type
  const stack: DocAIEntity[] = [...entities]
  const all: DocAIEntity[] = []
  while (stack.length) {
    const e = stack.pop()!
    if (!e) continue
    all.push(e)
    if (e.properties && e.properties.length) stack.push(...e.properties)
  }

  const findText = (types: string[]) => {
    const set = new Set(types.map(t => t.toLowerCase()))
    const found = all.find(e => e.type && set.has(e.type.toLowerCase()))
    return textOf(found) || undefined
  }
  const findNumber = (types: string[]) => {
    const set = new Set(types.map(t => t.toLowerCase()))
    const found = all.find(e => e.type && set.has(e.type.toLowerCase()))
    return numberOf(found)
  }

  const lastFourDigits = findText(['credit_card_last_four_digits'])
  const cardHolderName = findText(['card_holder_name'])
  const cardType = findText(['card_type'])
  const currency = findText(['currency'])
  const cardLimit = findNumber(['card_limit'])
  const availableLimit = findNumber(['available_limit'])
  const startDate = findText(['start_date']) || undefined
  const endDate = findText(['end_date']) || undefined

  const startISO = startDate ? (parseFlexibleDate(startDate) || toISODate(startDate)) : undefined
  const endISO = endDate ? (parseFlexibleDate(endDate) || toISODate(endDate)) : undefined

  if (!lastFourDigits && !cardHolderName && !cardType && !currency && typeof cardLimit !== 'number' && typeof availableLimit !== 'number') {
    return undefined
  }

  return {
    lastFourDigits,
    cardHolderName,
    cardType,
    currency,
    cardLimit: typeof cardLimit === 'number' ? cardLimit : undefined,
    availableLimit: typeof availableLimit === 'number' ? availableLimit : undefined,
    startDate: startISO,
    endDate: endISO,
  }
}

// Debug helpers (safe summaries only)
function trimText(s: string | undefined, max = 1000): string | undefined {
  if (!s) return s
  return s.length > max ? s.slice(0, max) + '…' : s
}

function summarizeEntities(entities: DocAIEntity[] = []) {
  const types = Array.from(new Set(entities.map(e => (e.type || '').toLowerCase()).filter(Boolean)))
  return {
    total: entities.length,
    types: types.slice(0, 30),
    samples: entities.slice(0, 3).map(e => ({
      type: e.type,
      mentionText: trimText(textOf(e), 120),
      normalized: e.normalizedValue?.text ?? e.normalizedValue?.numberValue,
      props: (e.properties || []).slice(0, 5).map(p => p.type)
    }))
  }
}

// Helpers for fallback extraction
function toISODate(dateStr: string): string | '' {
  const s = dateStr.trim()
  let m = s.match(/^(\d{4})[\-\/.](\d{1,2})[\-\/.](\d{1,2})$/)
  if (m) {
    const [_, y, mo, d] = m
    return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`
  }
  m = s.match(/^(\d{1,2})[\-\/.](\d{1,2})[\-\/.](\d{2,4})$/)
  if (m) {
    let [_, d, mo, y] = m as unknown as [string, string, string, string]
    if (y.length === 2) y = `20${y}`
    return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`
  }
  return ''
}

function extractTransactionsFromText(text: string): Array<{date: string; description: string; amount: number; suggestedCategory: string}> {
  const out: any[] = []
  if (!text) return out
  const baseYear = new Date().getFullYear()
  const lines = text.split(/\r?\n/).map(l => l.replace(/\s{2,}/g, ' ').trim()).filter(Boolean)
  
  // Enhanced regex patterns for better matching
  const dateAnyRe = new RegExp(String.raw`(\d{1,2}[\/-]\d{1,2}(?:[\/-]\d{2,4})?|\d{4}-\d{1,2}-\d{1,2}|\d{1,2}\s+[A-Za-zÀ-ÿ]{3,}\.?\s*\d{0,4})`)
  const amountRe = /[+\-]?\(?\s*[0-9]{1,3}(?:[.,\s][0-9]{3})*(?:[.,][0-9]{1,2})\s*\)?/g
  
  for (const raw of lines) {
    const line = raw
    
    // Skip obvious non-transaction lines
    if (/^\s*(total|subtotal|saldo|balance|resumo|summary|página|page)\s*$/i.test(line)) continue
    if (line.length < 5) continue // Too short to be meaningful
    
    const amounts = Array.from(line.matchAll(amountRe))
    if (!amounts.length) continue
    
    // Find the most likely amount (usually the last one or largest)
    let bestAmount = amounts[amounts.length - 1]
    let amount = parseAmount(bestAmount[0])
    if (typeof amount !== 'number') continue
    
    // Determine if it's debit or credit based on context
    const afterAmount = line.slice(bestAmount.index! + bestAmount[0].length).trim()
    const beforeAmount = line.slice(0, bestAmount.index!).trim()
    
    if (/^\)?\s*(D|DB|débito|debito|debit)\b/i.test(afterAmount) || 
        /\(/.test(bestAmount[0]) || 
        /-/.test(bestAmount[0]) ||
        /saída|withdrawal|payment|pagamento/i.test(beforeAmount)) {
      amount = -Math.abs(amount)
    } else if (/^\)?\s*(C|CR|crédito|credito|credit)\b/i.test(afterAmount) || 
               /\+/.test(bestAmount[0]) ||
               /entrada|deposit|depósito|recebimento/i.test(beforeAmount)) {
      amount = Math.abs(amount)
    }
    
    // Look for date
    const dm = line.match(dateAnyRe)
    if (!dm) continue
    
    const dateISO = parseFlexibleDate(dm[1], baseYear) || toISODate(dm[1])
    if (!dateISO) continue
    
    // Extract description by removing date and amount
    let description = line
    description = description.replace(dm[1], ' ')
    description = description.substring(0, bestAmount.index) + description.substring(bestAmount.index! + bestAmount[0].length)
    description = description.replace(/\s{2,}/g, ' ').trim()
    
    // Clean up description
    description = description.replace(/^\s*(D|C|DB|CR|débito|crédito|debit|credit)\s*/i, '')
    description = description.replace(/\s*(D|C|DB|CR|débito|crédito|debit|credit)\s*$/i, '')
    
    // Skip if no meaningful description
    if (!description || description.length < 2) continue
    if (/^(saldo|balance|resumo|sumário|pagamento|payment|total)$/i.test(description)) continue
    
    // Only include if we have both letters and reasonable length
    if (!/[A-Za-zÀ-ÿ]/.test(description)) continue
    
    out.push({ 
      date: dateISO, 
      description: description || 'Transação', 
      amount, 
      suggestedCategory: 'outros' 
    })
  }
  return out
}

function extractTransactionsFromTables(document: any, debug = false): Array<{date: string; description: string; amount: number; suggestedCategory: string}> {
  const out: any[] = []
  if (!document?.pages) return out
  const fullText: string = document.text || ''
  const anchorToText = (anchor: any): string => {
    if (!anchor?.textSegments?.length) return ''
    let s = ''
    for (const seg of anchor.textSegments) {
      const start = seg.startIndex || 0
      const end = seg.endIndex
      if (typeof end === 'number' && end > start) s += fullText.substring(start, end)
    }
    return s
  }
  const dateRe = /\b(\d{1,2}[\-\/.]\d{1,2}(?:[\-\/.]\d{2,4})?|\d{4}[\-\/.]\d{1,2}[\-\/.]\d{1,2}|\d{1,2}\s+[A-Za-zÀ-ÿ]{3,}\.?\s*\d{0,4})\b/
  let tablesCount = 0
  let rowsParsed = 0
  for (const page of document.pages) {
    const tables = page.tables || []
    for (const table of tables) {
      tablesCount++
      const headerRows = table.headerRows || []
      const bodyRows = table.bodyRows || []
      let dateIdx = -1, descIdx = -1, amountIdx = -1, dcIdx = -1
      if (headerRows.length) {
        const headerTexts = (headerRows[0].cells || []).map((c: any) => anchorToText(c.layout?.textAnchor).trim().toLowerCase())
        const normalize = (t: string) => t.normalize('NFD').replace(/\p{Diacritic}/gu, '')
        const headerNorm = headerTexts.map(normalize)
        const findCol = (keys: string[]) => headerNorm.findIndex((t: string) => keys.some(k => new RegExp(`(^|[^a-z])${k}([^a-z]|$)`, 'i').test(t)))
        dateIdx = findCol(['data', 'date', 'dt'])
        descIdx = findCol(['descricao', 'descrição', 'description', 'historico', 'histórico', 'merchant', 'detalhe', 'detalhes'])
        amountIdx = findCol(['valor', 'amount', 'total', 'montante'])
        dcIdx = findCol(['d/c', 'dc', 'debito/credito', 'debito credito', 'debito', 'credito', 'dr/cr', 'dr cr'])
      }
      const rows = [...headerRows, ...bodyRows]
      for (let r = 0; r < rows.length; r++) {
        const row = rows[r]
        const cells = (row.cells || []).map((c: any) => anchorToText(c.layout?.textAnchor).replace(/\s+/g, ' ').trim())
        if (cells.length < 2) continue
        const isHeader = r < headerRows.length
        if (isHeader) continue
        let _dateIdx = dateIdx
        let _amountIdx = amountIdx
        let _descIdx = descIdx
        if (_dateIdx === -1) _dateIdx = cells.findIndex((c: string) => dateRe.test(c))
        if (_amountIdx === -1) {
          for (let i = cells.length - 1; i >= 0; i--) {
            const n = parseAmount(cells[i])
            if (typeof n === 'number') { _amountIdx = i; break }
          }
        }
        if (_descIdx === -1) {
          let maxLen = -1, idx = -1
          for (let i = 0; i < cells.length; i++) {
            if (i === _dateIdx || i === _amountIdx || i === dcIdx) continue
            if (cells[i].length > maxLen) { maxLen = cells[i].length; idx = i }
          }
          _descIdx = idx
        }
        if (_dateIdx === -1 || _amountIdx === -1 || _descIdx === -1) continue
        const baseYear = new Date().getFullYear()
        const dateRaw = (cells[_dateIdx].match(dateRe) || [])[0] || cells[_dateIdx]
        const dateISO = parseFlexibleDate(dateRaw, baseYear) || toISODate(dateRaw)
        if (!dateISO) continue
        const amountText = cells[_amountIdx]
        let amount = parseAmount(amountText)
        if (typeof amount !== 'number') continue
        if (/\(/.test(amountText) || /-/.test(amountText)) amount = -Math.abs(amount)
        if (dcIdx !== -1) {
          const dcText = (cells[dcIdx] || '').toUpperCase()
          if (/\bD\b|DEB/.test(dcText)) amount = -Math.abs(amount)
          if (/\bC\b|CR|CRED/.test(dcText)) amount = Math.abs(amount)
        }
        const description = cells[_descIdx]
        if (!description) continue
        out.push({ date: dateISO, description, amount, suggestedCategory: 'outros' })
        rowsParsed++
      }
    }
  }
  if (debug) console.debug('[DocAI] Tabelas', { tables: tablesCount, rowsParsed })
  return out
}

function extractTransactionsFromLines(document: any, debug = false): Array<{date: string; description: string; amount: number; suggestedCategory: string}> {
  const out: any[] = []
  if (!document?.pages) return out
  const fullText: string = document.text || ''
  const anchorToText = (anchor: any): string => {
    if (!anchor?.textSegments?.length) return ''
    let s = ''
    for (const seg of anchor.textSegments) {
      const start = seg.startIndex || 0
      const end = seg.endIndex
      if (typeof end === 'number' && end > start) s += fullText.substring(start, end)
    }
    return s
  }
  let linesCount = 0
  let textFromLines = ''
  for (const page of document.pages || []) {
    const lines = page.lines || []
    for (const ln of lines) {
      const t = anchorToText(ln.layout?.textAnchor).replace(/\s+/g, ' ').trim()
      if (!t) continue
      linesCount++
      textFromLines += t + '\n'
    }
  }
  if (!textFromLines) return out
  const tx = extractTransactionsFromText(textFromLines)
  if (debug) console.debug('[DocAI] Linhas', { lines: linesCount, rowsParsed: tx.length })
  return tx
}

function detectPeriod(text: string): { start: string; end: string } {
  const rangeRe = /(\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4}|\d{4}-\d{1,2}-\d{1,2}).{0,20}(?:a|até|to|–|-).{0,20}(\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4}|\d{4}-\d{1,2}-\d{1,2})/i
  const m = text.match(rangeRe)
  if (m) {
    const start = toISODate(m[1]) || ''
    const end = toISODate(m[2]) || ''
    return { start, end }
  }
  return { start: '', end: '' }
}

function parseAmount(text: string): number | undefined {
  if (!text || typeof text !== 'string') return undefined
  
  // Clean up common formatting, keeping currency and signs
  let cleaned = text.trim()
    .replace(/[^\d\-\+\.,€$R]/g, '') // Keep only digits, separators, currency symbols
    .replace(/[€$R]/g, '') // Remove currency symbols
    .replace(/\s/g, '') // Remove spaces
  
  if (!cleaned) return undefined
  
  // Handle European format (1.234,56)
  if (/^\d{1,3}(\.\d{3})*,\d{2}$/.test(cleaned)) {
    cleaned = cleaned.replace(/\./g, '').replace(',', '.')
  }
  // Handle US format (1,234.56)
  else if (/^\d{1,3}(,\d{3})*\.\d{2}$/.test(cleaned)) {
    cleaned = cleaned.replace(/,/g, '')
  }
  // Handle simple comma as decimal (123,45)
  else if (/^\d+,\d{1,2}$/.test(cleaned)) {
    cleaned = cleaned.replace(',', '.')
  }
  // Fallback: remove commas if they appear to be thousands separators
  else {
    const lastComma = cleaned.lastIndexOf(',')
    const lastDot = cleaned.lastIndexOf('.')
    
    if (lastComma > -1 && lastComma > lastDot) {
      // Comma is likely decimal separator
      cleaned = cleaned.replace(/\./g, '').replace(',', '.')
    } else if (lastDot > -1 && lastDot > lastComma) {
      // Dot is likely decimal separator
      cleaned = cleaned.replace(/,/g, '')
    } else if (lastComma > -1) {
      // Only comma present, treat as decimal
      cleaned = cleaned.replace(',', '.')
    }
  }
  
  const n = Number(cleaned)
  return isFinite(n) ? n : undefined
}

const MONTHS_MAP: Record<string, number> = {
  jan: 1, janeiro: 1, january: 1,
  fev: 2, fevereiro: 2, feb: 2, february: 2,
  mar: 3, março: 3, marco: 3, march: 3,
  abr: 4, abril: 4, apr: 4, april: 4,
  mai: 5, may: 5,
  jun: 6, june: 6,
  jul: 7, july: 7,
  ago: 8, agosto: 8, aug: 8, august: 8,
  set: 9, setembro: 9, sep: 9, sept: 9, september: 9,
  out: 10, outubro: 10, oct: 10, october: 10,
  nov: 11, novembro: 11, novem: 11, november: 11,
  dez: 12, dezembro: 12, dec: 12, december: 12,
}

function parseFlexibleDate(input: string, baseYear?: number): string | '' {
  const s = input.trim()
  let m = s.match(/^(\d{4})[\-\/.](\d{1,2})[\-\/.](\d{1,2})$/)
  if (m) {
    const [_, y, mo, d] = m
    return `${y}-${mo.padStart(2,'0')}-${d.padStart(2,'0')}`
  }
  m = s.match(/^(\d{1,2})[\-\/.](\d{1,2})[\-\/.](\d{2,4})$/)
  if (m) {
    let [_, d, mo, y] = m as unknown as [string, string, string, string]
    if (y.length === 2) y = `20${y}`
    return `${y}-${mo.padStart(2,'0')}-${d.padStart(2,'0')}`
  }
  m = s.match(/^(\d{1,2})[\-\/.](\d{1,2})$/)
  if (m) {
    const [_, d, mo] = m as unknown as [string, string, string]
    const y = String(baseYear || new Date().getFullYear())
    return `${y}-${mo.padStart(2,'0')}-${d.padStart(2,'0')}`
  }
  m = s.match(/^(\d{1,2})\s+([A-Za-zÀ-ÿ]{3,})\.?\s*(\d{2,4})?$/)
  if (m) {
    let [_, d, mon, y] = m as unknown as [string, string, string, string]
    const k = mon.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '')
    const mm = MONTHS_MAP[k]
    if (mm) {
      const yy = y ? (y.length === 2 ? `20${y}` : y) : String(baseYear || new Date().getFullYear())
      return `${yy}-${String(mm).padStart(2,'0')}-${String(d).padStart(2,'0')}`
    }
  }
  return ''
}

// Extract itemized receipt information from tables or entities
function extractReceiptFromTables(document: any) {
  if (!document?.pages) return undefined
  const fullText: string = document.text || ''
  const anchorToText = (anchor: any): string => {
    if (!anchor?.textSegments?.length) return ''
    let s = ''
    for (const seg of anchor.textSegments) {
      const start = seg.startIndex || 0
      const end = seg.endIndex
      if (typeof end === 'number' && end > start) s += fullText.substring(start, end)
    }
    return s
  }
  const normalize = (t: string) => t.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '')
  const parsePercent = (t?: string): number | undefined => {
    if (!t) return undefined
    const m = t.replace(/,/g, '.').match(/(-?\d{1,3}(?:\.\d{1,2})?)\s*%/)
    if (m) {
      const n = Number(m[1])
      return isFinite(n) ? n : undefined
    }
    // Sometimes just a number in a % column
    const n2 = Number(t.replace(/[^0-9.\-]/g, ''))
    return isFinite(n2) && t.trim() ? n2 : undefined
  }

  let bestTable: any | undefined
  let bestScore = -1
  for (const page of document.pages) {
    for (const table of (page.tables || [])) {
      const header = (table.headerRows?.[0]?.cells || []).map((c: any) => normalize(anchorToText(c.layout?.textAnchor).trim()))
      const hasDesc = header.some((h: string) => /(descri|descricao|description|produto|item)/i.test(h))
      const hasQty = header.some((h: string) => /(qtd|quant|qty|quantidade)/i.test(h))
      const hasUnit = header.some((h: string) => /(preco\s*un|unit|unitario|unit price|preco unit)/i.test(h))
      const hasTotal = header.some((h: string) => /(total|valor)/i.test(h))
      const hasCode = header.some((h: string) => /(cod|código|codigo|sku|ref|referencia|referência|item\s*id|produto\s*id)/i.test(h))
      const hasTax = header.some((h: string) => /(iva|vat|imposto|taxa|tax)/i.test(h))
      const rows = table.bodyRows || []
      const score = (hasDesc?1:0) + (hasQty?1:0) + (hasUnit?1:0) + (hasTotal?1:0) + (hasCode?0.5:0) + (hasTax?0.5:0) + Math.min(rows.length, 10)
      if (score > bestScore) { bestScore = score; bestTable = table }
    }
  }
  if (!bestTable) return undefined

  const headerTexts = (bestTable.headerRows?.[0]?.cells || []).map((c: any) => normalize(anchorToText(c.layout?.textAnchor).trim()))
  const findCol = (keys: RegExp) => headerTexts.findIndex((t: string) => keys.test(t))
  const descIdx = findCol(/(descri|descricao|description|produto|item)/i)
  let qtyIdx = findCol(/(qtd|quant|qty|quantidade)/i)
  let unitIdx = findCol(/(preco\s*un|unit|unitario|unit price|preco unit)/i)
  let totalIdx = findCol(/(total|valor)/i)
  let codeIdx = findCol(/(cod|código|codigo|sku|ref|referencia|referência|item\s*id|produto\s*id)/i)
  let taxIdx = findCol(/(iva|vat|imposto|taxa|tax)/i)

  const items: Array<{ code?: string; description: string; quantity?: number; unitPrice?: number; total?: number; taxRate?: number; taxAmount?: number }> = []
  for (const row of (bestTable.bodyRows || [])) {
    const cells = (row.cells || []).map((c: any) => anchorToText(c.layout?.textAnchor).replace(/\s+/g, ' ').trim())
    const get = (i: number) => (i >= 0 && i < cells.length ? cells[i] : '')
    
    // If headers are missing, try to infer indices per-row
    let _descIdx = descIdx
    let _qtyIdx = qtyIdx
    let _unitIdx = unitIdx
    let _totalIdx = totalIdx
    let _codeIdx = codeIdx
    let _taxIdx = taxIdx
    
    // Fallback: find the longest text cell as description
    if (_descIdx === -1) {
      let maxLen = -1, idx = -1
      for (let i = 0; i < cells.length; i++) { 
        const cell = cells[i]
        // Prefer cells with letters and reasonable length
        if (cell && /[A-Za-zÀ-ÿ]/.test(cell) && cell.length > maxLen) { 
          maxLen = cell.length; 
          idx = i 
        } 
      }
      _descIdx = idx
    }
    
    // Find numeric cells for prices/quantities
    const numericCells: Array<{index: number, value: number, isInteger: boolean}> = []
    for (let i = 0; i < cells.length; i++) {
      const val = parseAmount(cells[i])
      if (typeof val === 'number') {
        const isInteger = Math.abs(val - Math.round(val)) < 0.001 && val > 0 && val <= 100
        numericCells.push({index: i, value: val, isInteger})
      }
    }
    
    // Auto-detect columns based on content
    if (_qtyIdx === -1) {
      // Look for small integer values (likely quantity)
      const qtyCandidate = numericCells.find(nc => nc.isInteger && nc.value <= 50)
      if (qtyCandidate) _qtyIdx = qtyCandidate.index
    }
    
    if (_totalIdx === -1 && numericCells.length > 0) {
      // Total is usually the rightmost or largest price
      _totalIdx = numericCells[numericCells.length - 1].index
    }
    
    if (_unitIdx === -1 && numericCells.length >= 2) {
      // Unit price is usually the second-to-last price if we have multiple
      const priceNums = numericCells.filter(nc => !nc.isInteger || nc.value > 10)
      if (priceNums.length >= 2) {
        _unitIdx = priceNums[priceNums.length - 2].index
      }
    }
    
    if (_taxIdx === -1) {
      // Find a column with a % value
      for (let i = cells.length - 1; i >= 0; i--) {
        const p = parsePercent(cells[i])
        if (typeof p === 'number') { _taxIdx = i; break }
      }
    }

    const description = (get(_descIdx) || '').trim()
    
    // Skip rows where description is missing, purely numeric, or looks like a header/total
    if (!description || 
        !/[A-Za-zÀ-ÿ]/.test(description) || 
        /^\d+$/.test(description) ||
        /subtotal|iva|vat|imposto|taxa|total|descri[cç][aã]o|description|item|produto/i.test(description)) {
      continue
    }
    
    const code = (get(_codeIdx) || '').trim() || undefined
    const quantity = _qtyIdx >= 0 ? parseAmount(get(_qtyIdx)) : undefined
    const unitPrice = _unitIdx >= 0 ? parseAmount(get(_unitIdx)) : undefined  
    const total = _totalIdx >= 0 ? parseAmount(get(_totalIdx)) : undefined
    const taxRate = _taxIdx >= 0 ? parsePercent(get(_taxIdx)) : undefined
    
    let taxAmount: number | undefined = undefined
    if (typeof taxRate === 'number' && typeof total === 'number') {
      const rate = taxRate / 100
      // If total likely includes tax, estimate tax amount conservatively
      taxAmount = Number((total - total / (1 + rate)).toFixed(2))
      if (!isFinite(taxAmount)) taxAmount = undefined
    }
    
    // Only add items with meaningful description and at least one price
    if (description && description.length > 1 && (typeof quantity === 'number' || typeof unitPrice === 'number' || typeof total === 'number')) {
      items.push({ code, description, quantity, unitPrice, total, taxRate, taxAmount })
    }
  }

  if (items.length === 0) return undefined

  // Try to detect subtotal/tax/total from trailing lines (scan page text near end)
  let subtotal: number | undefined
  let tax: number | undefined
  let total: number | undefined
  const lines = (fullText || '').split(/\r?\n/).map(l => l.replace(/\s{2,}/g, ' ').trim()).filter(Boolean)
  for (const line of lines.slice(-60)) {
    const m = line.match(/\b(subtotal|total\s*sem\s*iva|before\s*tax)\b.*?([0-9.,]+)\b/i)
    if (m) subtotal = subtotal ?? parseAmount(m[2]!)
    const mt = line.match(/\b(iva|vat|taxa|imposto)\b.*?([0-9.,]+)\b/i)
    if (mt) tax = tax ?? parseAmount(mt[2]!)
    const tt = line.match(/\b(total)\b.*?([0-9.,]+)\b/i)
    if (tt) total = total ?? parseAmount(tt[2]!)
  }

  if (typeof total !== 'number') {
    const sum = items.reduce((s, it) => s + (typeof it.total === 'number' ? it.total : (typeof it.unitPrice === 'number' && typeof it.quantity === 'number' ? it.unitPrice * it.quantity : 0)), 0)
    total = isFinite(sum) ? Number(sum.toFixed(2)) : undefined
  }
  if (typeof subtotal !== 'number' && typeof total === 'number' && typeof tax === 'number') subtotal = Number((total - tax).toFixed(2))

  // Merchant and date heuristics
  let merchant: string | undefined
  let date: string | '' = ''
  for (const line of lines.slice(0, 20)) {
    if (!merchant) {
      const s = line.trim()
      if (s.length > 3 && !/\d{2,}/.test(s) && !/subtotal|total|iva|vat|imposto/i.test(s)) merchant = s
    }
    if (!date) {
      const d = parseFlexibleDate(line)
      if (d) date = d
    }
    if (merchant && date) break
  }

  return { merchant, date, subtotal, tax, total, items }
}

function extractReceiptFromEntities(entities: DocAIEntity[]) {
  if (!entities?.length) return undefined
  // Collect line_item entities grouped under a potential receipt/invoice parent
  const stack = [...entities]
  const items: Array<{ code?: string; description: string; quantity?: number; unitPrice?: number; total?: number; taxRate?: number; taxAmount?: number }> = []
  let merchant: string | undefined
  let date: string | '' = ''
  let subtotal: number | undefined
  let tax: number | undefined
  let total: number | undefined
  const num = (e?: DocAIEntity) => numberOf(e)
  const txt = (e?: DocAIEntity) => textOf(e)
  while (stack.length) {
    const e = stack.pop()!
    if (!e) continue
    if (e.type && /merchant|seller|store|merchant_name|issuer|institution/i.test(e.type)) merchant = merchant || txt(e)
    if (e.type && /(date|issue_date|data)/i.test(e.type)) {
      const d = parseFlexibleDate(txt(e) || '') || toISODate(txt(e) || '')
      if (d) date = date || d
    }
    if (e.type && /(subtotal|amount_subtotal)/i.test(e.type)) subtotal = subtotal ?? num(e)
    if (e.type && /(tax|iva|vat)/i.test(e.type)) tax = tax ?? num(e)
    if (e.type && /(total|amount_total)/i.test(e.type)) total = total ?? num(e)
    if (e.type && /(line_item|item)/i.test(e.type)) {
      const d = txt(pickProp(e, ['description','descricao','item','produto'])) || txt(e) || 'Item'
      const code = txt(pickProp(e, ['code','sku','ref','referencia','referência','item_id','product_id']))
      const q = num(pickProp(e, ['quantity','qtd','quantidade']))
      const u = num(pickProp(e, ['unit_price','preco_unitario','unit']))
      const t = num(pickProp(e, ['amount','total','line_total']))
      const tr = num(pickProp(e, ['tax_rate']))
      const ta = num(pickProp(e, ['tax_amount']))
      items.push({ code: code || undefined, description: d, quantity: q, unitPrice: u, total: t, taxRate: tr, taxAmount: ta })
    }
    if (e.properties) stack.push(...e.properties)
  }
  if (!items.length) return undefined
  return { merchant, date, subtotal, tax, total, items }
}

// Build a dynamic table for receipts by recognizing headers, without hardcoding a schema
function buildDynamicReceiptTable(document: any): { headers: string[]; rows: string[][]; columnSemantics: { description?: number; quantity?: number; unitPrice?: number; total?: number; code?: number; tax?: number } } | undefined {
  if (!document?.pages) return undefined
  const fullText: string = document.text || ''
  const anchorToText = (anchor: any): string => {
    if (!anchor?.textSegments?.length) return ''
    let s = ''
    for (const seg of anchor.textSegments) {
      const start = seg.startIndex || 0
      const end = seg.endIndex
      if (typeof end === 'number' && end > start) s += fullText.substring(start, end)
    }
    return s
  }
  const normalize = (t: string) => t.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '')

  let bestTable: any | undefined
  let bestScore = -1
  let headerTextsRaw: string[] = []
  let headerNorm: string[] = []
  for (const page of document.pages) {
    for (const table of (page.tables || [])) {
      const headerRaw = (table.headerRows?.[0]?.cells || []).map((c: any) => (anchorToText(c.layout?.textAnchor) || '').trim())
      const header = headerRaw.map((h: string) => normalize(h))
      const hasDesc = header.some((h: string) => /(descri|descricao|description|produto|item)/i.test(h))
      const hasQty = header.some((h: string) => /(qtd|quant|qty|quantidade)/i.test(h))
      const hasUnit = header.some((h: string) => /(preco\s*un|unit|unitario|unit price|preco unit)/i.test(h))
      const hasTotal = header.some((h: string) => /(total|valor)/i.test(h))
      const hasCode = header.some((h: string) => /(cod|código|codigo|sku|ref|referencia|referência|item\s*id|produto\s*id)/i.test(h))
      const hasTax = header.some((h: string) => /(iva|vat|imposto|taxa|tax)/i.test(h))
      const rows = table.bodyRows || []
      const score = (hasDesc?2:0) + (hasQty?1:0) + (hasUnit?1:0) + (hasTotal?2:0) + (hasCode?1:0) + (hasTax?1:0) + Math.min(rows.length, 10)
      if (score > bestScore) { bestScore = score; bestTable = table; headerTextsRaw = headerRaw; headerNorm = header }
    }
  }
  if (!bestTable) return undefined

  const findCol = (re: RegExp) => headerNorm.findIndex((t: string) => re.test(t))
  const columnSemantics: { [k: string]: number | undefined } = {
    description: findCol(/(descri|descricao|description|produto|item)/i),
    quantity: findCol(/(qtd|quant|qty|quantidade)/i),
    unitPrice: findCol(/(preco\s*un|unit|unitario|unit price|preco unit)/i),
    total: findCol(/(total|valor)/i),
    code: findCol(/(cod|código|codigo|sku|ref|referencia|referência|item\s*id|produto\s*id)/i),
    tax: findCol(/(iva|vat|imposto|taxa|tax)/i),
  }

  const rows: string[][] = []
  for (const row of (bestTable.bodyRows || [])) {
    const cells = (row.cells || []).map((c: any) => anchorToText(c.layout?.textAnchor).replace(/\s+/g, ' ').trim())
    if (cells.length > 0) rows.push(cells)
  }

  const headers = headerTextsRaw.length ? headerTextsRaw : headerNorm
  return { headers, rows, columnSemantics: columnSemantics as any }
}

// AI mapping: normalize Document AI line_item entities with an LLM
async function aiMapReceipt(entities: DocAIEntity[] = [], fullText: string = ''): Promise<
  | { merchant?: string; date?: string; subtotal?: number; tax?: number; total?: number; items: Array<{ code?: string; description: string; quantity?: number; unitPrice?: number; total?: number; taxRate?: number; taxAmount?: number }> }
  | undefined
> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error('OPENAI_API_KEY not configured')
  const client = new OpenAI({ apiKey })

  // Gather raw line items from entities
  const rawItems: Array<Record<string, any>> = []
  const stack = [...entities]
  while (stack.length) {
    const e = stack.pop()!
    if (!e) continue
    if (e.type && /(line_item|item)/i.test(e.type)) {
      const d = textOf(pickProp(e, ['description','descricao','item','produto'])) || textOf(e) || ''
      const code = textOf(pickProp(e, ['code','sku','ref','referencia','referência','item_id','product_id']))
      const q = numberOf(pickProp(e, ['quantity','qtd','quantidade']))
      const u = numberOf(pickProp(e, ['unit_price','preco_unitario','unit']))
      const t = numberOf(pickProp(e, ['amount','total','line_total']))
      const tr = numberOf(pickProp(e, ['tax_rate']))
      const ta = numberOf(pickProp(e, ['tax_amount']))
      rawItems.push({ description: d, code, quantity: q, unitPrice: u, total: t, taxRate: tr, taxAmount: ta })
    }
    if (e.properties) stack.push(...e.properties)
  }

  // Also pass a short tail/head of the text to help identify merchant/date
  const head = (fullText || '').split(/\r?\n/).slice(0, 25).join('\n')
  const tail = (fullText || '').split(/\r?\n/).slice(-25).join('\n')

  const system = `You are a data normalizer for retail receipts. Input is from Google Document AI entities (line_item) and raw text snippets. 
Return a strict JSON object with fields: merchant (string|optional), date (YYYY-MM-DD|optional), subtotal (number|optional), tax (number|optional), total (number|optional), and items (array).
Each item: { code?: string, description: string, quantity?: number, unitPrice?: number, total?: number, taxRate?: number, taxAmount?: number }.
Rules: 
- Merge duplicated split lines; ignore summary rows like subtotal/total/iva/vat.
- Prefer totals when available; compute nothing if uncertain.
- Date should be a single receipt date. If absent, omit.
- Keep currency-agnostic numbers (dot or comma handled upstream).`

  const user = JSON.stringify({ rawItems, textHead: head, textTail: tail })
  const completion = await client.chat.completions.create({
    model: process.env.OPENAI_RECEIPT_MODEL || 'gpt-4o-mini',
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    temperature: 0,
  })
  const content = completion.choices?.[0]?.message?.content || '{}'
  try {
    const parsed = JSON.parse(content)
    if (parsed && Array.isArray(parsed.items)) {
      // Light shape validation
      parsed.items = parsed.items.filter((it: any) => it && typeof it.description === 'string' && it.description.trim())
      return parsed
    }
  } catch {}
  return undefined
}

// Helpers to assess quality of extracted receipt items
function isPoorReceiptItems(items: Array<{ description: string; total?: number }> = []) {
  if (!items.length) return true
  let numericOnly = 0
  let noTotal = 0
  let lowTokens = 0
  for (const it of items) {
    const d = (it.description || '').trim()
    const tokens = d.split(/\s+/).filter(Boolean)
    if (!/[A-Za-zÀ-ÿ]/.test(d)) numericOnly++
    if (typeof it.total !== 'number') noTotal++
    if (tokens.length < 2) lowTokens++
  }
  const n = items.length
  // Poor if too many numeric-only, too many without totals, or descriptions are mostly one token
  return (numericOnly / n > 0.15) || (noTotal / n > 0.5) || (lowTokens / n > 0.6)
}

// Fallback: parse receipt items from plain text/lines
function extractReceiptFromText(document: any) {
  const text: string = document?.text || ''
  if (!text) return undefined
  const allLines = text.split(/\r?\n/).map(l => l.replace(/\s{2,}/g, ' ').trim()).filter(Boolean)
  if (!allLines.length) return undefined
  const items: Array<{ description: string; quantity?: number; unitPrice?: number; total?: number }> = []
  const noise = /(rastreabilidade|visa|mastercard|troco|change|aprovado|authorized|multibanco|mbway|nif|vat|iva|imposto|subtotal|total|pagamento|payment)/i
  const isNumericOnly = (s: string) => /^[-+]?\(?\s*\d{1,3}(?:[.,\s]\d{3})*(?:[.,]\d{1,2})\s*\)?$/.test(s)
  const isPriceOnly = (s: string) => /^\s*\d{1,4}[,\.]\d{2}\s*$/.test(s)

  // Enhanced item detection - look for product descriptions followed by prices
  let currentDescription = ''
  let pendingPrice: number | undefined
  
  for (let i = 0; i < allLines.length; i++) {
    const line = allLines[i].trim()
    if (!line || noise.test(line)) continue
    
    // Check if this line is just a price
    if (isPriceOnly(line)) {
      const price = parseAmount(line)
      if (typeof price === 'number') {
        if (currentDescription && currentDescription.length > 2) {
          // We have a description and now a price - create an item
          items.push({ 
            description: currentDescription.trim(), 
            total: price 
          })
          currentDescription = ''
          pendingPrice = undefined
        } else {
          // Store price for later if we get a description
          pendingPrice = price
        }
      }
      continue
    }
    
    // Check if line contains both description and price
    const amountRe = /[-+]?\(?\s*\d{1,3}(?:[.,\s]\d{3})*(?:[.,]\d{1,2})\s*\)?/g
    const nums = Array.from(line.matchAll(amountRe)).map(m => ({ text: m[0], index: m.index ?? -1 }))
    const numbers = nums.map(n => ({ n: parseAmount(n.text), index: n.index }))
    const validNumbers = numbers.filter(v => typeof v.n === 'number') as Array<{ n: number; index: number }>
    
    if (validNumbers.length > 0) {
      // Extract description (text before the last number)
      const lastNumIndex = nums[nums.length - 1]?.index ?? -1
      const desc = lastNumIndex > 1 ? line.slice(0, lastNumIndex).trim() : line.replace(amountRe, '').trim()
      const price = validNumbers[validNumbers.length - 1].n
      
      if (desc && desc.length > 2 && !/^\d+$/.test(desc)) {
        let quantity: number | undefined
        let unitPrice: number | undefined
        let total: number | undefined = price
        
        // If we have multiple numbers, try to parse quantity and unit price
        if (validNumbers.length >= 2) {
          const possibleQty = validNumbers[0].n
          if (possibleQty <= 100 && Math.abs(possibleQty - Math.round(possibleQty)) < 0.001) {
            quantity = Math.round(possibleQty)
            unitPrice = validNumbers[validNumbers.length - 2].n
            total = validNumbers[validNumbers.length - 1].n
          } else {
            // Two prices, assume unit price and total
            unitPrice = validNumbers[validNumbers.length - 2].n
            total = validNumbers[validNumbers.length - 1].n
          }
        }
        
        items.push({ description: desc, quantity, unitPrice, total })
        currentDescription = ''
        pendingPrice = undefined
      } else {
        // This line has numbers but poor description, might be continuation
        currentDescription = desc || currentDescription
      }
    } else {
      // No numbers in this line - might be a product description
      const cleanLine = line.replace(/^\d+\s*/, '').trim() // Remove leading numbers/codes
      if (cleanLine.length > 2 && /[A-Za-zÀ-ÿ]/.test(cleanLine)) {
        // If we have a pending price from previous line, create item
        if (pendingPrice && typeof pendingPrice === 'number') {
          items.push({ 
            description: cleanLine, 
            total: pendingPrice 
          })
          pendingPrice = undefined
          currentDescription = ''
        } else {
          // Store as potential description for next price
          currentDescription = cleanLine
        }
      }
    }
    
    // Look ahead for price on next line if we have a description
    if (currentDescription && i + 1 < allLines.length) {
      const nextLine = allLines[i + 1].trim()
      if (isPriceOnly(nextLine)) {
        const price = parseAmount(nextLine)
        if (typeof price === 'number') {
          items.push({ 
            description: currentDescription.trim(), 
            total: price 
          })
          currentDescription = ''
          i++ // Skip the price line since we consumed it
        }
      }
    }
  }

  // Remove duplicates and clean up
  const filtered = items.filter(it => 
    it.description && 
    it.description.length > 1 &&
    !/^[-+]?\d/.test(it.description) &&
    (typeof it.total === 'number' || typeof it.unitPrice === 'number')
  ).reduce((acc: any[], it) => {
    const key = `${it.description}|${it.total ?? ''}`
    if (!acc.find(x => `${x.description}|${x.total ?? ''}` === key)) acc.push(it)
    return acc
  }, [])

  // Totals heuristics from tail
  let subtotal: number | undefined
  let tax: number | undefined
  let total: number | undefined
  for (const line of allLines.slice(-60)) {
    const m = line.match(/\b(subtotal|total\s*sem\s*iva|before\s*tax)\b.*?([0-9.,]+)\b/i)
    if (m) subtotal = subtotal ?? parseAmount(m[2]!)
    const mt = line.match(/\b(iva|vat|taxa|imposto)\b.*?([0-9.,]+)\b/i)
    if (mt) tax = tax ?? parseAmount(mt[2]!)
    const tt = line.match(/\b(total)\b.*?([0-9.,]+)\b/i)
    if (tt) total = total ?? parseAmount(tt[2]!)
  }
  if (typeof total !== 'number') {
    const sum = filtered.reduce((s, it) => s + (typeof it.total === 'number' ? it.total : (typeof it.unitPrice === 'number' && typeof it.quantity === 'number' ? it.unitPrice * it.quantity : 0)), 0)
    total = isFinite(sum) ? Number(sum.toFixed(2)) : undefined
  }
  if (typeof subtotal !== 'number' && typeof total === 'number' && typeof tax === 'number') subtotal = Number((total - tax).toFixed(2))

  // Merchant/date heuristics
  let merchant: string | undefined
  let date: string | '' = ''
  for (const line of allLines.slice(0, 20)) {
    if (!merchant) {
      const s = line.trim()
      if (s.length > 3 && !/\d{2,}/.test(s) && !/subtotal|total|iva|vat|imposto/i.test(s)) merchant = s
    }
    if (!date) {
      const d = parseFlexibleDate(line)
      if (d) date = d
    }
    if (merchant && date) break
  }

  if (!filtered.length) return undefined
  return { merchant, date, subtotal, tax, total, items: filtered }
}


export async function POST(request: NextRequest) {
  const startTime = Date.now()
  try {
    const supabase = await createClient()
    const url = new URL(request.url)
    const formData = await request.formData()
    
    // Permitir bypass da autenticação para testes locais
    const isTestMode = getEnv('NODE_ENV') === 'development' && (
      url.searchParams.get('test') === '1' || 
      formData.get('test') === '1' ||
      request.headers.get('authorization')?.includes('test-token')
    )
    
    let user;
    if (isTestMode) {
      console.log('[AUTH] 🧪 Modo de teste ativo - bypass da autenticação')
      user = { id: 'test-user-id' };
    } else {
      const { data: { user: authUser }, error: authError } = await supabase.auth.getUser()
      if (authError || !authUser) {
        return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
      }
      user = authUser;
    }

  const debug = url.searchParams.get('debug') === '1' || getEnv('DOC_AI_DEBUG') === '1'
  const file = formData.get('file') as File
    const providedProcessorId = (formData.get('processorId') as string) || undefined
    const providedLocation = (formData.get('location') as string) || undefined
    const providedDocType = (formData.get('documentType') as string) || undefined // 'bank_statement' | 'credit_card'
  const rawMode = url.searchParams.get('raw') === '1' || (formData.get('raw') === '1')
  const entitiesOnly = url.searchParams.get('entitiesOnly') === '1' || (formData.get('entitiesOnly') === '1')
  const aiMap = url.searchParams.get('ai') === '1' || url.searchParams.get('aiMap') === '1' || (formData.get('ai') === '1') || (formData.get('aiMap') === '1')
  const useOpenAI = url.searchParams.get('openai') === '1' || (formData.get('openai') === '1') || url.searchParams.get('useOpenAI') === 'true' || (formData.get('useOpenAI') === 'true') || getEnv('DEFAULT_USE_OPENAI') === 'true'
  
  console.log('[CONFIG] ⚙️ Configurações de parsing:')
  console.log('[CONFIG]   - useOpenAI via params:', url.searchParams.get('openai'), url.searchParams.get('useOpenAI'))
  console.log('[CONFIG]   - useOpenAI via form:', formData.get('openai'), formData.get('useOpenAI'))
  console.log('[CONFIG]   - DEFAULT_USE_OPENAI env:', getEnv('DEFAULT_USE_OPENAI'))
  console.log('[CONFIG]   - 🎯 DECISÃO FINAL useOpenAI:', useOpenAI)

  if (!file) return NextResponse.json({ error: 'Nenhum arquivo fornecido' }, { status: 400 })
  const allowedTypes = new Set(['application/pdf','image/jpeg','image/png'])
  if (!allowedTypes.has(file.type)) return NextResponse.json({ error: 'Formato não suportado (use PDF ou imagem JPG/PNG)' }, { status: 400 })
  if (file.size > 10 * 1024 * 1024) return NextResponse.json({ error: 'Arquivo muito grande (máximo 10MB)' }, { status: 400 })

    // Limite diário opcional
    const limit = Number(getEnv('GOOGLE_AI_DAILY_LIMIT', '500'))
    const used = await checkDailyUsage()
    if (used >= limit) {
      return NextResponse.json({ error: 'Limite diário do Google Document AI atingido' }, { status: 429 })
    }

    // Config Document AI
  const { v1 } = await import('@google-cloud/documentai')
    const projectId = getEnv('GOOGLE_CLOUD_PROJECT_ID')
  const location = providedLocation || getEnv('GOOGLE_CLOUD_REGION') || getEnv('GOOGLE_CLOUD_LOCATION') || 'us'

    // Seleção de processor: prioridade para o informado no form; caso contrário usar por tipo
  const RECEIPT_DEFAULT = 'd4fe80562b6b11dc'
  let processorId = providedProcessorId
  let detectedDocType: DocKind | undefined
  const AUTO_DETECT = (url.searchParams.get('auto') === '1') || (formData.get('auto') === '1') || !providedDocType
  const genericProcessor = getEnv('GOOGLE_DOCUMENT_AI_PROCESSOR_ID')
  const bankProcessor = getEnv('GOOGLE_DOCUMENT_AI_PROCESSOR_ID_BANK')
  const cardProcessor = getEnv('GOOGLE_DOCUMENT_AI_PROCESSOR_ID_CARD')
  const receiptProcessor = getEnv('GOOGLE_DOCUMENT_AI_PROCESSOR_ID_RECEIPT') || RECEIPT_DEFAULT

  // Preflight auto-detect (single pass) if not explicitly provided
  let preflightDocument: any | null = null

  // opcional: versão específica do processor
  const providedProcessorVersion = (formData.get('processorVersion') as string) || getEnv('GOOGLE_DOCUMENT_AI_PROCESSOR_VERSION')

  let finalProcessorId = processorId

  if (!projectId) {
      return NextResponse.json({ error: 'Credenciais do Google Document AI não configuradas' }, { status: 500 })
    }

    const apiEndpoint = location === 'eu' ? 'eu-documentai.googleapis.com' : 'us-documentai.googleapis.com'
    // Prefer base64 credentials; fallback to GOOGLE_APPLICATION_CREDENTIALS path; otherwise rely on ADC
    let credentials: any | null = null
    try {
      credentials = getGoogleCredentials()
    } catch (_) {
      credentials = null
    }
    const credentialsPath = resolveCredentialsPath(getEnv('GOOGLE_APPLICATION_CREDENTIALS'))
    const client = new v1.DocumentProcessorServiceClient({
      projectId,
      apiEndpoint,
      ...(credentials ? { credentials: { client_email: credentials.client_email, private_key: credentials.private_key } } : {}),
      ...(!credentials && credentialsPath ? { keyFilename: credentialsPath } : {}),
    })

    // Run preflight auto-detect now that client exists (when not explicitly given)
    if (!finalProcessorId && AUTO_DETECT && genericProcessor) {
      try {
        const baseProcessor = `projects/${projectId}/locations/${location}/processors/${genericProcessor}`
        const name = baseProcessor
        const buffer = Buffer.from(await file.arrayBuffer())
        const preReq = { name, rawDocument: { content: buffer.toString('base64'), mimeType: file.type || 'application/pdf' } }
        const [prefRes] = await client.processDocument(preReq as any)
        const prefDoc = (prefRes as any).document as { text?: string; entities?: DocAIEntity[] }
        const prefEntities = prefDoc?.entities || []
        detectedDocType = guessDocTypeFromEntities(prefEntities) || guessDocTypeFromText(prefDoc?.text || '') || (providedDocType as DocKind | undefined)
        preflightDocument = prefDoc
        await incrementDailyUsage(1)
      } catch (e) {
        if (debug) console.debug('[DocAI] Preflight auto-detect failed; continuing with fallbacks', e)
      }
    }

    // Choose specialized processor by detected or provided type
    const docTypeForProcessor = (detectedDocType || (providedDocType as DocKind) || 'bank_statement')
    if (!finalProcessorId) {
      if (docTypeForProcessor === 'credit_card') finalProcessorId = cardProcessor || genericProcessor
      else if (docTypeForProcessor === 'bank_statement') finalProcessorId = bankProcessor || genericProcessor
      else if (docTypeForProcessor === 'receipt') finalProcessorId = receiptProcessor || genericProcessor
    }

    if (debug) {
      console.debug('[DocAI] Config', {
        hasProject: !!projectId,
        location,
        processorId: finalProcessorId,
        detectedDocType,
        processorVersion: providedProcessorVersion || 'default',
        apiEndpoint,
      })
    }

    if (!finalProcessorId) {
      return NextResponse.json({ error: 'Processor não configurado' }, { status: 500 })
    }

    const baseProcessor = `projects/${projectId}/locations/${location}/processors/${finalProcessorId}`
    const name = providedProcessorVersion
      ? `${baseProcessor}/processorVersions/${providedProcessorVersion}`
      : baseProcessor
    const buffer = Buffer.from(await file.arrayBuffer())

  const requestDoc = {
      name,
      rawDocument: {
        content: buffer.toString('base64'),
    mimeType: file.type || 'application/pdf',
      },
    }

  const [result] = await client.processDocument(requestDoc as any)
  const document = (result as any).document as { text?: string; entities?: DocAIEntity[]; pages?: any[] }

    if (!document) {
      return NextResponse.json({ error: 'Falha no processamento do Document AI' }, { status: 500 })
    }

  // Mapear entidades
  const entities = document.entities || []
  if (debug) {
      const summary = summarizeEntities(entities)
      const pagesCount = Array.isArray((document as any).pages) ? (document as any).pages.length : 0
      console.debug('[DocAI] Resultado (resumo)', {
        pages: pagesCount,
        textLen: (document.text || '').length,
        entities: summary,
      })
    }

  // 🚀 NEW: Try bank-specific parsing first (Hybrid approach)
  const bankParseResult = parseBankDocument(document.text || '')
  if (bankParseResult && debug) {
    const resultType = 'bank' in bankParseResult ? 'bank_statement' : 
                      'store' in bankParseResult ? 'receipt' : 'credit_card'
    const bankOrStore = 'bank' in bankParseResult ? (bankParseResult as any).bank :
                       'store' in bankParseResult ? (bankParseResult as any).store : 
                       (bankParseResult as any).bank
    const transactionCount = 'transactions' in bankParseResult ? 
                           (bankParseResult as any).transactions?.length || 0 : 0
    const itemCount = 'items' in bankParseResult ? 
                     (bankParseResult as any).items?.length || 0 : 0
    
    console.debug('[BANK-PARSER] Resultado do parser específico:', {
      bank: bankOrStore,
      transactions: transactionCount,
      items: itemCount,
      type: resultType
    })
  }

  // Use bank-specific parsing if successful, otherwise fallback to Document AI entities
  let transactions: any[] = []
  let detectedBank = ''
  let bankPeriod = { start: '', end: '' }
  let isReceiptMode = false
  let parsingMethod = 'document-ai-fallback'
  let openAIResult: any = null
  
  // 🤖 NEW: Option to use OpenAI for parsing
  if (useOpenAI) {
    console.log('[OPENAI-PARSER] 🤖 Tentando parsing com OpenAI...')
    openAIResult = await parseWithOpenAI(document.text || '', debug)
    
    console.log('[OPENAI-DEBUG] 🔍 OpenAI Result:', openAIResult ? 'EXISTS' : 'NULL')
    if (openAIResult) {
      console.log('[OPENAI-DEBUG] 🔍 OpenAI Result keys:', Object.keys(openAIResult))
      console.log('[OPENAI-DEBUG] 🔍 Items array:', openAIResult.items ? `EXISTS (${openAIResult.items.length})` : 'NULL/UNDEFINED')
    }
    
    // Use OpenAI result if it exists, even with 0 items (it might have document info)
    if (openAIResult) {
      console.log('[OPENAI-PARSER] ✅ OpenAI retornou resultado válido')
      parsingMethod = 'openai'
      detectedBank = openAIResult.establishment?.name || 'OpenAI-Detected'
      
      // Convert OpenAI format to our transaction format
      if (openAIResult.items && openAIResult.items.length > 0) {
        console.log('[OPENAI-PARSER] 📦 Convertendo', openAIResult.items.length, 'items para transações')
        transactions = openAIResult.items.map((item: any) => ({
          date: openAIResult.date || new Date().toISOString().split('T')[0],
          description: item.description || 'Item sem descrição',
          amount: item.totalPrice ? -Math.abs(item.totalPrice) : 0, // Negative for expenses
          category: item.category || 'Outros',
          quantity: item.quantity,
          unitPrice: item.unitPrice
        }))
      } else {
        console.log('[OPENAI-PARSER] ⚠️ OpenAI não extraiu items individuais, criando entrada única')
        // Create a single transaction for the total amount if no items were extracted
        if (openAIResult.totalAmount && openAIResult.totalAmount > 0) {
          transactions = [{
            date: openAIResult.date || new Date().toISOString().split('T')[0],
            description: `${openAIResult.establishment?.name || 'Estabelecimento'} - Total`,
            amount: -Math.abs(openAIResult.totalAmount),
            category: 'Compras',
            quantity: 1,
            unitPrice: openAIResult.totalAmount
          }]
        }
      }
      
      bankPeriod = { 
        start: openAIResult.date || '', 
        end: openAIResult.date || '' 
      }
      isReceiptMode = openAIResult.documentType === 'receipt' || openAIResult.documentType === 'invoice'
      
      console.log('[OPENAI-PARSER] ✅ OpenAI parsing bem-sucedido!')
      console.log('[OPENAI-PARSER] 📊 Resultado final:', {
        transacoes: transactions.length,
        banco: detectedBank,
        modo_recibo: isReceiptMode,
        metodo: parsingMethod
      })
    } else {
      console.log('[OPENAI-PARSER] ⚠️ OpenAI parsing falhou, continuando com outros métodos')
    }
  
  // Only try other methods if OpenAI didn't work or wasn't requested
  if (transactions.length === 0) {
    if (bankParseResult) {
      // Check if it's a receipt
      if ('store' in bankParseResult) {
        console.log('[BANK-PARSER] ✅ Usando parser específico de recibo')
        isReceiptMode = true
        parsingMethod = 'bank-specific'
        const receiptResult = bankParseResult as any
        detectedBank = receiptResult.store
        bankPeriod = { start: receiptResult.date, end: receiptResult.date }
        
        // Convert receipt items to transaction format
        if (receiptResult.items && receiptResult.items.length > 0) {
          transactions = receiptResult.items.map((item: any) => ({
            date: receiptResult.date,
            description: item.description,
            amount: -Math.abs(item.totalPrice), // Negative for expenses
            category: 'Compras',
            quantity: item.quantity,
            unitPrice: item.unitPrice
          }))
        } else if (receiptResult.totalAmount > 0) {
          // If no items found, create single transaction for total
          transactions = [{
            date: receiptResult.date,
            description: `Compra em ${receiptResult.store}`,
            amount: -Math.abs(receiptResult.totalAmount),
            category: 'Compras'
          }]
        }
      } 
      // Check if it's a bank document with transactions
      else if ('transactions' in bankParseResult && bankParseResult.transactions && bankParseResult.transactions.length > 0) {
        console.log('[BANK-PARSER] ✅ Usando parser específico do banco')
        parsingMethod = 'bank-specific'
        const bankResult = bankParseResult as any
        transactions = bankResult.transactions
        detectedBank = bankResult.bank
        bankPeriod = bankResult.period
      }
    }
  }
  
  // Fallback to Document AI if no specific parser worked
  if (transactions.length === 0) {
    console.log('[BANK-PARSER] ⚠️ Parser específico falhou, usando Document AI')
    // Fallback to original Document AI parsing
    transactions = mapTransactions(entities)
    
    // 2) Fallback: tables
    if ((!transactions || transactions.length === 0) && document) {
      const tableTx = extractTransactionsFromTables(document, debug)
      if (tableTx.length > 0) transactions = tableTx
      else if (debug) console.debug('[DocAI] Fallback tabelas não encontrou transações')
    }
    // 3) Fallback: lines
    if ((!transactions || transactions.length === 0) && document) {
      const lineTx = extractTransactionsFromLines(document, debug)
      if (lineTx.length > 0) transactions = lineTx
      else if (debug) console.debug('[DocAI] Fallback linhas não encontrou transações')
    }
    // 4) Fallback: plain text
    if ((!transactions || transactions.length === 0) && document?.text) {
      const textTx = extractTransactionsFromText(document.text)
      if (textTx.length > 0) transactions = textTx
      else if (debug) console.debug('[DocAI] Fallback texto não encontrou transações')
    }
  }

  const docTypeEntity = entities.find(e => e.type?.toLowerCase().includes('document_type'))
    const institutionEntity = entities.find(e => /bank|issuer|institution|institution_name/i.test(e.type || ''))
    const periodStartEntity = entities.find(e => /period_start|start_date|billing_period_start/i.test(e.type || ''))
    const periodEndEntity = entities.find(e => /period_end|end_date|billing_period_end/i.test(e.type || ''))
    // Heurísticas de fallback
    const fallbackInstitution = (() => {
      const t = document.text || ''
      const banks = ['Nubank','Itaú','Caixa Geral','CGD','Millennium','Santander','BB','Novo Banco','BCP','Revolut','Wise']
      for (const b of banks) if (new RegExp(`\\b${b}\\b`, 'i').test(t)) return b
      return 'Não identificado'
    })()
    const fallbackPeriod = detectPeriod(document.text || '')

    const cardCandidate = extractCardInfo(entities)

    // Try to extract an itemized receipt (optional)
  const isReceipt = (providedDocType === 'receipt') || (detectedDocType === 'receipt') || ((textOf(docTypeEntity) || '').toLowerCase().includes('receipt'))
    let receipt = extractReceiptFromEntities(entities)
    // Use table extraction for receipts as a fallback
    if (!receipt && !entitiesOnly) {
      receipt = extractReceiptFromTables(document)
    }
    // Dynamic table (headers + rows) for clients that prefer building from headers
    let receiptTable: { headers: string[]; rows: string[][]; columnSemantics: { description?: number; quantity?: number; unitPrice?: number; total?: number; code?: number; tax?: number } } | undefined
    if (isReceipt) {
      receiptTable = buildDynamicReceiptTable(document)
    }
    // Optional AI mapping: trust Google entities (line_item) and let LLM normalize
    let aiMapped = false
  if ((isReceipt) && aiMap) {
      try {
        const mapped = await aiMapReceipt(entities, document.text || '')
        if (mapped && mapped.items && mapped.items.length) {
          receipt = mapped as any
          aiMapped = true
        }
      } catch (e) {
        if (debug) console.debug('[DocAI] AI map failed, fallback to heuristics', e)
      }
    }
    // If missing or low quality, fallback to text-based extraction - especially important for receipts
  if ((!receipt || isPoorReceiptItems(receipt.items)) && document?.text) {
      const fromText = extractReceiptFromText(document)
      if (fromText && fromText.items && fromText.items.length > 0) {
        receipt = fromText
      }
    }

    // If explicitly a receipt, prioritize receipt semantics: produce a single aggregated transaction
  if ((isReceipt) && receipt && typeof receipt.total === 'number') {
      const txDate = receipt.date || new Date().toISOString().slice(0,10)
      const desc = (receipt.merchant ? `${receipt.merchant} (recibo)` : 'Recibo')
      // Expense by default
      const amt = -Math.abs(Number(receipt.total))
      transactions = [{ date: txDate, description: desc, amount: amt, suggestedCategory: 'outros' }]
    }

    const data = {
  documentType: (detectedDocType as any) || (providedDocType as any) || (textOf(docTypeEntity) as any) || 'bank_statement',
  institution: (providedDocType === 'receipt' && receipt?.merchant) ? receipt.merchant : (textOf(institutionEntity) || fallbackInstitution),
      period: {
        start: textOf(periodStartEntity) || fallbackPeriod.start || '',
        end: textOf(periodEndEntity) || fallbackPeriod.end || '',
      },
      transactions,
      receipts: receipt ? [{ ...receipt, table: receiptTable }] : [],
      cardCandidate,
    }

    // Contas do usuário para seleção
    const { data: accounts } = await supabase
      .from('accounts')
      .select('id, name, type')
      .eq('user_id', user.id)
    // Cartões do usuário para seleção (retornar separadamente; cliente pode combinar)
    const { data: creditCards } = await supabase
      .from('credit_cards')
      .select('id, bank_name, card_name, last_four_digits, card_type, is_active')
      .eq('user_id', user.id)

    await incrementDailyUsage()

    const processingTime = Date.now() - startTime
    const responseBody: any = {
      success: true,
      message: `Processado com Google Document AI em ${processingTime}ms` ,
      data,
      accounts: accounts || [],
      creditCards: creditCards || [],
      // Add bank detection information
      bankInfo: detectedBank ? {
        detectedBank,
        parsingMethod: parsingMethod,
        documentType: isReceiptMode ? 'receipt' : 'bank_document',
        period: bankPeriod,
        transactionsFound: transactions.length,
        ...(openAIResult && {
          openAI: {
            confidence: openAIResult.metadata?.confidence,
            documentType: openAIResult.documentType,
            establishment: openAIResult.establishment,
            totalAmount: openAIResult.totalAmount,
            notes: openAIResult.metadata?.notes
          }
        })
      } : {
        detectedBank: 'unknown',
        parsingMethod: parsingMethod,
        documentType: 'unknown',
        transactionsFound: transactions.length
      }
    }

    // Optional raw payload for client-side mapping decisions
    if (rawMode) {
      const fullText: string = document.text || ''
      const anchorToText = (anchor: any): string => {
        if (!anchor?.textSegments?.length) return ''
        let s = ''
        for (const seg of anchor.textSegments) {
          const start = seg.startIndex || 0
          const end = seg.endIndex
          if (typeof end === 'number' && end > start) s += fullText.substring(start, end)
        }
        return s
      }
      const toEntityTree = (e: DocAIEntity): any => ({
        type: e.type,
        text: textOf(e),
        normalized: e.normalizedValue?.text ?? e.normalizedValue?.numberValue,
        properties: (e.properties || []).map(toEntityTree)
      })
      const pages = (document.pages || []).map((pg: any) => {
        const lines = (pg.lines || []).map((ln: any) => anchorToText(ln.layout?.textAnchor).replace(/\s+/g, ' ').trim()).filter(Boolean)
        const tables = (pg.tables || []).map((tb: any) => {
          const header = (tb.headerRows?.[0]?.cells || []).map((c: any) => anchorToText(c.layout?.textAnchor).replace(/\s+/g, ' ').trim())
          const rows = (tb.bodyRows || []).map((r: any) => (r.cells || []).map((c: any) => anchorToText(c.layout?.textAnchor).replace(/\s+/g, ' ').trim()))
          return { header, rows }
        })
        return { lines, tables }
      })
      responseBody.raw = {
        pagesCount: Array.isArray((document as any).pages) ? (document as any).pages.length : 0,
        text: document.text || '',
        entities: (document.entities || []).map(toEntityTree),
        pages,
      }
    }

    // Opcional: salvar RAW para auditoria/debug
    const saveRaw = url.searchParams.get('save') === '1' || getEnv('DOC_AI_SAVE_RAW') === '1'
    let debugId: string | undefined
    if (saveRaw) {
      try {
        const pagesCount = Array.isArray((document as any).pages) ? (document as any).pages.length : 0
        const insertRes = await supabase
          .from('docai_debug')
          .insert({
            user_id: user.id,
            processor_id: finalProcessorId,
            processor_version: providedProcessorVersion || 'default',
            location,
            pages: pagesCount,
            text_len: (document.text || '').length,
            entity_types: Array.from(new Set(entities.map(e => (e.type || '').toLowerCase()).filter(Boolean))),
            document: document as any,
          })
          .select('id')
          .single()
        debugId = (insertRes.data as any)?.id
      } catch (e) {
        console.error('Falha ao salvar RAW Document AI:', e)
      }
    }

  if (debug) {
      const pagesCount = Array.isArray((document as any).pages) ? (document as any).pages.length : 0
  responseBody.debug = {
        config: {
          location,
          processorId: finalProcessorId,
          processorVersion: providedProcessorVersion || 'default',
          apiEndpoint,
        },
        result: {
          pages: pagesCount,
          textPreview: trimText(document.text, 1000),
          entities: summarizeEntities(entities),
          extraction: {
            transactionsFound: transactions.length,
    samples: (transactions || []).slice(0, 3),
    receiptItems: receipt?.items?.length || 0,
            aiMapped,
          },
          id: debugId,
        },
      }
    }

    return NextResponse.json(responseBody)
  } catch (error: any) {
    console.error('Erro Document AI:', error)
    const msg = error?.message || 'Erro ao processar PDF com Google Document AI'
    const status = msg.includes('Limite diário') ? 429 : 500
    return NextResponse.json({ error: msg, debug: getEnv('DOC_AI_DEBUG') === '1' ? { details: error?.details, code: error?.code } : undefined }, { status })
  }
}

// GET: Verificar status do sistema
export async function GET() {
  return NextResponse.json({
    status: 'ready',
    method: 'google-document-ai',
    description: 'Processamento exclusivo via Google Document AI',
    limits: {
      maxFileSize: '10MB',
      supportedFormats: ['application/pdf'],
      dailyLimit: Number(getEnv('GOOGLE_AI_DAILY_LIMIT', '500')),
    },
    configuration: {
      projectId: !!getEnv('GOOGLE_CLOUD_PROJECT_ID'),
      location: getEnv('GOOGLE_CLOUD_REGION') || getEnv('GOOGLE_CLOUD_LOCATION') || 'us',
      defaultProcessorConfigured: !!getEnv('GOOGLE_DOCUMENT_AI_PROCESSOR_ID'),
      bankProcessorConfigured: !!getEnv('GOOGLE_DOCUMENT_AI_PROCESSOR_ID_BANK'),
      cardProcessorConfigured: !!getEnv('GOOGLE_DOCUMENT_AI_PROCESSOR_ID_CARD'),
      receiptProcessorConfigured: !!(getEnv('GOOGLE_DOCUMENT_AI_PROCESSOR_ID_RECEIPT') || true),
      processorVersion: getEnv('GOOGLE_DOCUMENT_AI_PROCESSOR_VERSION') || 'default',
    },
    supportedFormats: ['application/pdf','image/jpeg','image/png'],
  })
}