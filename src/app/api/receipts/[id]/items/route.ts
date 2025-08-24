import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

// Deprecated: receipt_items are no longer used in the simplified model.
export async function GET() {
  return NextResponse.json({ items: [] })
}
