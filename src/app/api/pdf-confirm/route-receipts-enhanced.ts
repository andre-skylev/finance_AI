import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Verificar autenticação
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { transactions, target, receipts, documentType } = await request.json()

    console.log('PDF Confirm - Dados recebidos:', { 
      transactionsCount: transactions?.length, 
      target, 
      receiptsCount: receipts?.length,
      documentType,
      userId: user.id
    })

    // Melhor detecção de receipts
    const isReceiptDocument = (
      String(target) === 'rec' || 
      String(target).startsWith('rec') ||
      documentType === 'receipt' ||
      (Array.isArray(receipts) && receipts.length > 0)
    )

    if (isReceiptDocument) {
      return await processReceiptDocument(supabase, user, transactions, receipts)
    }

    // Restante do código para outros tipos de documentos...
    // [aqui continua o processamento normal para extratos bancários e faturas]
    
  } catch (error) {
    console.error('Erro geral no pdf-confirm:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

/**
 * Processa documentos de recibo/compra focando em salvar apenas dados essenciais
 * sem armazenar imagens - apenas nome, data e total
 */
async function processReceiptDocument(supabase: any, user: any, transactions: any[], receipts: any[]) {
  console.log('📄 Processando documento como RECIBO...')
  
  let receiptsSaved = 0
  let transactionsSaved = 0

  try {
    // 1. Extrair informações essenciais do recibo
    const receiptData = extractReceiptEssentials(transactions, receipts)
    console.log('📋 Dados essenciais extraídos:', receiptData)

    // 2. Salvar recibo principal (apenas dados, sem imagem)
    const { data: savedReceipt, error: receiptError } = await supabase
      .from('receipts')
      .insert({
        user_id: user.id,
        merchant_name: receiptData.merchantName,
        receipt_date: receiptData.date,
        subtotal: receiptData.subtotal,
        tax: receiptData.tax,
        total: receiptData.total,
        currency: receiptData.currency,
        notes: `Recibo processado automaticamente - ${receiptData.itemCount} item(s)`
      })
      .select('id')
      .single()

    if (receiptError) {
      console.error('❌ Erro ao salvar recibo:', receiptError)
      return NextResponse.json({ error: 'Erro ao salvar recibo' }, { status: 500 })
    }

    const receiptId = savedReceipt.id
    receiptsSaved = 1
    console.log('✅ Recibo salvo com ID:', receiptId)

    // 3. Salvar itens do recibo (opcional - apenas se tiver detalhes dos itens)
    if (receiptData.items && receiptData.items.length > 0) {
      await saveReceiptItems(supabase, user.id, receiptId, receiptData.items)
      console.log(`✅ ${receiptData.items.length} itens do recibo salvos`)
    }

    // 4. Criar transação resumo vinculada ao recibo (opcional)
    if (receiptData.shouldCreateTransaction) {
      const { data: linkedTransaction } = await supabase
        .from('transactions')
        .insert({
          user_id: user.id,
          receipt_id: receiptId,
          amount: -Math.abs(receiptData.total), // Despesa
          description: `Compra - ${receiptData.merchantName}`,
          transaction_date: receiptData.date,
          currency: receiptData.currency,
          type: 'expense',
          transaction_type: 'receipt'
        })
        .select('id')
        .single()

      if (linkedTransaction) {
        transactionsSaved = 1
        console.log('✅ Transação vinculada criada:', linkedTransaction.id)
      }
    }

    return NextResponse.json({
      success: true,
      message: `Recibo processado com sucesso! ${receiptsSaved} recibo(s) e ${transactionsSaved} transação(ões) salvos.`,
      receiptId,
      receiptsSaved,
      transactionsSaved,
      data: {
        merchantName: receiptData.merchantName,
        date: receiptData.date,
        total: receiptData.total,
        itemCount: receiptData.itemCount
      }
    })

  } catch (error) {
    console.error('❌ Erro no processamento do recibo:', error)
    return NextResponse.json({ error: 'Erro ao processar recibo' }, { status: 500 })
  }
}

/**
 * Extrai apenas as informações essenciais do recibo
 * Foco: nome do estabelecimento, data, total (sem salvar imagens)
 */
function extractReceiptEssentials(transactions: any[], receipts: any[]) {
  // Priorizar dados dos receipts se disponíveis
  if (Array.isArray(receipts) && receipts.length > 0) {
    const receipt = receipts[0]
    return {
      merchantName: receipt.merchant || receipt.merchantName || 'Estabelecimento',
      date: receipt.date || receipt.receipt_date || new Date().toISOString().split('T')[0],
      subtotal: typeof receipt.subtotal === 'number' ? receipt.subtotal : null,
      tax: typeof receipt.tax === 'number' ? receipt.tax : null,
      total: typeof receipt.total === 'number' ? receipt.total : calculateTotalFromTransactions(transactions),
      currency: receipt.currency || 'EUR',
      items: receipt.items || [],
      itemCount: receipt.items ? receipt.items.length : (transactions ? transactions.length : 0),
      shouldCreateTransaction: true
    }
  }

  // Fallback: extrair de transações
  if (Array.isArray(transactions) && transactions.length > 0) {
    const total = calculateTotalFromTransactions(transactions)
    const firstTransaction = transactions[0]
    
    return {
      merchantName: extractMerchantFromTransactions(transactions),
      date: firstTransaction.date || firstTransaction.transaction_date || new Date().toISOString().split('T')[0],
      subtotal: null,
      tax: null,
      total: total,
      currency: firstTransaction.currency || 'EUR',
      items: transactions.map((tx, index) => ({
        line_no: index + 1,
        description: tx.description || 'Item',
        total: Math.abs(parseFloat(tx.amount))
      })),
      itemCount: transactions.length,
      shouldCreateTransaction: false // Já temos as transações individuais
    }
  }

  // Fallback: dados mínimos
  return {
    merchantName: 'Estabelecimento',
    date: new Date().toISOString().split('T')[0],
    subtotal: null,
    tax: null,
    total: 0,
    currency: 'EUR',
    items: [],
    itemCount: 0,
    shouldCreateTransaction: false
  }
}

function calculateTotalFromTransactions(transactions: any[]): number {
  if (!Array.isArray(transactions)) return 0
  return transactions.reduce((sum, tx) => {
    const amount = parseFloat(tx.amount) || 0
    return sum + Math.abs(amount)
  }, 0)
}

function extractMerchantFromTransactions(transactions: any[]): string {
  if (!Array.isArray(transactions) || transactions.length === 0) return 'Estabelecimento'
  
  // Tentar extrair nome do estabelecimento da primeira transação
  const firstDesc = transactions[0].description || ''
  
  // Lógica simples para extrair nome do estabelecimento
  const words = firstDesc.split(/\s+/).filter((word: string) => word.length > 2)
  if (words.length > 0) {
    return words.slice(0, 3).join(' ') // Primeiras 3 palavras
  }
  
  return 'Estabelecimento'
}

async function saveReceiptItems(supabase: any, userId: string, receiptId: string, items: any[]) {
  if (!Array.isArray(items) || items.length === 0) return

  const itemsToInsert = items.map((item, index) => ({
    user_id: userId,
    receipt_id: receiptId,
    line_no: item.line_no || (index + 1),
    description: String(item.description || 'Item'),
    quantity: typeof item.quantity === 'number' ? item.quantity : 1,
    unit_price: typeof item.unit_price === 'number' ? item.unit_price : null,
    total: typeof item.total === 'number' ? item.total : null,
    sku: item.sku || null
  }))

  const { error } = await supabase
    // receipt_items no longer used in the simplified model - endpoint deprecated
    .insert(itemsToInsert)

  if (error) {
    console.error('❌ Erro ao salvar itens do recibo:', error)
    throw error
  }
}
