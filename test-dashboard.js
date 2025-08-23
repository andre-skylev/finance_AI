const { createClient } = require('@supabase/supabase-js')

async function testDashboard() {
  // Load environment variables
  require('dotenv').config({ path: '.env.local' })
  
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  
  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Missing Supabase credentials in .env.local')
    process.exit(1)
  }
  
  const supabase = createClient(supabaseUrl, supabaseAnonKey)
  
  try {
    console.log('Testing dashboard functionality...')
    
    // Test recent transactions endpoint through API
    const response = await fetch('http://localhost:3000/api/dashboard?type=recent-transactions&limit=5')
    const data = await response.json()
    
    if (response.ok) {
      console.log(`✅ Recent transactions API returned ${data.transactions?.length || 0} results`)
      
      // Check if any transactions have null account_name (orphaned)
      const orphanedCount = data.transactions?.filter(tx => !tx.account_name).length || 0
      if (orphanedCount > 0) {
        console.log(`❌ Found ${orphanedCount} orphaned transactions (null account_name)`)
        console.log('Orphaned transactions:', data.transactions.filter(tx => !tx.account_name))
      } else {
        console.log('✅ No orphaned transactions found')
      }
    } else {
      console.error('❌ API call failed:', data)
    }
    
  } catch (error) {
    console.error('Test failed:', error)
  }
}

testDashboard()
