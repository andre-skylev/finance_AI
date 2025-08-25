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

    // Get user's credit cards
    const { data: creditCards, error } = await supabase
      .schema('public')
      .from('credit_cards')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .order('created_at', { ascending: true })

    if (error) {
      console.error('Error fetching credit cards:', error)
      return NextResponse.json({ error: 'Failed to fetch credit cards' }, { status: 500 })
    }

    return NextResponse.json({ creditCards })
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
      card_name, 
      bank_name, 
      card_brand, 
      last_four_digits, 
      card_type = 'credit', 
      credit_limit, 
      currency, 
      closing_day, 
      due_day, 
      annual_fee = 0, 
      interest_rate, 
      notes 
    } = body

    // Validate required fields
    if (!card_name || !bank_name || !currency) {
      return NextResponse.json(
        { error: 'Missing required fields: card_name, bank_name, currency' }, 
        { status: 400 }
      )
    }

    // Create new credit card
    const { data: creditCard, error } = await supabase
      .schema('public')
      .from('credit_cards')
      .insert({
        user_id: user.id,
        card_name,
        bank_name,
        card_brand,
        last_four_digits,
        card_type,
        credit_limit: credit_limit ? parseFloat(credit_limit) : null,
        currency,
        closing_day,
        due_day,
        current_balance: 0,
        annual_fee: parseFloat(annual_fee),
        interest_rate: interest_rate ? parseFloat(interest_rate) : null,
        notes,
        is_active: true
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating credit card:', error)
      return NextResponse.json({ error: 'Failed to create credit card' }, { status: 500 })
    }

    return NextResponse.json({ creditCard }, { status: 201 })
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
      card_name, 
      bank_name, 
      card_brand, 
      last_four_digits, 
      card_type, 
      credit_limit, 
      currency, 
      closing_day, 
      due_day, 
      annual_fee, 
      interest_rate, 
      notes, 
      is_active 
    } = body

    if (!id) {
      return NextResponse.json({ error: 'Credit card ID is required' }, { status: 400 })
    }

    // Update credit card
    const { data: creditCard, error } = await supabase
      .schema('public')
      .from('credit_cards')
      .update({
        card_name,
        bank_name,
        card_brand,
        last_four_digits,
        card_type,
        credit_limit: credit_limit ? parseFloat(credit_limit) : null,
        currency,
        closing_day,
        due_day,
        annual_fee: annual_fee ? parseFloat(annual_fee) : null,
        interest_rate: interest_rate ? parseFloat(interest_rate) : null,
        notes,
        is_active
      })
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single()

    if (error) {
      console.error('Error updating credit card:', error)
      return NextResponse.json({ error: 'Failed to update credit card' }, { status: 500 })
    }

    return NextResponse.json({ creditCard })
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
      return NextResponse.json({ error: 'Credit card ID is required' }, { status: 400 })
    }

    // Verificar se o cartão pertence ao usuário
    const { data: creditCard, error: cardError } = await supabase
      .schema('public')
      .from('credit_cards')
      .select('id, card_name, bank_name')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (cardError || !creditCard) {
      return NextResponse.json({ error: 'Credit card not found' }, { status: 404 })
    }

    if (hardDelete) {
      // Exclusão completa - excluir todas as transações relacionadas primeiro
      console.log(`Excluindo transações do cartão ${creditCard.bank_name} ${creditCard.card_name} (${id})`)
      
      // Excluir transações do cartão
      const { error: transactionsError } = await supabase
        .schema('public')
        .from('credit_card_transactions')
        .delete()
        .eq('credit_card_id', id)
        .eq('user_id', user.id)

      if (transactionsError) {
        console.error('Erro ao excluir transações do cartão:', transactionsError)
        return NextResponse.json({ error: 'Failed to delete credit card transactions' }, { status: 500 })
      }

      // Excluir o cartão
      const { data: deletedCard, error: deleteError } = await supabase
        .schema('public')
        .from('credit_cards')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id)
        .select()
        .single()

      if (deleteError) {
        console.error('Erro ao excluir cartão:', deleteError)
        return NextResponse.json({ error: 'Failed to delete credit card' }, { status: 500 })
      }

      return NextResponse.json({ 
        creditCard: deletedCard, 
        message: 'Credit card and all related data deleted successfully' 
      })
    } else {
      // Soft delete by setting is_active to false
      const { data: creditCard, error } = await supabase
        .schema('public')
        .from('credit_cards')
        .update({ is_active: false })
        .eq('id', id)
        .eq('user_id', user.id)
        .select()
        .single()

      if (error) {
        console.error('Error deactivating credit card:', error)
        return NextResponse.json({ error: 'Failed to deactivate credit card' }, { status: 500 })
      }

      return NextResponse.json({ creditCard })
    }
  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
