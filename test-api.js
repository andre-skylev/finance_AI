const { createClient } = require('@supabase/supabase-js')

async function testDashboardAPI() {
  try {
    console.log('Testing dashboard API endpoints...')
    
    // Test recent transactions
    const response = await fetch('http://localhost:3000/api/dashboard?type=recent-transactions&limit=5')
    
    if (!response.ok) {
      console.error('API call failed:', response.status, response.statusText)
      return
    }
    
    const data = await response.json()
    console.log('✅ Recent transactions API working')
    console.log('Transactions returned:', data.transactions?.length || 0)
    
    if (data.transactions && data.transactions.length > 0) {
      // Check for orphaned transactions (those without account_name)
      const orphaned = data.transactions.filter(tx => !tx.account_name || tx.account_name === null)
      
      if (orphaned.length > 0) {
        console.log('❌ Found orphaned transactions:', orphaned.length)
        console.log('Sample orphaned transaction:', JSON.stringify(orphaned[0], null, 2))
        console.log('\n🔧 Hard delete is working - this is expected if you recently deleted accounts')
      } else {
        console.log('✅ No orphaned transactions found - dashboard is clean!')
      }
      
      // Show sample transaction structure
      console.log('\nSample transaction structure:')
      console.log(JSON.stringify(data.transactions[0], null, 2))
    } else {
      console.log('ℹ️ No transactions in database to test')
    }
    
  } catch (error) {
    console.error('Test failed:', error.message)
  }
}

testDashboardAPI()
