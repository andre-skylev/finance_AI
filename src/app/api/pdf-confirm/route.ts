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

  const { transactions, target, receipts } = await request.json()

  if ((!transactions || !Array.isArray(transactions)) && !(target && String(target).startsWith('rec'))) {
      return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 })
    }
    // Roteamento por destino: conta bancária (acc:ID) ou cartão de crédito (cc:ID)
    if (typeof target === 'string' && target.startsWith('acc:')) {
      const accountId = target.slice(4)
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
          const suggestedLower = String(transaction.suggestedCategory).toLowerCase()
          for (const [catName, catId] of categoryMap.entries()) {
            if (catName.includes(suggestedLower) || suggestedLower.includes(catName)) {
              categoryId = catId
              break
            }
          }
        }

        const amt = parseFloat(transaction.amount)
        return {
          user_id: user.id,
          account_id: accountId,
          amount: amt,
          description: transaction.description,
          category_id: categoryId,
          transaction_date: transaction.date,
          currency: account?.currency || 'EUR',
          type: amt >= 0 ? 'income' : 'expense',
          created_at: new Date().toISOString(),
        }
      })

      const { data: insertedTransactions, error: insertError } = await supabase
        .from('transactions')
        .insert(transactionsToInsert)
        .select()

      if (insertError) {
        console.error('Erro ao inserir transações:', insertError)
        return NextResponse.json({ error: 'Erro ao salvar transações' }, { status: 500 })
      }

      // Salvar recibos vinculados à conta (opcional)
      let receiptsSaved = 0
      if (Array.isArray(receipts) && receipts.length > 0) {
        for (const r of receipts) {
          try {
            // Associar por total e data
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
        message: `${(insertedTransactions as any[]).length} transações adicionadas com sucesso${receiptsSaved ? `, ${receiptsSaved} recibo(s) salvo(s)` : ''}`,
        transactions: insertedTransactions,
        receiptsSaved
      })
    }

    if (typeof target === 'string' && target.startsWith('cc:')) {
      const creditCardId = target.slice(3)
      // Verificar se o cartão pertence ao usuário
      const { data: card, error: cardErr } = await supabase
        .from('credit_cards')
        .select('id, currency, current_balance')
        .eq('id', creditCardId)
        .eq('user_id', user.id)
        .single()
      if (cardErr || !card) {
        return NextResponse.json({ error: 'Cartão não encontrado' }, { status: 404 })
      }

      // Preparar transações de cartão (uso positivo; distinguir compra/pagamento pelo sinal)
      const toInsert = transactions.map((tx: any) => {
        const amtNum = Number(tx.amount)
        const isPurchase = amtNum >= 0
        return {
          user_id: user.id,
          credit_card_id: creditCardId,
          transaction_date: tx.date,
          merchant_name: tx.merchant || tx.description || null,
          description: tx.description || null,
          amount: Math.abs(amtNum),
          currency: card.currency || 'EUR',
          transaction_type: isPurchase ? 'purchase' : 'payment',
          installments: 1,
          installment_number: 1,
        }
      })

      const { data: inserted, error: insErr } = await supabase
        .from('credit_card_transactions')
        .insert(toInsert)
        .select()
      if (insErr) {
        console.error('Erro ao inserir transações de cartão:', insErr)
        return NextResponse.json({ error: 'Erro ao salvar transações' }, { status: 500 })
      }

      // Atualizar saldo do cartão (compras somam; pagamentos subtraem)
  const delta = toInsert.reduce((sum: number, r: any) => sum + (r.transaction_type === 'purchase' ? r.amount : -r.amount), 0 as number)
      const newBalance = (card.current_balance || 0) + delta
      const { error: updErr } = await supabase
        .from('credit_cards')
        .update({ current_balance: newBalance })
        .eq('id', creditCardId)
        .eq('user_id', user.id)
      if (updErr) console.error('Falha ao atualizar saldo do cartão:', updErr)

      return NextResponse.json({
        success: true,
        message: `${(inserted as any[]).length} transações de cartão adicionadas com sucesso`,
        transactions: inserted,
      })
    }

    // Receipts-only mode (no transactions), target === 'rec'
    if (String(target) === 'rec') {
      let receiptsSaved = 0
      if (Array.isArray(receipts) && receipts.length > 0) {
        for (const r of receipts) {
          try {
            const { data: receiptRow, error: recErr } = await supabase
              .from('receipts')
              .insert({
                user_id: user.id,
                account_id: null,
                transaction_id: null,
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
              await supabase.from('receipt_items').insert(itemsToInsert)
            }
            receiptsSaved++
          } catch (e) {
            console.error('Falha ao salvar recibo (rec-only):', e)
          }
        }
      }

      return NextResponse.json({
        success: true,
        message: `${receiptsSaved} recibo(s) salvo(s)`,
        receiptsSaved
      })
    }

    return NextResponse.json({ error: 'Destino inválido' }, { status: 400 })

  } catch (error) {
    console.error('Erro ao confirmar transações:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
