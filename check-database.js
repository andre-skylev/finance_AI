const { createClient } = require('@supabase/supabase-js')

async function checkDatabaseStructure() {
  console.log('🔍 Checking database structure and triggers...')
  
  // Initialize Supabase client with service key if available
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  
  if (!supabaseUrl || !supabaseKey) {
    console.log('❌ Missing environment variables')
    console.log('NEXT_PUBLIC_SUPABASE_URL:', !!supabaseUrl)
    console.log('SUPABASE_SERVICE_ROLE_KEY:', !!process.env.SUPABASE_SERVICE_ROLE_KEY)
    console.log('NEXT_PUBLIC_SUPABASE_ANON_KEY:', !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
    return
  }
  
  const supabase = createClient(supabaseUrl, supabaseKey)
  
  try {
    // Check if we can query the accounts table structure
    console.log('📊 Checking accounts table...')
    const { data: accounts, error: accountsError } = await supabase
      .from('accounts')
      .select('*')
      .limit(1)
    
    if (accountsError) {
      console.log('❌ Error querying accounts:', accountsError.message)
    } else {
      console.log('✅ Accounts table accessible')
      if (accounts && accounts.length > 0) {
        console.log('📝 Sample account structure:', Object.keys(accounts[0]))
      }
    }
    
    // Check if we can query the transactions table
    console.log('📊 Checking transactions table...')
    const { data: transactions, error: transactionsError } = await supabase
      .from('transactions')
      .select('*')
      .limit(1)
    
    if (transactionsError) {
      console.log('❌ Error querying transactions:', transactionsError.message)
    } else {
      console.log('✅ Transactions table accessible')
      if (transactions && transactions.length > 0) {
        console.log('📝 Sample transaction structure:', Object.keys(transactions[0]))
      }
    }
    
    // Try to query for any function or trigger info (this might not work with RLS)
    console.log('📊 Checking for functions...')
    const { data: functions, error: functionsError } = await supabase.rpc('get_schema_info', {})
    
    if (functionsError) {
      console.log('⚠️ Cannot query functions (expected with RLS):', functionsError.message)
    } else if (functions) {
      console.log('✅ Functions found:', functions)
    }
    
  } catch (error) {
    console.error('❌ Error checking database:', error.message)
  }
}

checkDatabaseStructure()
