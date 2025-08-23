// Bank-specific parsers for financial documents
// Each bank has its own parsing logic based on document structure

interface BankTransaction {
  date: string
  description: string
  amount: number
  suggestedCategory: string
  reference?: string
  location?: string
}

interface BankStatementData {
  bank: string
  accountNumber?: string
  period: { start: string; end: string }
  transactions: BankTransaction[]
  balance?: {
    previous: number
    current: number
  }
}

interface CreditCardData {
  bank: string
  cardNumber?: string
  cardType?: string
  period: { start: string; end: string }
  transactions: BankTransaction[]
  summary?: {
    previousBalance: number
    payments: number
    purchases: number
    currentBalance: number
    minimumPayment: number
    dueDate: string
  }
}

interface ReceiptData {
  store: string
  documentType: 'receipt' | 'invoice'
  date: string
  totalAmount: number
  items: Array<{
    description: string
    quantity?: number
    unitPrice?: number
    totalPrice: number
  }>
  taxInfo?: {
    vatNumber: string
    taxAmount: number
  }
  paymentMethod?: string
}

// Bank detection patterns
const BANK_PATTERNS = {
  NOVO_BANCO: {
    identifiers: [
      /novobanco/i,
      /novo\s*banco/i,
      /extrato\s*de\s*conta[_\-]?cart[aã]o/i,
      /cart[aã]o\s*de\s*cr[ée]dito.*gold/i
    ],
    type: 'credit_card'
  },
  CGD: {
    identifiers: [
      /caixa\s*geral\s*de\s*dep[oó]sitos/i,
      /cgd/i,
      /caixadirecta/i
    ],
    type: 'bank_statement'
  },
  MILLENNIUM: {
    identifiers: [
      /millennium/i,
      /bcp/i,
      /banco\s*comercial\s*portugu[eê]s/i
    ],
    type: 'bank_statement'
  }
}

// Store/Receipt detection patterns
const STORE_PATTERNS = {
  CONTINENTE: {
    identifiers: [
      /continente/i,
      /modelo\s*continente/i,
      /sonae/i
    ],
    type: 'receipt',
    category: 'Supermercado'
  },
  PINGO_DOCE: {
    identifiers: [
      /pingo\s*doce/i,
      /jer[oó]nimo\s*martins/i
    ],
    type: 'receipt',
    category: 'Supermercado'
  },
  LIDL: {
    identifiers: [
      /lidl/i
    ],
    type: 'receipt',
    category: 'Supermercado'
  },
  AUCHAN: {
    identifiers: [
      /auchan/i,
      /jumbo/i
    ],
    type: 'receipt',
    category: 'Supermercado'
  },
  EL_CORTE_INGLES: {
    identifiers: [
      /el\s*corte\s*ingl[eé]s/i,
      /corte\s*ingl[eé]s/i
    ],
    type: 'receipt',
    category: 'Loja'
  },
  WORTEN: {
    identifiers: [
      /worten/i
    ],
    type: 'receipt',
    category: 'Eletrodomésticos'
  },
  FNAC: {
    identifiers: [
      /fnac/i
    ],
    type: 'receipt',
    category: 'Loja'
  },
  MEDIA_MARKT: {
    identifiers: [
      /media\s*markt/i,
      /mediamarkt/i
    ],
    type: 'receipt',
    category: 'Eletrodomésticos'
  },
  FARMACIA: {
    identifiers: [
      /farm[aá]cia/i,
      /farmcias/i
    ],
    type: 'receipt',
    category: 'Farmácia'
  },
  GASOLINEIRA: {
    identifiers: [
      /galp/i,
      /bp/i,
      /repsol/i,
      /cepsa/i,
      /petrogal/i
    ],
    type: 'receipt',
    category: 'Combustível'
  },
  GENERICO: {
    identifiers: [
      /fatura/i,
      /recibo/i,
      /nota\s*fiscal/i
    ],
    type: 'receipt',
    category: 'Compras'
  }
}

// Continuing with banks
const BANK_PATTERNS_CONTINUED = {
  ITAU: {
    identifiers: [
      /ita[uú]/i,
      /banco\s*ita[uú]/i
    ],
    type: 'bank_statement'
  },
  NUBANK: {
    identifiers: [
      /nubank/i,
      /nu\s*pagamentos/i
    ],
    type: 'credit_card'
  }
}

// Detect bank from document text
function detectBank(text: string): { bank: string; type: string } | null {
  const normalizedText = text.toLowerCase()
  
  console.log('[BANK-DETECTION] Iniciando detecção de banco...')
  console.log('[BANK-DETECTION] Texto normalizado (primeiros 200 chars):', normalizedText.substring(0, 200))
  
  for (const [bankName, config] of Object.entries(BANK_PATTERNS)) {
    for (const pattern of config.identifiers) {
      if (pattern.test(normalizedText)) {
        console.log(`[BANK-DETECTION] ✅ Banco detectado: ${bankName} via padrão: ${pattern}`)
        return { bank: bankName, type: config.type }
      }
    }
  }
  
  // Check for additional banks
  for (const [bankName, config] of Object.entries(BANK_PATTERNS_CONTINUED)) {
    for (const pattern of config.identifiers) {
      if (pattern.test(normalizedText)) {
        console.log(`[BANK-DETECTION] ✅ Banco detectado: ${bankName} via padrão: ${pattern}`)
        return { bank: bankName, type: config.type }
      }
    }
  }
  
  console.log('[BANK-DETECTION] ❌ Nenhum banco detectado')
  return null
}

// Detect store from document text
function detectStore(text: string): { store: string; category: string } | null {
  const normalizedText = text.toLowerCase()
  
  console.log('[STORE-DETECTION] Iniciando detecção de loja...')
  console.log('[STORE-DETECTION] Texto normalizado (primeiros 200 chars):', normalizedText.substring(0, 200))
  console.log('[STORE-DETECTION] Texto completo (tamanho):', normalizedText.length, 'chars')
  
  // First, check if this looks like a bank document (to avoid false positives)
  const bankKeywords = [
    /extrato\s*de\s*(conta|cart[aã]o|movimentos)/i,
    /cart[aã]o\s*de\s*cr[ée]dito/i,
    /novobanco|novo\s*banco/i,
    /caixa\s*geral\s*de\s*dep[oó]sitos/i,
    /millennium.*bcp/i,
    /conta[_\-]?cart[aã]o/i
  ]
  
  for (const pattern of bankKeywords) {
    if (pattern.test(normalizedText)) {
      console.log('[STORE-DETECTION] ⚠️ Documento parece ser bancário, não é recibo de loja')
      return null
    }
  }
  
  // Check for receipt/invoice indicators first
  const isReceiptOrInvoice = (
    /nif.*consumidor\s*final/i.test(normalizedText) ||
    /fatura\s*(simplificada|normal)/i.test(normalizedText) ||
    /recibo/i.test(normalizedText) ||
    /artigos.*codigo.*descricao/i.test(normalizedText) ||
    /quant.*p\.unit.*valor/i.test(normalizedText) ||
    /subtotal.*total/i.test(normalizedText) ||
    /obrigado.*visita/i.test(normalizedText)
  )
  
  if (!isReceiptOrInvoice) {
    console.log('[STORE-DETECTION] ⚠️ Documento não parece ser recibo/fatura')
    return null
  }
  
  console.log('[STORE-DETECTION] ✅ Documento identificado como recibo/fatura')
  
  // Now search for store patterns in the ENTIRE text
  for (const [storeName, config] of Object.entries(STORE_PATTERNS)) {
    for (const pattern of config.identifiers) {
      if (pattern.test(normalizedText)) {
        console.log(`[STORE-DETECTION] ✅ Loja detectada: ${storeName} via padrão: ${pattern}`)
        return { store: storeName, category: config.category }
      }
    }
  }
  
  // If no specific store found, try to extract store name from document structure
  console.log('[STORE-DETECTION] 🔍 Tentando detectar loja por estrutura do documento...')
  
  // Look for common patterns in Portuguese invoices/receipts
  const storeNamePatterns = [
    // Look for company names near NIF
    /nif[:\s]*\d+[^\n]*\n([^0-9\n]{3,50})/i,
    // Look for names before "consumidor final"
    /([^0-9\n]{3,50})\s*nif.*consumidor\s*final/i,
    // Look for capitalized words in first few lines
    /^([A-ZÀÁÂÃÉÊÍÓÔÕÚÇ\s]{3,50})/m,
    // Look after timestamps/dates
    /\d{4}-\d{2}-\d{2}.*?\*\s*([^*\n]{3,50})/i
  ]
  
  for (const pattern of storeNamePatterns) {
    const match = normalizedText.match(pattern)
    if (match && match[1]) {
      const possibleName = match[1].trim()
      console.log(`[STORE-DETECTION] 🔍 Possível nome encontrado: "${possibleName}"`)
      
      // Check if this name contains known store keywords
      const storeKeywords = [
        { name: 'CONTINENTE', patterns: [/continente|modelo/i], category: 'Supermercado' },
        { name: 'PINGO_DOCE', patterns: [/pingo|doce/i], category: 'Supermercado' },
        { name: 'LIDL', patterns: [/lidl/i], category: 'Supermercado' },
        { name: 'AUCHAN', patterns: [/auchan|jumbo/i], category: 'Supermercado' },
        { name: 'WORTEN', patterns: [/worten/i], category: 'Eletrodomésticos' },
        { name: 'FNAC', patterns: [/fnac/i], category: 'Loja' },
        { name: 'FARMACIA', patterns: [/farm[aáá]cia/i], category: 'Farmácia' },
        { name: 'GASOLINEIRA', patterns: [/galp|bp|repsol|cepsa/i], category: 'Combustível' }
      ]
      
      for (const store of storeKeywords) {
        for (const pattern of store.patterns) {
          if (pattern.test(possibleName)) {
            console.log(`[STORE-DETECTION] ✅ Loja detectada por estrutura: ${store.name}`)
            return { store: store.name, category: store.category }
          }
        }
      }
    }
  }
  
  // Generic receipt detected but no specific store
  console.log('[STORE-DETECTION] ⚠️ Recibo detectado mas loja não identificada, usando genérico')
  return { store: 'GENERICO', category: 'Compras' }
}

// Novo Banco credit card parser
function parseNovoBancoCredit(text: string): CreditCardData | null {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean)
  
  // Extract basic info
  let cardType = ''
  let cardNumber = ''
  let statementNumber = ''
  let currentDate = ''
  let previousDate = ''
  
  for (const line of lines) {
    if (/cart[aã]o\s*de\s*cr[ée]dito:\s*(.+)/i.test(line)) {
      cardType = line.match(/cart[aã]o\s*de\s*cr[ée]dito:\s*(.+)/i)?.[1] || ''
    }
    if (/n\.?\s*de\s*conta[_\-]?cart[aã]o.*:\s*(\d+)/i.test(line)) {
      cardNumber = line.match(/n\.?\s*de\s*conta[_\-]?cart[aã]o.*:\s*(\d+)/i)?.[1] || ''
    }
    if (/extrato\s*n\.?\s*(\d+)/i.test(line)) {
      statementNumber = line.match(/extrato\s*n\.?\s*(\d+)/i)?.[1] || ''
    }
    if (/data\s*extrato\s*atual:\s*([\d.\/]+)/i.test(line)) {
      currentDate = line.match(/data\s*extrato\s*atual:\s*([\d.\/]+)/i)?.[1] || ''
    }
    if (/data\s*extrato\s*anterior:\s*([\d.\/]+)/i.test(line)) {
      previousDate = line.match(/data\s*extrato\s*anterior:\s*([\d.\/]+)/i)?.[1] || ''
    }
  }
  
  // Parse transactions
  const transactions: BankTransaction[] = []
  let inTransactionSection = false
  let currentTransaction: Partial<BankTransaction> = {}
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    
    // Start of transaction section
    if (/movimentos|transaç[oõ]es|opera[cç][oõ]es/i.test(line)) {
      inTransactionSection = true
      continue
    }
    
    // End of transaction section
    if (/totais|resumo|saldo/i.test(line) && inTransactionSection) {
      inTransactionSection = false
      continue
    }
    
    if (!inTransactionSection) continue
    
    // Try to parse transaction date (DD.MM.YYYY or DD/MM/YYYY)
    const dateMatch = line.match(/(\d{1,2}[.\/]\d{1,2}[.\/]\d{4})/);
    if (dateMatch) {
      // Save previous transaction if exists
      if (currentTransaction.date && currentTransaction.description && currentTransaction.amount !== undefined) {
        transactions.push({
          date: normalizeDate(currentTransaction.date),
          description: currentTransaction.description,
          amount: currentTransaction.amount,
          suggestedCategory: 'outros',
          reference: currentTransaction.reference
        })
      }
      
      // Start new transaction
      currentTransaction = {
        date: dateMatch[1],
        description: '',
        reference: ''
      }
      
      // Try to extract amount from same line
      const amountMatch = line.match(/([\d.,]+)\s*€?\s*$/);
      if (amountMatch) {
        currentTransaction.amount = parsePortugueseNumber(amountMatch[1])
      }
      
      // Extract description (everything between date and amount)
      let desc = line.replace(dateMatch[0], '').trim()
      if (amountMatch) {
        desc = desc.replace(amountMatch[0], '').trim()
      }
      currentTransaction.description = desc
      
      continue
    }
    
    // If we're building a transaction, try to add more info
    if (currentTransaction.date) {
      // Check if this line has an amount
      const amountMatch = line.match(/([\d.,]+)\s*€?\s*$/);
      if (amountMatch && currentTransaction.amount === undefined) {
        currentTransaction.amount = parsePortugueseNumber(amountMatch[1])
        // Add description part before amount
        let desc = line.replace(amountMatch[0], '').trim()
        if (desc) {
          currentTransaction.description = (currentTransaction.description + ' ' + desc).trim()
        }
      } else if (!amountMatch) {
        // This might be a continuation of description
        if (line.length > 2 && !/^\d+$/.test(line)) {
          currentTransaction.description = (currentTransaction.description + ' ' + line).trim()
        }
      }
    }
  }
  
  // Add last transaction
  if (currentTransaction.date && currentTransaction.description && currentTransaction.amount !== undefined) {
    transactions.push({
      date: normalizeDate(currentTransaction.date),
      description: currentTransaction.description,
      amount: currentTransaction.amount,
      suggestedCategory: 'outros',
      reference: currentTransaction.reference
    })
  }
  
  return {
    bank: 'NOVO_BANCO',
    cardNumber: cardNumber,
    cardType: cardType,
    period: {
      start: normalizeDate(previousDate),
      end: normalizeDate(currentDate)
    },
    transactions
  }
}

// Helper functions
function parsePortugueseNumber(str: string): number {
  // Handle Portuguese number format: 1.234,56
  const cleaned = str.replace(/[^\d,.-]/g, '')
  if (cleaned.includes(',')) {
    // European format
    const parts = cleaned.split(',')
    if (parts.length === 2) {
      const integerPart = parts[0].replace(/\./g, '')
      const decimalPart = parts[1]
      return parseFloat(integerPart + '.' + decimalPart)
    }
  }
  return parseFloat(cleaned.replace(/[,]/g, '.'))
}

function normalizeDate(dateStr: string): string {
  if (!dateStr) return ''
  
  // Convert DD.MM.YYYY or DD/MM/YYYY to YYYY-MM-DD
  const match = dateStr.match(/(\d{1,2})[.\/](\d{1,2})[.\/](\d{4})/)
  if (match) {
    const [_, day, month, year] = match
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
  }
  
  return dateStr
}

// Main parser function
export function parseBankDocument(text: string): BankStatementData | CreditCardData | ReceiptData | null {
  console.log('[PARSER] 🚀 Iniciando parsing do documento...')
  console.log('[PARSER] Tamanho do texto:', text.length, 'caracteres')
  
  if (!text || text.trim().length < 10) {
    console.log('[PARSER] ❌ Texto muito curto ou vazio')
    return null
  }
  
  // First try to detect banks
  const bankInfo = detectBank(text)
  if (bankInfo) {
    console.log('[PARSER] 🏦 Banco detectado, tentando parser específico...')
    switch (bankInfo.bank) {
      case 'NOVO_BANCO':
        if (bankInfo.type === 'credit_card') {
          console.log('[PARSER] 🔄 Executando parser Novo Banco cartão de crédito')
          const result = parseNovoBancoCredit(text)
          if (result) {
            console.log('[PARSER] ✅ Parser Novo Banco bem-sucedido')
            return result
          } else {
            console.log('[PARSER] ❌ Parser Novo Banco falhou')
          }
        }
        break
      
      // Add more banks here
      case 'CGD':
        console.log('[PARSER] ⚠️ Parser CGD não implementado ainda')
        break
      
      case 'MILLENNIUM':
        console.log('[PARSER] ⚠️ Parser Millennium não implementado ainda')
        break
      
      default:
        console.log('[PARSER] ⚠️ Parser para', bankInfo.bank, 'não implementado ainda')
        break
    }
  }
  
  // If no bank detected, try to detect stores/receipts
  const storeInfo = detectStore(text)
  if (storeInfo) {
    console.log('[PARSER] 🛒 Loja detectada, tentando parser de recibo...')
    const result = parseReceipt(text, storeInfo.store, storeInfo.category)
    if (result) {
      console.log('[PARSER] ✅ Parser de recibo bem-sucedido')
      return result
    } else {
      console.log('[PARSER] ❌ Parser de recibo falhou')
    }
  }
  
  console.log('[PARSER] ❌ Nenhum parser específico funcionou')
  return null
}

// Receipt parser for stores and supermarkets
function parseReceipt(text: string, storeName: string, category: string): ReceiptData | null {
  try {
    console.log(`[RECEIPT-PARSER] 🛒 Parsing receipt for ${storeName} (${category})`)
    
    // Extract date from various formats
    const datePatterns = [
      /(\d{1,2})[.\/\-](\d{1,2})[.\/\-](\d{4})/,
      /(\d{4})[.\/\-](\d{1,2})[.\/\-](\d{1,2})/,
      /data[:\s]*(\d{1,2})[.\/\-](\d{1,2})[.\/\-](\d{4})/i,
      /date[:\s]*(\d{1,2})[.\/\-](\d{1,2})[.\/\-](\d{4})/i
    ]
    
    let documentDate = ''
    for (const pattern of datePatterns) {
      const match = text.match(pattern)
      if (match) {
        const [_, day, month, year] = match
        documentDate = normalizeDate(`${day}/${month}/${year}`)
        break
      }
    }
    
    // Extract total amount - look for various patterns
    const totalPatterns = [
      // Look for "total" followed by amount
      /total[^0-9]*?([\d.,]+)/i,
      /total\s*geral[^0-9]*?([\d.,]+)/i,
      /valor\s*total[^0-9]*?([\d.,]+)/i,
      /total.*c\/iva[^0-9]*?([\d.,]+)/i,
      /montante[^0-9]*?([\d.,]+)/i,
      // Look for amounts at end of lines with euro symbol
      /([\d.,]+)\s*€\s*$/m,
      /€\s*([\d.,]+)\s*$/m,
      // Look for the highest reasonable amount in the document
      /\b([\d]{1,4}[,.][\d]{2})\b/g
    ]
    
    let totalAmount = 0
    const foundAmounts: number[] = []
    
    for (const pattern of totalPatterns) {
      if (pattern.global) {
        // For global patterns, collect all matches
        const matches = text.matchAll(pattern)
        for (const match of matches) {
          const amount = parsePortugueseNumber(match[1])
          if (amount > 1 && amount < 10000) { // Reasonable range
            foundAmounts.push(amount)
          }
        }
      } else {
        const match = text.match(pattern)
        if (match) {
          const amount = parsePortugueseNumber(match[1])
          if (amount > totalAmount && amount < 10000) {
            totalAmount = amount
          }
        }
      }
    }
    
    // If we found multiple amounts, use the highest reasonable one
    if (foundAmounts.length > 0 && totalAmount === 0) {
      totalAmount = Math.max(...foundAmounts)
    }
    
    console.log(`[RECEIPT-PARSER] Total amount found: €${totalAmount}`)
    if (foundAmounts.length > 0) {
      console.log(`[RECEIPT-PARSER] All amounts found: [${foundAmounts.join(', ')}]`)
    }
    
    // Extract line items - improved patterns for Portuguese invoices
    const items: Array<{
      description: string
      quantity?: number
      unitPrice?: number
      totalPrice: number
    }> = []
    
    const lines = text.split('\n')
    let inItemsSection = false
    let itemsSectionStarted = false
    
    console.log(`[RECEIPT-PARSER] Analyzing ${lines.length} lines for items...`)
    
    for (let i = 0; i < lines.length; i++) {
      const cleanLine = lines[i].trim()
      if (!cleanLine || cleanLine.length < 3) continue
      
      // Detect when we enter the items section
      if (cleanLine.toLowerCase().includes('artigos') ||
          cleanLine.toLowerCase().includes('codigo') ||
          cleanLine.toLowerCase().includes('descricao') ||
          cleanLine.toLowerCase().includes('quant')) {
        inItemsSection = true
        itemsSectionStarted = true
        console.log(`[RECEIPT-PARSER] Entering items section at line ${i}: "${cleanLine}"`)
        continue
      }
      
      // Skip if we haven't found the items section yet
      if (!itemsSectionStarted) {
        continue
      }
      
      // Stop processing if we hit end-of-items indicators
      if (cleanLine.toLowerCase().includes('subtotal') ||
          cleanLine.toLowerCase().includes('total') ||
          cleanLine.toLowerCase().includes('iva') ||
          cleanLine.toLowerCase().includes('desconto') ||
          cleanLine.toLowerCase().includes('forma de pagamento') ||
          cleanLine.toLowerCase().includes('obrigado')) {
        console.log(`[RECEIPT-PARSER] End of items section at line ${i}: "${cleanLine}"`)
        break
      }
      
      // Skip obvious non-product lines
      if (cleanLine.toLowerCase().includes('recibo') ||
          cleanLine.toLowerCase().includes('nif') ||
          cleanLine.toLowerCase().includes('contribuinte') ||
          cleanLine.toLowerCase().includes('morada') ||
          cleanLine.toLowerCase().includes('local') ||
          cleanLine.toLowerCase().includes('data') ||
          cleanLine.toLowerCase().includes('hora') ||
          cleanLine.length < 5) {
        continue
      }
      
      console.log(`[RECEIPT-PARSER] Analyzing line ${i}: "${cleanLine}"`)
      
      // Much more restrictive patterns for actual products
      const itemPatterns = [
        // Format: "DESCRIPTION QUANTITY UNIT_PRICE TOTAL" (Portuguese invoice format)
        /^([A-ZÁÀÂÃÉÊÍÓÔÕÚÇ][A-ZÁÀÂÃÉÊÍÓÔÕÚÇ\s]{2,30})\s+(\d+(?:,\d+)?)\s+([\d,]+)\s+([\d,]+)$/i,
        
        // Format: "CODE DESCRIPTION QUANTITY UNIT_PRICE TOTAL"
        /^\d+\s+([A-ZÁÀÂÃÉÊÍÓÔÕÚÇ][A-ZÁÀÂÃÉÊÍÓÔÕÚÇ\s]{2,30})\s+(\d+(?:,\d+)?)\s+([\d,]+)\s+([\d,]+)$/i,
        
        // Simple format: "DESCRIPTION PRICE" (but only if price is reasonable)
        /^([A-ZÁÀÂÃÉÊÍÓÔÕÚÇ][A-ZÁÀÂÃÉÊÍÓÔÕÚÇ\s]{2,30})\s+([\d,]+)$/i
      ]
      
      let itemFound = false
      
      for (const pattern of itemPatterns) {
        const match = cleanLine.match(pattern)
        if (match) {
          let description: string
          let quantity = 1
          let price: number
          
          if (match.length === 5) {
            // Full format: description + quantity + unit_price + total
            description = match[1].trim()
            quantity = parseFloat(match[2].replace(',', '.')) || 1
            price = parsePortugueseNumber(match[4]) // Use total price
          } else if (match.length === 3) {
            // Simple format: description + price
            description = match[1].trim()
            price = parsePortugueseNumber(match[2])
          } else {
            continue
          }
          
          // Clean up description
          description = description.replace(/[*]/g, '').trim()
          
          // Strict validation for products
          const isValidProduct = (
            description.length >= 3 &&
            description.length <= 50 &&
            /^[A-ZÁÀÂÃÉÊÍÓÔÕÚÇ]/.test(description) && // Must start with letter
            /[A-ZÁÀÂÃÉÊÍÓÔÕÚÇ]/.test(description) && // Must contain at least one letter
            !/^\d+$/.test(description) && // Not just numbers
            !description.toLowerCase().includes('linha') &&
            !description.toLowerCase().includes('codigo') &&
            !description.toLowerCase().includes('carro') &&
            !description.toLowerCase().includes('original') &&
            !description.toLowerCase().includes('barrar') &&
            price > 0.01 && 
            price < 1000 && // Reasonable price range
            !isNaN(price)
          )
          
          if (isValidProduct) {
            items.push({
              description: description,
              quantity: quantity > 1 ? quantity : undefined,
              unitPrice: quantity > 1 ? price / quantity : undefined,
              totalPrice: price
            })
            console.log(`[RECEIPT-PARSER] Valid item found: "${description}" - €${price}`)
            itemFound = true
          } else {
            console.log(`[RECEIPT-PARSER] Invalid item rejected: "${description}" - €${price} (failed validation)`)
          }
          break
        }
      }
      
      if (!itemFound && cleanLine.length > 10 && cleanLine.length < 100) {
        console.log(`[RECEIPT-PARSER] No pattern matched for: "${cleanLine}"`)
      }
    }
    
    console.log(`[RECEIPT-PARSER] Found ${items.length} items, total: €${totalAmount}`)
    
    // Only return if we found meaningful data
    if (items.length > 0 || totalAmount > 0) {
      return {
        store: storeName,
        documentType: 'receipt',
        date: documentDate || new Date().toISOString().split('T')[0],
        totalAmount: totalAmount,
        items: items
      }
    }
    
    return null
    
  } catch (error) {
    console.error('[RECEIPT-PARSER] Error parsing receipt:', error)
    return null
  }
}
