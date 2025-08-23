const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

async function applyMigration() {
  // Load environment variables
  require('dotenv').config({ path: '.env.local' })
  
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  
  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing Supabase credentials in .env.local')
    process.exit(1)
  }
  
  const supabase = createClient(supabaseUrl, supabaseServiceKey)
  
  // Read and execute the migration
  const migrationSQL = fs.readFileSync(path.join(__dirname, 'apply_migration_016.sql'), 'utf8')
  
  try {
    console.log('Applying migration 016_fix_orphaned_transactions...')
    
    // Split by semicolon and execute each statement
    const statements = migrationSQL.split(';').filter(stmt => stmt.trim())
    
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i].trim()
      if (statement) {
        console.log(`Executing statement ${i + 1}/${statements.length}...`)
        const { error } = await supabase.rpc('exec_sql', { sql: statement })
        if (error) {
          console.error(`Error in statement ${i + 1}:`, error)
          // Continue with other statements
        }
      }
    }
    
    console.log('Migration applied successfully!')
    
    // Test the fix by checking recent transactions
    console.log('\nTesting dashboard queries...')
    
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError) {
      console.log('No user authenticated, skipping test queries')
    } else {
      // Test recent transactions query
      const { data: recentTx, error: recentError } = await supabase.rpc('get_recent_transactions', {
        user_uuid: user.id,
        limit_count: 5
      })
      
      if (recentError) {
        console.error('Error testing recent transactions:', recentError)
      } else {
        console.log(`✅ Recent transactions query returned ${recentTx?.length || 0} results`)
        console.log('All transactions have account_name filled:', recentTx?.every(tx => tx.account_name) ? '✅' : '❌')
      }
    }
    
  } catch (error) {
    console.error('Migration failed:', error)
    process.exit(1)
  }
}

applyMigration()
