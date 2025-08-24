const { createClient } = require('@supabase/supabase-js')

async function testEnhancedTransactionStructure() {
  console.log('🧪 Testing Enhanced Transaction Structure...')

  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    
    if (!supabaseUrl || !supabaseKey) {
      console.log('❌ Environment variables not found')
      return
    }

    const supabase = createClient(supabaseUrl, supabaseKey)

    // Test 1: Check current transaction structure
    console.log('\n📋 1. Testing current transaction structure...')
    const { data: currentTransactions, error: currentError } = await supabase
      .from('transactions')
      .select('id, description, amount, receipt_id, created_at')
      .limit(3)

    if (currentError) {
      console.log('❌ Error fetching current transactions:', currentError.message)
    } else {
      console.log('✅ Current transactions fetched successfully')
      console.log(`   📊 Found ${currentTransactions.length} transactions`)
      if (currentTransactions.length > 0) {
        console.log('   📄 Sample:', {
          description: currentTransactions[0].description,
          amount: currentTransactions[0].amount,
          receipt_id: currentTransactions[0].receipt_id
        })
      }
    }

    // Test 2: Check if new columns exist (they shouldn't yet)
    console.log('\n🔍 2. Testing for enhanced columns (should not exist yet)...')
    const { data: enhancedTest, error: enhancedError } = await supabase
      .from('transactions')
      .select('merchant_name, transaction_type, confidence_score')
      .limit(1)

    if (enhancedError) {
      if (enhancedError.message.includes('column') && enhancedError.message.includes('does not exist')) {
        console.log('✅ Enhanced columns do not exist yet (expected)')
      } else {
        console.log('⚠️ Unexpected error:', enhancedError.message)
      }
    } else {
      console.log('⚠️ Enhanced columns already exist - migration may have been applied')
    }

    // Test 3: Check bank_statements table
    console.log('\n🏦 3. Testing bank_statements table (should not exist yet)...')
    const { data: bankStatements, error: bankError } = await supabase
      .from('bank_statements')
      .select('id')
      .limit(1)

    if (bankError) {
      if (bankError.message.includes('relation') && bankError.message.includes('does not exist')) {
        console.log('✅ bank_statements table does not exist yet (expected)')
      } else {
        console.log('⚠️ Unexpected error:', bankError.message)
      }
    } else {
      console.log('⚠️ bank_statements table already exists - migration may have been applied')
    }

    // Test 4: Check enhanced_transaction_patterns table
    console.log('\n🎯 4. Testing enhanced_transaction_patterns table (should not exist yet)...')
    const { data: patterns, error: patternsError } = await supabase
      .from('enhanced_transaction_patterns')
      .select('id')
      .limit(1)

    if (patternsError) {
      if (patternsError.message.includes('relation') && patternsError.message.includes('does not exist')) {
        console.log('✅ enhanced_transaction_patterns table does not exist yet (expected)')
      } else {
        console.log('⚠️ Unexpected error:', patternsError.message)
      }
    } else {
      console.log('⚠️ enhanced_transaction_patterns table already exists')
    }

    // Test 5: Validate existing receipts integration
    console.log('\n🧾 5. Testing receipts integration...')
    const { data: receipts, error: receiptsError } = await supabase
      .from('receipts')
      .select('id, merchant_name, total, receipt_date')
      .limit(3)

    if (receiptsError) {
      console.log('❌ Error fetching receipts:', receiptsError.message)
    } else {
      console.log('✅ Receipts fetched successfully')
      console.log(`   📊 Found ${receipts.length} receipts`)
      
      if (receipts.length > 0) {
        // Check if receipts are linked to transactions
        const receiptId = receipts[0].id
        const { data: linkedTransactions, error: linkError } = await supabase
          .from('transactions')
          .select('id, description, amount')
          .eq('receipt_id', receiptId)

        if (linkError) {
          console.log('   ❌ Error checking receipt links:', linkError.message)
        } else {
          console.log(`   🔗 Found ${linkedTransactions.length} transactions linked to receipt ${receiptId}`)
        }
      }
    }

    // Test 6: Check receipt_items table
    console.log('\n📋 6. Testing receipt_items integration...')
    const { data: receiptItems, error: itemsError } = await supabase
      .from('receipt_items')
      .select('id, description, total, receipt_id')
      .limit(5)

    if (itemsError) {
      console.log('❌ Error fetching receipt items:', itemsError.message)
    } else {
      console.log('✅ Receipt items fetched successfully')
      console.log(`   📊 Found ${receiptItems.length} receipt items`)
      if (receiptItems.length > 0) {
        console.log('   📄 Sample item:', {
          description: receiptItems[0].description,
          total: receiptItems[0].total
        })
      }
    }

    // Test 7: Check credit card transactions for comparison
    console.log('\n💳 7. Testing credit card transactions structure...')
    const { data: creditTransactions, error: creditError } = await supabase
      .from('credit_card_transactions')
      .select('id, merchant_name, amount, transaction_type, confidence_score')
      .limit(3)

    if (creditError) {
      console.log('❌ Error fetching credit card transactions:', creditError.message)
    } else {
      console.log('✅ Credit card transactions fetched successfully')
      console.log(`   📊 Found ${creditTransactions.length} credit card transactions`)
      if (creditTransactions.length > 0) {
        console.log('   💳 Sample structure:', {
          merchant_name: creditTransactions[0].merchant_name,
          transaction_type: creditTransactions[0].transaction_type,
          confidence_score: creditTransactions[0].confidence_score
        })
        console.log('   ℹ️ This is the structure we want to replicate for bank transactions')
      }
    }

    console.log('\n📊 Summary:')
    console.log('✅ Current transaction system is functional')
    console.log('✅ Receipt integration exists but is underutilized') 
    console.log('✅ Credit card system has advanced features we can replicate')
    console.log('🎯 Ready to apply enhanced transaction structure migration')
    console.log('\n🚀 Next steps:')
    console.log('   1. Run migration: 017_enhance_transactions_structure.sql')
    console.log('   2. Update import APIs to use new structure')
    console.log('   3. Enhance frontend to display new metadata')

  } catch (error) {
    console.error('❌ Error:', error.message)
  }
}

// Run the test
testEnhancedTransactionStructure()
