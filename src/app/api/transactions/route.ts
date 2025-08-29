import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Get authenticated user
    const { data: { user }, error: userError } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')
    const account_id = searchParams.get('account_id')
    const category_id = searchParams.get('category_id')
    const type = searchParams.get('type') // 'income' | 'expense'

    // We'll fetch from both sources, merge, sort desc by date+created_at, then paginate
    const take = Math.max(0, offset) + Math.max(1, limit)

    // Bank account transactions
  let bankQuery = supabase
      .from('bank_account_transactions')
      .select(`
        id,
        account_id,
        category_id,
        amount,
        currency,
        description,
    merchant_name,
        transaction_date,
        transaction_type,
        created_at,
        category:categories(name, color, id),
        account:accounts(name, bank_name)
      `)
      .eq('user_id', user.id)
      .order('transaction_date', { ascending: false })
      .order('created_at', { ascending: false })
      .range(0, take - 1)

    if (account_id) bankQuery = bankQuery.eq('account_id', account_id)
    if (category_id) bankQuery = bankQuery.eq('category_id', category_id)
    if (type) {
      const tt = type === 'income' ? 'credit' : type === 'expense' ? 'debit' : undefined
      if (tt) bankQuery = bankQuery.eq('transaction_type', tt)
    }

    // Credit card transactions
  let cardQuery = supabase
      .from('credit_card_transactions')
      .select(`
        id,
        credit_card_id,
        category_id,
        amount,
        currency,
        description,
    merchant_name,
        transaction_date,
        transaction_type,
        created_at,
        category:categories(name, color, id),
        card:credit_cards(card_name, bank_name)
      `)
      .eq('user_id', user.id)
      .order('transaction_date', { ascending: false })
      .order('created_at', { ascending: false })
      .range(0, take - 1)

    if (account_id) cardQuery = cardQuery.eq('credit_card_id', account_id)
    if (category_id) cardQuery = cardQuery.eq('category_id', category_id)
    if (type) {
      // For cards, treat only 'payment' as income; others as expense
      if (type === 'income') cardQuery = cardQuery.eq('transaction_type', 'payment')
      else if (type === 'expense') cardQuery = cardQuery.neq('transaction_type', 'payment')
    }

    const [bankRes, cardRes] = await Promise.all([bankQuery, cardQuery])

    const bankError = bankRes.error
    const cardError = cardRes.error
    if (bankError) console.warn('Bank transactions fetch warning:', bankError)
    if (cardError) console.warn('Card transactions fetch warning:', cardError)
    if (bankError && cardError) {
      return NextResponse.json({ error: 'Failed to fetch transactions' }, { status: 500 })
    }

    const bankRows = (bankRes.data || []).map((r: any) => ({ ...r }))
    const cardRows = ((cardRes.data || []) as any[]).map((r: any) => ({
      // Normalize credit card fields to look like account/account_name
      id: r.id,
      account_id: r.credit_card_id, // reuse field name for filtering/compat
      category_id: r.category_id,
      amount: r.amount,
      currency: r.currency,
      description: r.description ?? r.merchant_name ?? '',
      transaction_date: r.transaction_date,
      transaction_type: r.transaction_type,
      created_at: r.created_at,
      category: r.category,
      account: { name: r.card?.card_name ?? 'Credit Card', bank_name: r.card?.bank_name ?? '' },
      __source: 'credit_card'
    }))

    const merged = [
      ...bankRows.map((r: any) => ({ ...r, __source: 'bank' })),
      ...cardRows,
    ]

    // Sort by date desc then created_at desc
    merged.sort((a: any, b: any) => {
      const da = new Date(a.transaction_date).getTime()
      const db = new Date(b.transaction_date).getTime()
      if (db !== da) return db - da
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    })

    const page = merged.slice(offset, offset + limit)

  const transactions = page.map((r: any) => {
      let ttype: 'income' | 'expense'
      if (r.__source === 'bank') {
        ttype = r.transaction_type === 'credit' ? 'income' : 'expense'
      } else {
        // credit card
        ttype = r.transaction_type === 'payment' ? 'income' : 'expense'
      }
      return {
        id: r.id,
    amount: Math.abs(parseFloat(r.amount)),
        currency: r.currency,
    description: r.description ?? r.merchant_name ?? '',
        transaction_date: r.transaction_date,
        type: ttype,
        category: r.category ? { name: r.category.name, color: r.category.color } : null,
        account: r.account ? { name: r.account.name, bank_name: r.account.bank_name } : null,
      }
    })

    return NextResponse.json({ transactions })
  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
  const supabase = await createClient()
    
    // Get authenticated user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
  const { 
      account_id, 
      category_id, 
      amount, 
      currency, 
      description, 
      transaction_date, 
      type,
      tags = []
    } = body

    // Validate required fields
    if (!account_id || !amount || !currency || !description || !transaction_date || !type) {
      return NextResponse.json(
        { error: 'Missing required fields' }, 
        { status: 400 }
      )
    }

    // Validate account belongs to user
    const { data: account, error: accountError } = await supabase
  .from('accounts')
      .select('id')
      .eq('id', account_id)
      .eq('user_id', user.id)
      .single()

    if (accountError || !account) {
      return NextResponse.json({ error: 'Invalid account' }, { status: 400 })
    }

    // If category is provided, validate it belongs to user or is a default
    if (category_id) {
      const { data: category, error: categoryError } = await supabase
        .from('categories')
        .select('id')
        .eq('id', category_id)
        .or(`user_id.eq.${user.id},is_default.eq.true`)
        .single()

      if (categoryError || !category) {
        return NextResponse.json({ error: 'Invalid category' }, { status: 400 })
      }
    }

    // Create transaction
    const isIncome = type === 'income'
    const { data: inserted, error } = await supabase
      .from('bank_account_transactions')
      .insert({
        user_id: user.id,
        account_id,
        category_id: category_id || null,
        amount: Math.abs(parseFloat(amount)),
        currency,
        description,
        transaction_date,
        transaction_type: isIncome ? 'credit' : 'debit',
        tags
      })
      .select(`
        id,
        account_id,
        category_id,
        amount,
        currency,
        description,
        transaction_date,
        transaction_type,
        created_at,
        category:categories(name, color),
        account:accounts(name, bank_name)
      `)
      .single()

    if (error) {
      console.error('Error creating transaction:', error)
      return NextResponse.json({ error: 'Failed to create transaction' }, { status: 500 })
    }

  const transaction = inserted ? { ...inserted, type: isIncome ? 'income' : 'expense' } : null
  return NextResponse.json({ transaction }, { status: 201 })
  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
  const supabase = await createClient()
    
    // Get authenticated user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { 
      id,
      account_id, 
      category_id, 
      amount, 
      currency, 
      description, 
      transaction_date, 
      type,
      tags
    } = body

    if (!id) {
      return NextResponse.json({ error: 'Transaction ID is required' }, { status: 400 })
    }

    // Update transaction
    // Build partial update object only with provided fields
    const updateData: any = {}
    if (account_id !== undefined) updateData.account_id = account_id
    if (category_id !== undefined) updateData.category_id = category_id || null
    if (amount !== undefined) updateData.amount = parseFloat(amount)
    if (currency !== undefined) updateData.currency = currency
    if (description !== undefined) updateData.description = description
    if (transaction_date !== undefined) updateData.transaction_date = transaction_date
    if (type !== undefined) updateData.type = type
    if (tags !== undefined) updateData.tags = tags

    // If updating category, validate it belongs to user or is default
    if (category_id !== undefined && category_id !== null && category_id !== '') {
      const { data: category, error: categoryError } = await supabase
        .from('categories')
        .select('id')
        .eq('id', category_id)
        .or(`user_id.eq.${user.id},is_default.eq.true`)
        .single()

      if (categoryError || !category) {
        return NextResponse.json({ error: 'Invalid category' }, { status: 400 })
      }
    }

    // Map to new schema
    if (type !== undefined) {
      (updateData as any).transaction_type = type === 'income' ? 'credit' : 'debit'
      delete (updateData as any).type
    }
    if (updateData.amount !== undefined) updateData.amount = Math.abs(parseFloat(updateData.amount))

    const { data: updated, error } = await supabase
      .from('bank_account_transactions')
      .update(updateData)
      .eq('id', id)
      .eq('user_id', user.id)
      .select(`
        id,
        account_id,
        category_id,
        amount,
        currency,
        description,
        transaction_date,
        transaction_type,
        created_at,
        category:categories(name, color),
        account:accounts(name, bank_name)
      `)
      .single()

    if (error) {
      console.error('Error updating transaction:', error)
      return NextResponse.json({ error: 'Failed to update transaction' }, { status: 500 })
    }

    const transaction = updated ? { ...updated, type: updated.transaction_type === 'credit' ? 'income' : 'expense' } : null
    return NextResponse.json({ transaction })
  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
  const supabase = await createClient()
    
    // Get authenticated user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    const idsParam = searchParams.getAll('ids')
    // Support ids=1&ids=2 or ids=1,2 comma separated
    let ids: string[] = []
    if (idsParam && idsParam.length > 0) {
      ids = idsParam.flatMap(v => String(v).split(',')).map(s => s.trim()).filter(Boolean)
    }
    const idsToDelete = ids.length ? Array.from(new Set(ids)) : (id ? [id] : [])

    if (idsToDelete.length === 0) {
      return NextResponse.json({ error: 'Transaction ID is required' }, { status: 400 })
    }

    // Delete transaction(s)
    let query = supabase
      .from('bank_account_transactions')
      .delete()
      .eq('user_id', user.id)
    if (idsToDelete.length === 1) query = query.eq('id', idsToDelete[0])
    else query = query.in('id', idsToDelete)
    const { error } = await query

    if (error) {
      console.error('Error deleting transaction:', error)
      return NextResponse.json({ error: 'Failed to delete transaction' }, { status: 500 })
    }

    return NextResponse.json({ success: true, deleted: idsToDelete.length })
  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
