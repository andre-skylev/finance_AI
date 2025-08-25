import { createClient as createServerSupabase } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
  const supabase = await createServerSupabase()
    
    // Get authenticated user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get categories (user's custom + default ones)
    const { data: categories, error } = await supabase
      .from('categories')
      .select('*')
      .or(`user_id.eq.${user.id},is_default.eq.true`)
      .order('is_default', { ascending: false })
      .order('name', { ascending: true })

    if (error) {
      console.error('Error fetching categories:', error)
      return NextResponse.json({ error: 'Failed to fetch categories' }, { status: 500 })
    }

    return NextResponse.json({ categories })
  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
  const supabase = await createServerSupabase()
    
    // Get authenticated user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

  const body = await request.json()
  const { name, icon, color = '#6b7280', type, parent_id } = body

    // Validate required fields
    if (!name || !type) {
      return NextResponse.json(
        { error: 'Missing required fields: name, type' }, 
        { status: 400 }
      )
    }

    if (!['expense', 'income'].includes(type)) {
      return NextResponse.json(
        { error: 'Type must be either "expense" or "income"' }, 
        { status: 400 }
      )
    }

    // Create new category
  const { data: category, error } = await supabase
      .from('categories')
      .insert({
        user_id: user.id,
        name,
        icon,
        color,
        type,
    is_default: false,
    parent_id
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating category:', error)
      return NextResponse.json({ error: 'Failed to create category' }, { status: 500 })
    }

    return NextResponse.json({ category }, { status: 201 })
  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
  const supabase = await createServerSupabase()
    
    // Get authenticated user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

  const body = await request.json()
  const { id, name, icon, color, type, parent_id } = body

    if (!id) {
      return NextResponse.json({ error: 'Category ID is required' }, { status: 400 })
    }

    // Update category (only user's own categories, not defaults)
    const { data: category, error } = await supabase
      .from('categories')
      .update({ name, icon, color, type, parent_id })
      .eq('id', id)
      .eq('user_id', user.id)
      .eq('is_default', false)
      .select()
      .single()

    if (error) {
      console.error('Error updating category:', error)
      return NextResponse.json({ error: 'Failed to update category' }, { status: 500 })
    }

    return NextResponse.json({ category })
  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
  const supabase = await createServerSupabase()
    
    // Get authenticated user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'Category ID is required' }, { status: 400 })
    }

    // Delete category (only user's own categories, not defaults)
    const { error } = await supabase
      .from('categories')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)
      .eq('is_default', false)

    if (error) {
      console.error('Error deleting category:', error)
      return NextResponse.json({ error: 'Failed to delete category' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
