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

  const { transactions, target, receipts, currency: sourceCurrencyRaw, documentCurrency } = await request.json()

  // Setup exchange conversion EUR/BRL/USD (today -> latest -> env fallback)
  const todayStr = new Date().toISOString().split('T')[0]
  const { data: todayRate } = await supabase
    .from('exchange_rates')
    .select('*')
    .eq('rate_date', todayStr)
    .maybeSingle()
  let eur_to_brl: number | null = todayRate ? Number(todayRate.eur_to_brl) : null
  let brl_to_eur: number | null = todayRate ? Number(todayRate.brl_to_eur) : null
  let eur_to_usd: number | null = todayRate && todayRate.eur_to_usd != null ? Number(todayRate.eur_to_usd) : null
  let usd_to_eur: number | null = todayRate && todayRate.usd_to_eur != null ? Number(todayRate.usd_to_eur) : (eur_to_usd ? 1/eur_to_usd : null)
  let usd_to_brl: number | null = todayRate && todayRate.usd_to_brl != null ? Number(todayRate.usd_to_brl) : null
  let brl_to_usd: number | null = todayRate && todayRate.brl_to_usd != null ? Number(todayRate.brl_to_usd) : (usd_to_brl ? 1/(usd_to_brl as number) : null)
  if (!eur_to_brl || !brl_to_eur) {
    const { data: latest } = await supabase
      .from('exchange_rates')
      .select('*')
      .order('rate_date', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (latest) {
      eur_to_brl = Number(latest.eur_to_brl)
      brl_to_eur = Number(latest.brl_to_eur)
      eur_to_usd = latest.eur_to_usd != null ? Number(latest.eur_to_usd) : eur_to_usd
      usd_to_eur = latest.usd_to_eur != null ? Number(latest.usd_to_eur) : (eur_to_usd ? 1/(eur_to_usd as number) : usd_to_eur)
      usd_to_brl = latest.usd_to_brl != null ? Number(latest.usd_to_brl) : usd_to_brl
      brl_to_usd = latest.brl_to_usd != null ? Number(latest.brl_to_usd) : (usd_to_brl ? 1/(usd_to_brl as number) : brl_to_usd)
    }
  }
  if (!eur_to_brl || !brl_to_eur) {
    const envEUR = Number(process.env.EXCHANGE_FALLBACK_EUR_TO_BRL)
    if (isFinite(envEUR) && envEUR > 0) {
      eur_to_brl = envEUR
      brl_to_eur = 1 / envEUR
    }
  }

  const sourceCurrency = ((sourceCurrencyRaw || documentCurrency || 'EUR') as string).toUpperCase()
  const convertAmount = (amountAbs: number, from: string, to: string): number => {
    if (!isFinite(amountAbs)) return 0
    if (from === to) return amountAbs
    if (from === 'EUR' && to === 'BRL' && eur_to_brl) return amountAbs * eur_to_brl
    if (from === 'BRL' && to === 'EUR' && brl_to_eur) return amountAbs * brl_to_eur
    if (from === 'EUR' && to === 'USD' && (eur_to_usd || usd_to_eur)) return amountAbs * (eur_to_usd ?? (1/(usd_to_eur as number)))
    if (from === 'USD' && to === 'EUR' && (usd_to_eur || eur_to_usd)) return amountAbs * (usd_to_eur ?? (1/(eur_to_usd as number)))
    if (from === 'USD' && to === 'BRL') {
      const rate = usd_to_brl ?? ((eur_to_brl && eur_to_usd) ? (eur_to_brl / eur_to_usd) : null)
      if (rate) return amountAbs * rate
    }
    if (from === 'BRL' && to === 'USD') {
      const rate = brl_to_usd ?? (usd_to_brl ? 1/(usd_to_brl as number) : ((brl_to_eur && usd_to_eur) ? (brl_to_eur * (usd_to_eur as number)) : null))
      if (rate) return amountAbs * rate
    }
    return amountAbs
  }

  console.log('PDF Confirm - Dados recebidos:', { 
    transactionsCount: transactions?.length, 
    target, 
    receiptsCount: receipts?.length,
    userId: user.id
  })
  console.log('PDF Confirm - Transações:', JSON.stringify(transactions, null, 2))

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

      // Buscar categorias para mapear (inclui tipo para criação correta)
      const { data: categories } = await supabase
        .from('categories')
        .select('id, name, type, is_default')

      console.log('PDF Confirm - Categorias encontradas:', categories?.length)
  const categoryMap = new Map(categories?.map(cat => [cat.name.toLowerCase(), { id: cat.id, type: cat.type, is_default: cat.is_default }]) || [])
      console.log('PDF Confirm - Mapa de categorias:', Array.from(categoryMap.entries()))

      // Caso tenha exatamente 1 recibo, cria primeiro e usa o receipt_id em TODAS as transações
      let precreatedReceiptId: string | null = null
      if (Array.isArray(receipts) && receipts.length === 1) {
        const r = receipts[0]
        const accountCurrency = (account?.currency || 'EUR').toUpperCase()
        const storedCurrency = (sourceCurrency || accountCurrency).toUpperCase()
        const rSubtotal = typeof r.subtotal === 'number' ? Math.abs(Number(r.subtotal)) : null
        const rTax = typeof r.tax === 'number' ? Math.abs(Number(r.tax)) : null
        const rTotal = typeof r.total === 'number' ? Math.abs(Number(r.total)) : null
        const { data: receiptRow, error: recErr } = await supabase
          .from('receipts')
          .insert({
            user_id: user.id,
            account_id: accountId,
            merchant_name: r.merchant || 'Estabelecimento',
            receipt_date: r.date || new Date().toISOString().split('T')[0],
            subtotal: rSubtotal,
            tax: rTax,
            total: rTotal,
            currency: storedCurrency,
            created_at: new Date().toISOString(),
          })
          .select('id')
          .single()

        if (!recErr && receiptRow?.id) {
          precreatedReceiptId = receiptRow.id
          console.log('PDF Confirm - Recibo pré-criado para vincular transações:', precreatedReceiptId)
        } else {
          console.warn('PDF Confirm - Falha ao pré-criar recibo único:', recErr)
        }
      }

      // Preparar transações para inserção (apenas tabela bank_account_transactions)
  const transactionsToInsert: any[] = []
  for (const transaction of transactions as any[]) {
        // Mapear categoria sugerida para ID; criar se não existir
  let categoryId: string | null = null
        if (transaction.suggestedCategory) {
          const suggestedLower = String(transaction.suggestedCategory).toLowerCase()
          console.log('PDF Confirm - Procurando categoria:', suggestedLower)
          
          // Busca exata primeiro
          if (categoryMap.has(suggestedLower)) {
            categoryId = categoryMap.get(suggestedLower)!.id
            console.log('PDF Confirm - Categoria encontrada (exata):', categoryId)
          } else {
            // Busca parcial
            let parentKey: string | null = null
            for (const [catName, catInfo] of categoryMap.entries()) {
              if (catName.includes(suggestedLower) || suggestedLower.includes(catName)) {
                categoryId = catInfo.id
                console.log('PDF Confirm - Categoria encontrada (parcial):', catName, '->', categoryId)
                break
              }
              // Detect parent like "supermercado - higiene e limpeza": capture before hyphen
              if (!parentKey && suggestedLower.includes(catName) && /\s-\s/.test(String(transaction.suggestedCategory))) {
                parentKey = catName
              }
            }
            // Se não encontrou, criar categoria nova do tipo correto (por padrão 'expense')
            if (!categoryId) {
              const isIncome = Number(transaction.amount) >= 0
              const parent = parentKey ? categoryMap.get(parentKey) : null
              const newName = String(transaction.suggestedCategory).trim()
              const newType = isIncome ? 'income' : 'expense'
              // Handle subcategory syntax: "Parent - Child"
              let parentId: string | null = null
              const split = newName.split(' - ')
              if (split.length >= 2) {
                const parentName = split[0].trim().toLowerCase()
                const childName = split.slice(1).join(' - ').trim()
                // Ensure parent exists or create it
                if (categoryMap.has(parentName)) {
                  parentId = categoryMap.get(parentName)!.id
                } else {
                  const { data: createdParent, error: parentErr } = await supabase
                    .from('categories')
                    .insert({ user_id: user.id, name: split[0].trim(), type: newType, is_default: false, color: '#6b7280' })
                    .select('id')
                    .single()
                  if (!parentErr && createdParent?.id) {
                    parentId = createdParent.id
                    categoryMap.set(parentName, { id: parentId, type: newType, is_default: false })
                  }
                }
                // Create child with parent_id
                const { data: created, error: catErr } = await supabase
                  .from('categories')
                  .insert({
                    user_id: user.id,
                    name: childName,
                    type: newType,
                    is_default: false,
                    color: '#6b7280',
                    parent_id: parentId
                  })
                  .select('id')
                  .single()
                if (!catErr && created?.id) {
                  categoryId = created.id
                  categoryMap.set(childName.toLowerCase(), { id: created.id, type: newType, is_default: false })
                  console.log('PDF Confirm - Subcategoria criada:', childName, '->', categoryId, 'parent', parentId)
                } else {
                  console.warn('PDF Confirm - Falha ao criar subcategoria:', catErr)
                }
              } else {
                // Create as a top-level category
                const { data: created, error: catErr } = await supabase
                .from('categories')
                .insert({
                  user_id: user.id,
                  name: newName,
                  type: newType,
                  is_default: false,
                  color: '#6b7280'
                })
                .select('id')
                  .single()
                if (!catErr && created?.id) {
                  categoryId = created.id
                  // Atualiza cache em memória
                  categoryMap.set(newName.toLowerCase(), { id: created.id, type: newType, is_default: false })
                  console.log('PDF Confirm - Categoria criada:', newName, '->', categoryId)
                } else {
                  console.warn('PDF Confirm - Falha ao criar categoria sugerida:', catErr)
                }
              }
            }
          }
          
          if (!categoryId) {
            console.log('PDF Confirm - Categoria não encontrada para:', suggestedLower)
          }
        }

        const amt = parseFloat(transaction.amount)
        const isCredit = amt >= 0
        const accountCurrency = (account?.currency || 'EUR').toUpperCase()
        const convertedAbs = convertAmount(Math.abs(amt), sourceCurrency, accountCurrency)
        transactionsToInsert.push({
          user_id: user.id,
          account_id: accountId,
          transaction_date: transaction.date,
          merchant_name: transaction.merchant || null,
          category_id: categoryId,
          amount: convertedAbs,
          currency: accountCurrency,
          transaction_type: isCredit ? 'credit' : 'debit',
          description: transaction.description || '',
          created_at: new Date().toISOString(),
          receipt_id: precreatedReceiptId,
        })
      }

      console.log('PDF Confirm - Transações preparadas para inserção:', JSON.stringify(transactionsToInsert, null, 2))

      // Salvar em bank_account_transactions (modelo consolidado)
      const { data: insertedTransactions, error: insertError } = await supabase
        .from('bank_account_transactions')
        .insert(transactionsToInsert)
        .select()

      console.log('PDF Confirm - Resultado da inserção em transactions:', { insertedTransactions, insertError })

      if (insertError) {
        console.error('Erro ao inserir transações:', insertError)
        return NextResponse.json({ error: 'Erro ao salvar transações' }, { status: 500 })
      }

  // Salvar recibos vinculados à conta - se houver 1 recibo pré-criado acima, pular reinserção
      let receiptsSaved = 0
      let receiptId = null
      
  if (Array.isArray(receipts) && receipts.length > 0 && !precreatedReceiptId) {
        for (const r of receipts) {
          try {
            console.log('PDF Confirm - Salvando recibo:', r)
            
            // Associar por total e data
            let matchedTxId: string | null = null
            if (Array.isArray(insertedTransactions) && typeof r.total === 'number') {
              const sameDay = (a?: string, b?: string) => {
                if (!a || !b) return false
                const da = new Date(a).toISOString().slice(0,10)
                const db = new Date(b).toISOString().slice(0,10)
                return da === db
              }
              const accountCurrency = (account?.currency || 'EUR').toUpperCase()
              const rTotal = convertAmount(Math.abs(Number(r.total)), sourceCurrency, accountCurrency)
              // First try exact match by amount and same day
              let found = (insertedTransactions as any[]).find((tx: any) => {
                const amtEqual = Math.abs(Number(tx.amount)) === Math.abs(Number(rTotal))
                const dateEqual = sameDay(tx.transaction_date, r.date)
                return amtEqual && dateEqual
              })
              // Then try tolerance match (cent-level) on same day
              if (!found) {
                const tol = 0.01
                found = (insertedTransactions as any[]).find((tx: any) => {
                  const dateEqual = sameDay(tx.transaction_date, r.date)
                  const diff = Math.abs(Math.abs(Number(tx.amount)) - Math.abs(Number(rTotal)))
                  return dateEqual && diff <= tol
                })
              }
              matchedTxId = found?.id || null
              console.log('PDF Confirm - Transação correspondente encontrada:', matchedTxId)
            }

      // Persist receipt in original document currency
      const accountCurrency = (account?.currency || 'EUR').toUpperCase()
      const storedCurrency = (sourceCurrency || accountCurrency).toUpperCase()
      const convertedSubtotal = typeof r.subtotal === 'number' ? Math.abs(Number(r.subtotal)) : null
      const convertedTax = typeof r.tax === 'number' ? Math.abs(Number(r.tax)) : null
      const convertedTotal = typeof r.total === 'number' ? Math.abs(Number(r.total)) : null

            const { data: receiptRow, error: recErr } = await supabase
              .from('receipts')
              .insert({
                user_id: user.id,
                account_id: accountId,
                merchant_name: r.merchant || 'Estabelecimento',
                receipt_date: r.date || new Date().toISOString().split('T')[0],
                subtotal: convertedSubtotal,
                tax: convertedTax,
                total: convertedTotal,
        currency: storedCurrency,
                created_at: new Date().toISOString(),
              })
              .select()
              .single()

            console.log('PDF Confirm - Resultado inserção recibo:', { receiptRow, recErr })

            if (!recErr && receiptRow?.id) {
              receiptId = receiptRow.id
              // Atualizar a transação correspondente para vincular o recibo
              if (matchedTxId) {
                await supabase
                  .from('bank_account_transactions')
                  .update({ receipt_id: receiptRow.id })
                  .eq('id', matchedTxId)
                  .eq('user_id', user.id)
              }
            }
            receiptsSaved++
          } catch (e) {
            console.error('Falha ao salvar recibo:', e)
          }
        }
      }

      // Se recibo foi pré-criado, marcar como salvo e repassar id para resposta
      if (precreatedReceiptId) {
        receiptsSaved = 1
        receiptId = precreatedReceiptId
      }

      return NextResponse.json({
        success: true,
        message: `✅ ${(insertedTransactions as any[]).length} transação(ões) adicionada(s) à conta com sucesso!${receiptsSaved ? ` 🧾 ${receiptsSaved} recibo(s) salvo(s) - veja na página de Recibos.` : ''}`,
        transactions: insertedTransactions,
        receiptsSaved,
        receiptId
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

      // Caso tenha exatamente 1 recibo, cria primeiro e usa o receipt_id em TODAS as transações de cartão
      let precreatedReceiptId: string | null = null
      if (Array.isArray(receipts) && receipts.length === 1) {
        const r = receipts[0]
        const cardCurrency = (card.currency || 'EUR').toUpperCase()
        const storedCurrency = (sourceCurrency || cardCurrency).toUpperCase()
        const rSubtotal = typeof r.subtotal === 'number' ? Math.abs(Number(r.subtotal)) : null
        const rTax = typeof r.tax === 'number' ? Math.abs(Number(r.tax)) : null
        const rTotal = typeof r.total === 'number' ? Math.abs(Number(r.total)) : null
        const { data: receiptRow, error: recErr } = await supabase
          .from('receipts')
          .insert({
            user_id: user.id,
            // Sem account_id para recibo de cartão
            merchant_name: r.merchant || 'Estabelecimento',
            receipt_date: r.date || new Date().toISOString().split('T')[0],
            subtotal: rSubtotal,
            tax: rTax,
            total: rTotal,
            currency: storedCurrency,
            created_at: new Date().toISOString(),
          })
          .select('id')
          .single()

        if (!recErr && receiptRow?.id) {
          precreatedReceiptId = receiptRow.id
          console.log('PDF Confirm - Recibo de cartão pré-criado:', precreatedReceiptId)
        } else {
          console.warn('PDF Confirm - Falha ao pré-criar recibo único (cartão):', recErr)
        }
      }

  // Preparar transações de cartão (distinguir compra/pagamento pelo sinal)
      const toInsert = transactions.map((tx: any) => {
        const amtNum = Number(tx.amount)
        // Para cartões, montantes negativos geralmente representam compras (débito)
        // e montantes positivos representam pagamentos/estornos (crédito)
        const isPurchase = amtNum <= 0
        const cardCurrency = (card.currency || 'EUR').toUpperCase()
        const convertedAbs = convertAmount(Math.abs(amtNum), sourceCurrency, cardCurrency)
        return {
          user_id: user.id,
          credit_card_id: creditCardId,
          transaction_date: tx.date,
          merchant_name: tx.merchant || tx.description || null,
          description: tx.description || null,
          amount: convertedAbs,
          currency: cardCurrency,
          transaction_type: isPurchase ? 'purchase' : 'payment',
          installments: 1,
          installment_number: 1,
          receipt_id: precreatedReceiptId,
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

      // Salvar recibos e vincular por matching quando houver múltiplos recibos
      let receiptsSaved = 0
  if (Array.isArray(receipts) && receipts.length > 0 && !precreatedReceiptId) {
        for (const r of receipts) {
          try {
    const cardCurrency = (card.currency || 'EUR').toUpperCase()
    const storedCurrency = (sourceCurrency || cardCurrency).toUpperCase()
    const rSubtotal = typeof r.subtotal === 'number' ? Math.abs(Number(r.subtotal)) : null
    const rTax = typeof r.tax === 'number' ? Math.abs(Number(r.tax)) : null
    const rTotal = typeof r.total === 'number' ? Math.abs(Number(r.total)) : null

            // Tentar achar transação correspondente por valor e mesma data
            const sameDay = (a?: string, b?: string) => {
              if (!a || !b) return false
              const da = new Date(a).toISOString().slice(0,10)
              const db = new Date(b).toISOString().slice(0,10)
              return da === db
            }
            let matchedTxId: string | null = null
            if (Array.isArray(inserted) && typeof rTotal === 'number') {
              let found = (inserted as any[]).find((tx: any) => {
                const amtEqual = Math.abs(Number(tx.amount)) === Math.abs(Number(rTotal))
                const dateEqual = sameDay(tx.transaction_date, r.date)
                return amtEqual && dateEqual
              })
              if (!found) {
                const tol = 0.01
                found = (inserted as any[]).find((tx: any) => {
                  const dateEqual = sameDay(tx.transaction_date, r.date)
                  const diff = Math.abs(Math.abs(Number(tx.amount)) - Math.abs(Number(rTotal)))
                  return dateEqual && diff <= tol
                })
              }
              matchedTxId = found?.id || null
            }

            const { data: receiptRow, error: recErr } = await supabase
              .from('receipts')
              .insert({
                user_id: user.id,
                merchant_name: r.merchant || 'Estabelecimento',
                receipt_date: r.date || new Date().toISOString().split('T')[0],
                subtotal: rSubtotal,
                tax: rTax,
                total: rTotal,
                currency: storedCurrency,
                created_at: new Date().toISOString(),
              })
              .select('id')
              .single()

            if (!recErr && receiptRow?.id && matchedTxId) {
              await supabase
                .from('credit_card_transactions')
                .update({ receipt_id: receiptRow.id })
                .eq('id', matchedTxId)
                .eq('user_id', user.id)
            }
            if (!recErr && receiptRow?.id) receiptsSaved++
          } catch (e) {
            console.error('Falha ao salvar recibo (cartão):', e)
          }
        }
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
        message: `${(inserted as any[]).length} transações de cartão adicionadas com sucesso${precreatedReceiptId ? ' 🧾 1 recibo salvo' : receiptsSaved ? ` 🧾 ${receiptsSaved} recibo(s) salvo(s)` : ''}`,
        transactions: inserted,
        receiptsSaved: precreatedReceiptId ? 1 : (receiptsSaved || 0),
        receiptId: precreatedReceiptId || undefined,
      })
    }

  // Receipts mode, target === 'rec'
  // Salva o recibo e cria transações em bank_account_transactions (vinculadas por receipt_id)
    if (String(target) === 'rec') {
      let receiptsSaved = 0
      let transactionsSaved = 0
      
      // Primeiro, criar uma conta padrão se o usuário não tiver nenhuma
      let defaultAccountId = null
        const { data: userAccounts } = await supabase
        .from('accounts')
          .select('id, name, currency')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true })
        .limit(1)
        
      if (userAccounts && userAccounts.length > 0) {
        defaultAccountId = userAccounts[0].id
        console.log('PDF Confirm - Usando conta existente:', userAccounts[0].name)
      } else {
        // Criar conta padrão para recibos
    const { data: newAccount, error: accountError } = await supabase
          .from('accounts')
          .insert({
            user_id: user.id,
      name: 'Conta Principal',
            account_type: 'checking',
            currency: 'EUR',
            balance: 0
          })
          .select('id')
          .single()
          
        if (!accountError && newAccount) {
          defaultAccountId = newAccount.id
          console.log('PDF Confirm - Conta criada automaticamente para recibos')
        }
      }
      
      // Salvar transações de recibos como transações de conta bancária
      if (Array.isArray(transactions) && transactions.length > 0 && defaultAccountId) {
        // Primeiro, salvar o recibo se houver dados
        let receiptHeaderId = null
        if (Array.isArray(receipts) && receipts.length > 0) {
          const firstReceipt = receipts[0]
      const accCurrency = (userAccounts?.[0]?.currency || 'EUR').toUpperCase()
      const storedCurrency = (sourceCurrency || accCurrency).toUpperCase()
      const rSubtotal = typeof firstReceipt.subtotal === 'number' ? Math.abs(Number(firstReceipt.subtotal)) : null
      const rTax = typeof firstReceipt.tax === 'number' ? Math.abs(Number(firstReceipt.tax)) : null
      const rTotal = typeof firstReceipt.total === 'number' ? Math.abs(Number(firstReceipt.total)) : null
      const { data: receiptRow, error: recErr } = await supabase
            .from('receipts')
            .insert({
              user_id: user.id,
              account_id: defaultAccountId,
              merchant_name: firstReceipt.merchant || 'Estabelecimento',
              receipt_date: firstReceipt.date || new Date().toISOString().split('T')[0],
        subtotal: rSubtotal,
        tax: rTax,
        total: rTotal,
        currency: storedCurrency,
            })
            .select('id')
            .single()
            
          if (!recErr && receiptRow) {
            receiptHeaderId = receiptRow.id
            receiptsSaved = 1
            console.log('PDF Confirm - Recibo header criado:', receiptHeaderId)
          }
        }
        
        // Buscar categorias para mapear e criar faltantes
        const { data: categories } = await supabase
          .from('categories')
          .select('id, name, type, is_default')

        const categoryMap = new Map(categories?.map(cat => [cat.name.toLowerCase(), { id: cat.id, type: cat.type, is_default: cat.is_default }]) || [])
        
        const transactionsToInsert: any[] = []
        for (const transaction of transactions as any[]) {
          let categoryId: string | null = null
          
          if (transaction.suggestedCategory) {
            const suggestedLower = String(transaction.suggestedCategory).toLowerCase()
            categoryId = categoryMap.get(suggestedLower)?.id || null
            
            // Busca parcial se não encontrar exata
            if (!categoryId) {
              let parentKey: string | null = null
              for (const [catName, catInfo] of categoryMap.entries()) {
                if (catName.includes(suggestedLower) || suggestedLower.includes(catName)) {
                  categoryId = catInfo.id
                  break
                }
                if (!parentKey && suggestedLower.includes(catName) && /\s-\s/.test(String(transaction.suggestedCategory))) {
                  parentKey = catName
                }
              }
              // Criar se continuar não encontrada
              if (!categoryId) {
                const isIncome = Number(transaction.amount) >= 0
                const newName = String(transaction.suggestedCategory).trim()
                const newType = isIncome ? 'income' : 'expense'
                const { data: created, error: catErr } = await supabase
                  .from('categories')
                  .insert({
                    user_id: user.id,
                    name: newName,
                    type: newType,
                    is_default: false,
                    color: '#6b7280'
                  })
                  .select('id')
                  .single()
                if (!catErr && created?.id) {
                  categoryId = created.id
                  categoryMap.set(newName.toLowerCase(), { id: created.id, type: newType, is_default: false })
                } else {
                  console.warn('PDF Confirm - Falha ao criar categoria sugerida (rec mode):', catErr)
                }
              }
            }
          }

          const amt = parseFloat(transaction.amount)
          const isCredit = amt >= 0
          const accCurrency = (userAccounts?.[0]?.currency || 'EUR').toUpperCase()
          const convertedAbs = convertAmount(Math.abs(amt), sourceCurrency, accCurrency)
          transactionsToInsert.push({
            user_id: user.id,
            account_id: defaultAccountId,
            transaction_date: transaction.date,
            merchant_name: transaction.merchant || null,
            category_id: categoryId,
            amount: convertedAbs,
            currency: accCurrency,
            transaction_type: isCredit ? 'credit' : 'debit',
            description: transaction.description || '',
            created_at: new Date().toISOString(),
            receipt_id: receiptHeaderId || null, // Vincular ao recibo se houver
          })
        }

        const { data: insertedTransactions, error: insertError } = await supabase
          .from('bank_account_transactions')
          .insert(transactionsToInsert)
          .select()

        if (!insertError && insertedTransactions) {
          transactionsSaved = insertedTransactions.length
          console.log('PDF Confirm - Transações de recibo salvas:', transactionsSaved)

        }
      }

      return NextResponse.json({
        success: true,
        message: `✅ Recibo processado! ${receiptsSaved} recibo(s) salvo(s) na página de recibos. ${transactionsSaved} transação(ões) vinculada(s).`,
        transactionsSaved,
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