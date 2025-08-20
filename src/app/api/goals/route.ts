import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
  const supabase = await createClient()
  // Get user
  const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get goals for the user
    const { data: goals, error: goalsError } = await supabase
      .from('goals')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (goalsError) {
      console.error('Error fetching goals:', goalsError)
      return NextResponse.json({ error: 'Failed to fetch goals' }, { status: 500 })
    }

    return NextResponse.json({ goals: goals || [] })
  } catch (error) {
    console.error('Error in goals API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
  const supabase = await createClient()
  // Get user
  const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { name, description, target_amount, current_amount, target_date, currency } = body

    // Validate required fields
    if (!name || !target_amount) {
      return NextResponse.json({ error: 'Name and target amount are required' }, { status: 400 })
    }

    // Create goal
    const { data: goal, error: goalError } = await supabase
      .from('goals')
      .insert({
        user_id: user.id,
        name,
        description: description || null,
        target_amount,
        current_amount: current_amount || 0,
        target_date: target_date || null,
        currency: currency || 'EUR'
      })
      .select()
      .single()

    if (goalError) {
      console.error('Error creating goal:', goalError)
      return NextResponse.json({ error: 'Failed to create goal' }, { status: 500 })
    }

    return NextResponse.json({ goal })
  } catch (error) {
    console.error('Error in goals API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
  const supabase = await createClient()
  // Get user
  const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const goalId = searchParams.get('id')

    if (!goalId) {
      return NextResponse.json({ error: 'Goal ID is required' }, { status: 400 })
    }

    // Delete goal (only if it belongs to the user)
    const { error: deleteError } = await supabase
      .from('goals')
      .delete()
      .eq('id', goalId)
      .eq('user_id', user.id)

    if (deleteError) {
      console.error('Error deleting goal:', deleteError)
      return NextResponse.json({ error: 'Failed to delete goal' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in goals API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}