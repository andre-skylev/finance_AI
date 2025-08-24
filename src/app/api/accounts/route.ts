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

    // Get user's accounts directly (showing actual balances)
    let accounts, error;
    try {
      const result = await supabase
        .from('accounts')
        .select(`
          id,
          user_id,
          name,
          bank_name,
          account_type,
          currency,
          balance,
          account_masked,
          account_number_hash,
          is_active,
          created_at,
          updated_at
        `)
        .eq('user_id', user.id)
        .order('name', { ascending: true })

      accounts = result.data || []
      error = result.error
    } catch (dbError) {
      console.error('Database error:', dbError)
      error = dbError
    }

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
  const { name, bank_name, account_type, currency, balance = 0, account_number } = body

    // Validate required fields
    if (!name || !account_type || !currency) {
      return NextResponse.json(
        { error: 'Missing required fields: name, account_type, currency' }, 
        { status: 400 }
      )
    }

  // Create new account with masking fields
  const initial = parseFloat(balance)
  const initialProvided = !isNaN(initial) && initial !== 0
  // simple masking helpers
  const masked = account_number ? `•••• ${String(account_number).slice(-4)}` : null
  const account_number_hash = account_number ? await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(account_number))).then(arr => Buffer.from(new Uint8Array(arr)).toString('hex')) : null
  const { data: account, error } = await supabase
      .from('accounts')
      .insert({
        user_id: user.id,
        name,
        bank_name,
        account_type,
        currency,
        balance: initialProvided ? 0 : parseFloat(balance),
        account_masked: masked,
        account_number_hash,
        sensitive_data_encrypted: !!account_number
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
        const isCredit = initial > 0
        const today = new Date().toISOString().slice(0, 10)
        const { error: txErr } = await supabase
          .from('bank_account_transactions')
          .insert([
            {
              user_id: user.id,
              account_id: account.id,
              transaction_date: today,
              merchant_name: 'Initial Balance',
              description: 'Initial Balance',
              amount: Math.abs(initial),
              currency: currency,
              transaction_type: isCredit ? 'credit' : 'debit',
            },
          ])
        if (txErr) {
          console.warn('Account created, but failed to create initial balance transaction:', txErr)
        }
      }
    } catch (e) {
      console.warn('Non-blocking error while creating initial balance transaction:', e)
    }
    // Return latest account with SECURE data only - NO BALANCE EXPOSURE
    const { data: fresh } = await supabase
      .from('accounts')
      .select(`
        id,
        name,
        bank_name,
        account_type,
        currency,
        account_masked,
        is_active,
        created_at,
        updated_at,
        sensitive_data_encrypted
      `)
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

    // Update account - SECURE: Don't expose balance in response
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
      .select(`
        id,
        name,
        bank_name,
        account_type,
        currency,
        account_masked,
        is_active,
        created_at,
        updated_at,
        sensitive_data_encrypted
      `)
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
      
      // Excluir transações bancárias da conta
      const { error: transactionsError } = await supabase
        .from('bank_account_transactions')
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
      // Soft delete by setting is_active to false - SECURE: Don't expose balance
      const { data: account, error } = await supabase
        .from('accounts')
        .update({ is_active: false })
        .eq('id', id)
        .eq('user_id', user.id)
        .select(`
          id,
          name,
          bank_name,
          account_type,
          currency,
          account_masked,
          is_active,
          created_at,
          updated_at,
          sensitive_data_encrypted
        `)
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
