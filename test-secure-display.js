// Test Secure Balance Display Only
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

console.log('🔍 Testing Secure Balance Display...');

const supabase = createClient(supabaseUrl, supabaseKey);

async function testSecureBalanceDisplay() {
  try {
    // Test the secure view directly
    console.log('\n1️⃣ Testing account_balances_secure view...');
    const { data: secureAccounts, error } = await supabase
      .from('account_balances_secure')
      .select('*')
      .limit(5);

    if (error) {
      console.error('❌ Error accessing secure view:', error);
      
      // Fallback: try regular accounts table to see what exists
      console.log('\n🔄 Fallback: Checking regular accounts...');
      const { data: regularAccounts, error: regularError } = await supabase
        .from('accounts')
        .select('id, name, bank_name, account_type, currency, is_active, account_masked, balance')
        .limit(3);
        
      if (regularError) {
        console.error('❌ Regular accounts error:', regularError);
      } else {
        console.log('📊 Regular accounts found:', regularAccounts?.length || 0);
        regularAccounts?.forEach(acc => {
          console.log(`  💳 ${acc.name} (${acc.bank_name})`);
          console.log(`    🔒 Masked: ${acc.account_masked || 'Not set'}`);
          console.log(`    💰 Balance: €${acc.balance || 0}`);
        });
      }
      
      return;
    }

    console.log('✅ Secure accounts found:', secureAccounts?.length || 0);
    
    if (secureAccounts && secureAccounts.length > 0) {
      console.log('\n📊 Secure Account Data:');
      secureAccounts.forEach((acc, index) => {
        console.log(`\n🏦 Account ${index + 1}:`);
        console.log(`  📛 Name: ${acc.name}`);
        console.log(`  🏦 Bank: ${acc.bank_name || 'N/A'}`);
        console.log(`  🔒 Account Masked: ${acc.account_masked || 'Not masked'}`);
        console.log(`  💰 Balance Range: ${acc.balance_range || 'No range'}`);
        console.log(`  💳 Type: ${acc.account_type}`);
        console.log(`  💱 Currency: ${acc.currency}`);
        console.log(`  ✅ Active: ${acc.is_active}`);
        console.log(`  🔑 Has Hash: ${acc.account_number_hash ? 'Yes' : 'No'}`);
      });
      
      // Test the display functions
      console.log('\n2️⃣ Testing display functions...');
      const testAccount = secureAccounts[0];
      
      // Import display functions (simplified)
      function displaySecureBalance(account, hideBalances = false) {
        if (hideBalances) return '••••••';
        return account.balance_range || 'Balance Hidden';
      }
      
      function displaySecureAccountNumber(account) {
        return account.account_masked || `${account.bank_name || 'Bank'} **** **** ****`;
      }
      
      console.log(`🎨 Display Test for "${testAccount.name}":`);
      console.log(`  💰 Balance (shown): ${displaySecureBalance(testAccount, false)}`);
      console.log(`  💰 Balance (hidden): ${displaySecureBalance(testAccount, true)}`);
      console.log(`  🔒 Account Number: ${displaySecureAccountNumber(testAccount)}`);
      
    } else {
      console.log('ℹ️  No accounts found in secure view');
    }

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

testSecureBalanceDisplay();
