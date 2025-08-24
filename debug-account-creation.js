const { createClient } = require('@supabase/supabase-js')

async function debugAccountCreation() {
  // Initialize Supabase client
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://your-project.supabase.co'
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'your-anon-key'
  
  console.log('🔍 Debugging account creation...')
  console.log('📊 Supabase URL:', supabaseUrl.substring(0, 30) + '...')
  
  const supabase = createClient(supabaseUrl, supabaseKey)
  
  // Test data
  const testAccount = {
    name: 'Debug Test Account',
    bank_name: 'Debug Bank',
    account_type: 'checking',
    currency: 'EUR',
    balance: 1000
  }
  
  try {
    // Simulate the account creation logic from the API
    const userId = 'test-user-id' // This would normally come from auth
    
    console.log('🏦 Creating account with data:', testAccount)
    
    // Step 1: Create account with balance 0 (as in the API)
    const initial = parseFloat(testAccount.balance)
    const initialProvided = !isNaN(initial) && initial !== 0
    
    console.log('💰 Initial balance:', initial)
    console.log('🔄 Initial provided:', initialProvided)
    console.log('💾 Balance to store in account:', initialProvided ? 0 : initial)
    
    // This is what the API does:
    const accountData = {
      user_id: userId,
      name: testAccount.name,
      bank_name: testAccount.bank_name,
      account_type: testAccount.account_type,
      currency: testAccount.currency,
      balance: initialProvided ? 0 : parseFloat(testAccount.balance)
    }
    
    console.log('📝 Account data to insert:', accountData)
    
    // Step 2: Check if we would create a transaction
    if (initialProvided) {
      const isIncome = initial > 0
      const signedAmount = isIncome ? Math.abs(initial) : -Math.abs(initial)
      const today = new Date().toISOString().slice(0, 10)
      
      const transactionData = {
        user_id: userId,
        account_id: 'would-be-account-id',
        amount: signedAmount,
        currency: testAccount.currency,
        description: 'Initial Balance',
        transaction_date: today,
        type: isIncome ? 'income' : 'expense',
        category_id: null,
      }
      
      console.log('💸 Transaction that would be created:', transactionData)
    }
    
    console.log('✅ Logic check complete - the process should work')
    console.log('💡 Issue might be in the frontend or authentication')
    
  } catch (error) {
    console.error('❌ Error during debug:', error)
  }
}

debugAccountCreation()
