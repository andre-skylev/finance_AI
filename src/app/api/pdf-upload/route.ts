import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import path from 'path'
import { getGoogleCredentials } from '@/lib/google-auth'
import OpenAI from 'openai'

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
  // Recognize common transaction entity types (including credit card/table schemas)
  const txTypes = /^(transaction|line_item|table_item|table_row|bank_transaction|statement_line|installments?)$/i
  const dateKeys = [
    'date',
    'transaction_date',
    'processed_date',
    'date_transaction',
    'data',
    'dt',
  ]
  const descKeys = ['description', 'merchant', 'comerciante', 'descricao']
  const amountKeys = [
    'amount',
    'installment_amount',
    'amount_refund',
    'valor',
    'value',
    'total',
  ]
  const categoryKeys = ['category', 'categoria']

  // Some processors nest line items under a wrapper (e.g., credit_card_info)
  const collected: DocAIEntity[] = []
  const stack = [...entities]
  while (stack.length) {
    const e = stack.pop()!
    if (!e) continue
    if (e.type && txTypes.test(e.type)) {
      collected.push(e)
    }
    if (e.properties && e.properties.length) {
      // Push children for traversal; some children may themselves be tx entities
      for (const p of e.properties) stack.push(p)
    }
  }

  const txs: any[] = []
  for (const e of collected) {
    let date = textOf(pickProp(e, dateKeys)) || ''
    let desc = textOf(pickProp(e, descKeys)) || e.mentionText || ''
    let amt = numberOf(pickProp(e, amountKeys))
    const cat = (textOf(pickProp(e, categoryKeys)) || 'outros').toString()

    // Fallback: scan child properties heuristically (useful for table_item)
    if ((!date || typeof amt !== 'number' || !desc) && e.properties && e.properties.length) {
      const baseYear = new Date().getFullYear()
      let bestDate = date
      let bestAmt = amt
      let bestDesc = desc
      for (const p of e.properties) {
        const t = textOf(p) || ''
        if (!t) continue
        if (!bestDate) {
          const iso = parseFlexibleDate(t, baseYear) || toISODate(t)
          if (iso) bestDate = iso
        }
        if (typeof bestAmt !== 'number') {
          const n = numberOf(p)
          if (typeof n === 'number') bestAmt = n
          else {
            const n2 = parseAmount(t)
            if (typeof n2 === 'number') bestAmt = n2
          }
        }
        if (!bestDesc) {
          // Prefer non-numeric, longer text for description
          if (/\D/.test(t) && t.length >= (bestDesc?.length || 0)) bestDesc = t
        }
      }
      date = bestDate || date
      amt = typeof bestAmt === 'number' ? bestAmt : amt
      desc = bestDesc || desc
    }

    if (date && typeof amt === 'number') {
      txs.push({
        date,
        description: desc || 'Transação',
        amount: amt,
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
  const dateAnyRe = new RegExp(String.raw`(\d{1,2}[\/-]\d{1,2}(?:[\/-]\d{2,4})?|\d{4}-\d{1,2}-\d{1,2}|\d{1,2}\s+[A-Za-zÀ-ÿ]{3,}\.?\s*\d{0,4})`)
  const amountRe = /[+\-]?\(?\s*[0-9]{1,3}(?:[.,\s][0-9]{3})*(?:[.,][0-9]{2})\s*\)?/g
  for (const raw of lines) {
    const line = raw
    const amounts = Array.from(line.matchAll(amountRe))
    if (!amounts.length) continue
    const lastAmt = amounts[amounts.length - 1]
    const amtText = lastAmt[0]
    let amount = parseAmount(amtText)
    if (typeof amount !== 'number') continue
    const tail = line.slice(lastAmt.index! + amtText.length).trim()
    if (/^\)?\s*(D|DB)\b/i.test(tail) || /\(/.test(amtText) || /-/.test(amtText)) amount = -Math.abs(amount)
    else if (/^\)?\s*(C|CR)\b/i.test(tail) || /\+/.test(amtText)) amount = Math.abs(amount)
    const dm = line.match(dateAnyRe)
    if (!dm) continue
    const dateISO = parseFlexibleDate(dm[1], baseYear) || toISODate(dm[1])
    if (!dateISO) continue
    let description = line
    description = description.replace(dm[1], ' ')
    description = description.substring(0, lastAmt.index) + description.substring(lastAmt.index! + amtText.length)
    description = description.replace(/\s{2,}/g, ' ').trim()
    if (!description || /saldo|balance|resumo|sumário|pagamento|payment/i.test(description)) {
      if (!/[A-Za-z].*\d|\d.*[A-Za-z]/.test(description)) continue
    }
    out.push({ date: dateISO, description, amount, suggestedCategory: 'outros' })
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
  const s = text.replace(/[^0-9,.-]/g, '')
  if (!s) return undefined
  const lastComma = s.lastIndexOf(',')
  const lastDot = s.lastIndexOf('.')
  let normalized = s
  if (lastComma > -1 && lastComma > lastDot) {
    normalized = s.replace(/\./g, '').replace(',', '.')
  } else if (lastDot > -1 && lastDot > lastComma) {
    normalized = s.replace(/,/g, '')
  } else {
    normalized = s.includes(',') ? s.replace(',', '.') : s
  }
  const n = Number(normalized)
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
    if (_descIdx === -1) {
      let maxLen = -1, idx = -1
      for (let i = 0; i < cells.length; i++) { if (cells[i].length > maxLen) { maxLen = cells[i].length; idx = i } }
      _descIdx = idx
    }
    if (qtyIdx === -1) {
      qtyIdx = cells.findIndex((c: string) => /\b\d+[,.]?\d*\b/.test(c) && !/[a-zA-Z]/.test(c))
    }
    if (unitIdx === -1 || totalIdx === -1) {
      for (let i = cells.length - 1; i >= 0; i--) {
        const n = parseAmount(cells[i])
        if (typeof n === 'number') { if (totalIdx === -1) totalIdx = i; else if (unitIdx === -1) unitIdx = i }
      }
    }
    if (taxIdx === -1) {
      // Find a column with a % value
      for (let i = cells.length - 1; i >= 0; i--) {
        const p = parsePercent(cells[i])
        if (typeof p === 'number') { taxIdx = i; break }
      }
    }
  const description = (get(_descIdx) || '').trim()
  // Skip rows where description is missing or purely numeric
  if (!description || !/[A-Za-zÀ-ÿ]/.test(description)) continue
    const code = (get(codeIdx) || '').trim() || undefined
    const quantity = parseAmount(get(qtyIdx))
    const unitPrice = parseAmount(get(unitIdx))
    const total = parseAmount(get(totalIdx))
    const taxRate = parsePercent(get(taxIdx))
    let taxAmount: number | undefined = undefined
    if (typeof taxRate === 'number' && typeof total === 'number') {
      const rate = taxRate / 100
      // If total likely includes tax, estimate tax amount conservatively
      taxAmount = Number((total - total / (1 + rate)).toFixed(2))
      if (!isFinite(taxAmount)) taxAmount = undefined
    }
    // Heuristic skip: summary lines
    if (/subtotal|iva|vat|imposto|taxa|total/i.test(description)) continue
    if (description && (typeof quantity === 'number' || typeof unitPrice === 'number' || typeof total === 'number')) {
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
  const isNumericOnly = (s: string) => /^[-+]?\(?\s*\d{1,3}(?:[.,\s]\d{3})*(?:[.,]\d{2})\s*\)?$/.test(s)

  for (let i = 0; i < allLines.length; i++) {
    const line = allLines[i]
    if (!line || noise.test(line)) continue
    if (isNumericOnly(line)) {
      // Likely a dangling total following a description; if last item exists without total, attach
      const amt = parseAmount(line)
      if (typeof amt === 'number' && items.length && typeof items[items.length - 1].total !== 'number') {
        items[items.length - 1].total = amt
      }
      continue
    }
    // Find numbers in the line
    const amountRe = /[-+]?\(?\s*\d{1,3}(?:[.,\s]\d{3})*(?:[.,]\d{2})\s*\)?/g
    const nums = Array.from(line.matchAll(amountRe)).map(m => ({ text: m[0], index: m.index ?? -1 }))
    const numbers = nums.map(n => ({ n: parseAmount(n.text), index: n.index }))
    const validNumbers = numbers.filter(v => typeof v.n === 'number') as Array<{ n: number; index: number }>
    // Skip lines that are mostly codes
    if (!validNumbers.length) {
      // Could be a continuation/description-only line; if previous has total already, ignore; otherwise start a new item awaiting number on next line
      const desc = line.trim()
      if (desc.length > 3) {
        // Lookahead numeric-only next line becomes total
        let total: number | undefined
        if (i + 1 < allLines.length && isNumericOnly(allLines[i + 1])) {
          total = parseAmount(allLines[i + 1])
          i++
        }
        if (desc && typeof total === 'number') items.push({ description: desc, total })
      }
      continue
    }
    // Use text before first number as description
    const cut = nums[0]?.index ?? -1
    const desc = cut > 1 ? line.slice(0, cut).trim() : line.replace(amountRe, '').trim()
    if (!desc || desc.length < 3) continue
    let quantity: number | undefined
    let unitPrice: number | undefined
    let total: number | undefined
    if (validNumbers.length === 1) {
      total = validNumbers[0].n
    } else if (validNumbers.length >= 2) {
      // Heuristic: two numbers -> unit price then total
      unitPrice = validNumbers[validNumbers.length - 2].n
      total = validNumbers[validNumbers.length - 1].n
      // If there are 3 numbers and the first is near integer, treat as quantity
      if (validNumbers.length >= 3) {
        const q = validNumbers[0].n
        if (Math.abs(q - Math.round(q)) < 0.001 || /\b\d+[,\.]?0{2,}\b/.test(line)) quantity = Math.round(q)
      }
      // If unitPrice > total, swap
      if (typeof unitPrice === 'number' && typeof total === 'number' && unitPrice > total) {
        const tmp = unitPrice; unitPrice = total; total = tmp
      }
    }
    // If next line is numeric-only and total not set, take as total
    if (typeof total !== 'number' && i + 1 < allLines.length && isNumericOnly(allLines[i + 1])) {
      total = parseAmount(allLines[i + 1])
      i++
    }
    if (desc && (typeof total === 'number' || typeof unitPrice === 'number')) {
      items.push({ description: desc, quantity, unitPrice, total })
    }
  }

  // Remove duplicates and numeric-only descriptions
  const filtered = items.filter(it => it.description && !/^[-+]?\d/.test(it.description)).reduce((acc: any[], it) => {
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
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

  const url = new URL(request.url)
  const debug = url.searchParams.get('debug') === '1' || getEnv('DOC_AI_DEBUG') === '1'

  const formData = await request.formData()
  const file = formData.get('file') as File
    const providedProcessorId = (formData.get('processorId') as string) || undefined
    const providedLocation = (formData.get('location') as string) || undefined
    const providedDocType = (formData.get('documentType') as string) || undefined // 'bank_statement' | 'credit_card'
  const rawMode = url.searchParams.get('raw') === '1' || (formData.get('raw') === '1')
  const entitiesOnly = url.searchParams.get('entitiesOnly') === '1' || (formData.get('entitiesOnly') === '1')
  const aiMap = url.searchParams.get('ai') === '1' || url.searchParams.get('aiMap') === '1' || (formData.get('ai') === '1') || (formData.get('aiMap') === '1')

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

  // 1) Entities mapping
    let transactions = mapTransactions(entities)
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
    // Do NOT use tables for receipts to avoid hardcoded table assumptions
    if (!receipt && !entitiesOnly && !isReceipt) {
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
    // If missing or low quality, fallback to text-based extraction
  if ((!receipt || isPoorReceiptItems(receipt.items)) && document?.text) {
      const fromText = extractReceiptFromText(document)
      if (fromText) receipt = fromText
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

    await incrementDailyUsage()

    const processingTime = Date.now() - startTime
    const responseBody: any = {
      success: true,
      message: `Processado com Google Document AI em ${processingTime}ms` ,
      data,
      accounts: accounts || [],
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