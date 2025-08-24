// Test Account Security
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY; // Use anon key for testing

console.log('🔍 Testing Account Security System...');
console.log('📊 Supabase URL:', supabaseUrl);

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testSecuritySystem() {
  try {
    // 1. Create a test account
    console.log('\n1️⃣ Creating test account...');
    const { data: newAccount, error: createError } = await supabase
      .from('accounts')
      .insert({
        name: 'Test Security Account',
        bank_name: 'ITAU',
        account_type: 'checking',
        balance: 15000, // €15,000
        currency: 'EUR',
        user_id: '550e8400-e29b-41d4-a716-446655440000' // Valid UUID for testing
      })
      .select()
      .single();

    if (createError) {
      console.error('❌ Error creating account:', createError);
      return;
    }

    console.log('✅ Account created:', newAccount);

    // 2. Check the account_masked field
    console.log('\n2️⃣ Checking account masking...');
    const { data: account, error: fetchError } = await supabase
      .from('accounts')
      .select('*')
      .eq('id', newAccount.id)
      .single();

    if (fetchError) {
      console.error('❌ Error fetching account:', fetchError);
      return;
    }

    console.log('🔒 Account Masked:', account.account_masked);
    console.log('🔑 Account Number Hash:', account.account_number_hash);
    console.log('🛡️ Sensitive Data Encrypted:', account.sensitive_data_encrypted);

    // 3. Test the secure view
    console.log('\n3️⃣ Testing secure view...');
    const { data: secureAccounts, error: secureError } = await supabase
      .from('account_balances_secure')
      .select('*')
      .eq('id', newAccount.id);

    if (secureError) {
      console.error('❌ Error accessing secure view:', secureError);
      return;
    }

    console.log('✅ Secure view data:');
    secureAccounts.forEach(acc => {
      console.log(`  📊 Name: ${acc.name}`);
      console.log(`  🏦 Bank: ${acc.bank_name}`);
      console.log(`  🔒 Account Masked: ${acc.account_masked}`);
      console.log(`  💰 Balance Range: ${acc.balance_range}`);
      console.log(`  🔍 Has Hash: ${acc.account_number_hash ? 'Yes' : 'No'}`);
    });

    // 4. Test what the API would return
    console.log('\n4️⃣ Testing API simulation...');
    const { data: apiData, error: apiError } = await supabase
      .from('account_balances_secure')
      .select('id, name, bank_name, account_type, balance_range, currency, account_masked, is_active')
      .eq('user_id', '550e8400-e29b-41d4-a716-446655440000');

    if (apiError) {
      console.error('❌ Error in API simulation:', apiError);
      return;
    }

    console.log('📡 API would return:');
    console.log(JSON.stringify(apiData, null, 2));

    // 5. Cleanup
    console.log('\n5️⃣ Cleaning up test data...');
    const { error: deleteError } = await supabase
      .from('accounts')
      .delete()
      .eq('id', newAccount.id);

    if (deleteError) {
      console.error('❌ Error deleting test account:', deleteError);
    } else {
      console.log('✅ Test account deleted');
    }

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

testSecuritySystem();
