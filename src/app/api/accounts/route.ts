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

    // Get user's accounts
    const { data: accounts, error } = await supabase
      .from('accounts')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .order('created_at', { ascending: true })

    if (error) {
      console.error('Error fetching accounts:', error)
      return NextResponse.json({ error: 'Failed to fetch accounts' }, { status: 500 })
    }

    return NextResponse.json({ accounts })
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
    const { name, bank_name, account_type, currency, balance = 0 } = body

    // Validate required fields
    if (!name || !account_type || !currency) {
      return NextResponse.json(
        { error: 'Missing required fields: name, account_type, currency' }, 
        { status: 400 }
      )
    }

  // Create new account (store raw balance only if zero to avoid double counting with trigger)
  const initial = parseFloat(balance)
  const initialProvided = !isNaN(initial) && initial !== 0
  const { data: account, error } = await supabase
      .from('accounts')
      .insert({
        user_id: user.id,
        name,
        bank_name,
        account_type,
        currency,
    balance: initialProvided ? 0 : parseFloat(balance)
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating account:', error)
      return NextResponse.json({ error: 'Failed to create account' }, { status: 500 })
    }

    // If an initial balance was provided, record it as a transaction so it appears in the ledger
    try {
      if (initialProvided && account?.id) {
        const isIncome = initial > 0
        const signedAmount = isIncome ? Math.abs(initial) : -Math.abs(initial)
        const today = new Date().toISOString().slice(0, 10)
        const { error: txErr } = await supabase
          .from('transactions')
          .insert([
            {
              user_id: user.id,
              account_id: account.id,
              amount: signedAmount,
              currency: currency,
              description: 'Initial Balance', // keep simple and language-agnostic on server
              transaction_date: today,
              type: isIncome ? 'income' : 'expense',
              category_id: null,
            },
          ])
        if (txErr) {
          console.warn('Account created, but failed to create initial balance transaction:', txErr)
        }
      }
    } catch (e) {
      console.warn('Non-blocking error while creating initial balance transaction:', e)
    }
    // Return latest account with accurate balance
    const { data: fresh } = await supabase
      .from('accounts')
      .select('*')
      .eq('id', account.id)
      .single()
    return NextResponse.json({ account: fresh || account }, { status: 201 })
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
    const { id, name, bank_name, account_type, currency, balance, is_active } = body

    if (!id) {
      return NextResponse.json({ error: 'Account ID is required' }, { status: 400 })
    }

    // Update account
    const { data: account, error } = await supabase
      .from('accounts')
      .update({
        name,
        bank_name,
        account_type,
        currency,
        balance: balance ? parseFloat(balance) : undefined,
        is_active
      })
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single()

    if (error) {
      console.error('Error updating account:', error)
      return NextResponse.json({ error: 'Failed to update account' }, { status: 500 })
    }

    return NextResponse.json({ account })
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
    const hardDelete = searchParams.get('hard') === 'true'

    if (!id) {
      return NextResponse.json({ error: 'Account ID is required' }, { status: 400 })
    }

    // Verificar se a conta pertence ao usuário
    const { data: account, error: accountError } = await supabase
      .from('accounts')
      .select('id, name')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (accountError || !account) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 })
    }

    if (hardDelete) {
      // Exclusão completa - excluir todas as transações relacionadas primeiro
      console.log(`Excluindo transações da conta ${account.name} (${id})`)
      
      // Excluir transações da conta
      const { error: transactionsError } = await supabase
        .from('transactions')
        .delete()
        .eq('account_id', id)
        .eq('user_id', user.id)

      if (transactionsError) {
        console.error('Erro ao excluir transações:', transactionsError)
        return NextResponse.json({ error: 'Failed to delete account transactions' }, { status: 500 })
      }

      // Excluir recibos relacionados à conta
      const { error: receiptsError } = await supabase
        .from('receipts')
        .delete()
        .eq('account_id', id)
        .eq('user_id', user.id)

      if (receiptsError) {
        console.error('Erro ao excluir recibos:', receiptsError)
        // Não retornar erro, recibos são opcionais
      }

      // Excluir a conta
      const { data: deletedAccount, error: deleteError } = await supabase
        .from('accounts')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id)
        .select()
        .single()

      if (deleteError) {
        console.error('Erro ao excluir conta:', deleteError)
        return NextResponse.json({ error: 'Failed to delete account' }, { status: 500 })
      }

      return NextResponse.json({ 
        account: deletedAccount, 
        message: 'Account and all related data deleted successfully' 
      })
    } else {
      // Soft delete by setting is_active to false
      const { data: account, error } = await supabase
        .from('accounts')
        .update({ is_active: false })
        .eq('id', id)
        .eq('user_id', user.id)
        .select()
        .single()

      if (error) {
        console.error('Error deactivating account:', error)
        return NextResponse.json({ error: 'Failed to deactivate account' }, { status: 500 })
      }

      return NextResponse.json({ account })
    }
  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
