import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data } = await supabase
    .from('dashboard_layouts')
    .select('layout')
    .eq('user_id', user.id)
    .maybeSingle()
  return NextResponse.json({ layout: (data?.layout || null) })
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await request.json()
  const layout = Array.isArray(body?.layout) ? body.layout : []
  // upsert by user_id unique
  const { data, error } = await supabase
    .from('dashboard_layouts')
    .upsert({ user_id: user.id, layout }, { onConflict: 'user_id' })
    .select('layout')
    .maybeSingle()
  if (error) return NextResponse.json({ error: 'Failed to save' }, { status: 500 })
  return NextResponse.json({ layout: data?.layout || [] })
}
