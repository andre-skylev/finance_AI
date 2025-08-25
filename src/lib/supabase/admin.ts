import { createClient as createSupabaseClient } from '@supabase/supabase-js'

export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceRoleKey) {
    throw new Error('Missing SUPABASE service credentials')
  }
  return createSupabaseClient(url, serviceRoleKey, {
    auth: { persistSession: false },
    db: { schema: 'public' }
  })
}
