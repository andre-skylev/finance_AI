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

  const { transactions, accountId, receipts } = await request.json()

    if (!transactions || !Array.isArray(transactions) || !accountId) {
      return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 })
    }

    // Verificar se a conta pertence ao usuário
    const { data: account, error: accountError } = await supabase
      .from('accounts')
      .select('id, name, currency')
      .eq('id', accountId)
      .eq('user_id', user.id)
      .single()

    if (accountError || !account) {
      return NextResponse.json({ error: 'Conta não encontrada' }, { status: 404 })
    }

    // Buscar categorias para mapear
    const { data: categories } = await supabase
      .from('categories')
      .select('id, name')

    const categoryMap = new Map(categories?.map(cat => [cat.name.toLowerCase(), cat.id]) || [])

  // Preparar transações para inserção
    const transactionsToInsert = transactions.map((transaction: any) => {
      // Mapear categoria sugerida para ID
      let categoryId = null
      if (transaction.suggestedCategory) {
        const suggestedLower = transaction.suggestedCategory.toLowerCase()
        // Buscar categoria exata ou similar
        for (const [catName, catId] of categoryMap.entries()) {
          if (catName.includes(suggestedLower) || suggestedLower.includes(catName)) {
            categoryId = catId
            break
          }
        }
      }

      return {
        user_id: user.id,
        account_id: accountId,
        amount: parseFloat(transaction.amount),
        description: transaction.description,
        category_id: categoryId,
        transaction_date: transaction.date,
        currency: account?.currency || 'EUR',
        type: parseFloat(transaction.amount) >= 0 ? 'income' : 'expense',
        created_at: new Date().toISOString(),
      }
    })

    // Inserir transações no banco
  const { data: insertedTransactions, error: insertError } = await supabase
      .from('transactions')
      .insert(transactionsToInsert)
      .select()

    if (insertError) {
      console.error('Erro ao inserir transações:', insertError)
      return NextResponse.json({ error: 'Erro ao salvar transações' }, { status: 500 })
    }

    // Opcional: salvar recibos e itens (quando disponíveis)
    let receiptsSaved = 0
    if (Array.isArray(receipts) && receipts.length > 0) {
      for (const r of receipts) {
        try {
          // Tentativa de associar ao lançamento correspondente (por total e data)
          let matchedTxId: string | null = null
          if (Array.isArray(insertedTransactions) && typeof r.total === 'number') {
            const sameDay = (a?: string, b?: string) => {
              if (!a || !b) return false
              const da = new Date(a).toISOString().slice(0,10)
              const db = new Date(b).toISOString().slice(0,10)
              return da === db
            }
            const found = insertedTransactions.find((tx: any) => {
              const amtEqual = Number(tx.amount) === Number(r.total)
              const dateEqual = sameDay(tx.date || tx.transaction_date, r.date)
              return amtEqual && dateEqual
            })
            matchedTxId = found?.id || null
          }

          const { data: receiptRow, error: recErr } = await supabase
            .from('receipts')
            .insert({
              user_id: user.id,
              account_id: accountId,
              transaction_id: matchedTxId,
              merchant_name: r.merchant || null,
              receipt_date: r.date || null,
              subtotal: typeof r.subtotal === 'number' ? r.subtotal : null,
              tax: typeof r.tax === 'number' ? r.tax : null,
              total: typeof r.total === 'number' ? r.total : null,
            })
            .select('id')
            .single()

          if (!recErr && receiptRow?.id && Array.isArray(r.items)) {
            const itemsToInsert = r.items.map((it: any, index: number) => ({
              user_id: user.id,
              receipt_id: receiptRow.id,
              line_no: index + 1,
              description: String(it.description || 'Item'),
              quantity: typeof it.quantity === 'number' ? it.quantity : null,
              unit_price: typeof it.unitPrice === 'number' ? it.unitPrice : null,
              tax_rate: typeof it.taxRate === 'number' ? it.taxRate : null,
              tax_amount: typeof it.taxAmount === 'number' ? it.taxAmount : null,
              total: typeof it.total === 'number' ? it.total : null,
              sku: it.code ? String(it.code) : null,
            }))
            const { error: itemsErr } = await supabase
              .from('receipt_items')
              .insert(itemsToInsert)
            if (itemsErr) console.error('Erro ao inserir itens do recibo:', itemsErr)
          }
          receiptsSaved++
        } catch (e) {
          console.error('Falha ao salvar recibo:', e)
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: `${insertedTransactions.length} transações adicionadas com sucesso${receiptsSaved ? `, ${receiptsSaved} recibo(s) salvo(s)` : ''}`,
      transactions: insertedTransactions,
      receiptsSaved
    })

  } catch (error) {
    console.error('Erro ao confirmar transações:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
