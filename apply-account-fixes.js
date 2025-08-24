const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY; // We'll need service role key for DDL

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function applyAccountMasking() {
  console.log('🔧 Applying account masking migration...');
  
  try {
    // First, check if account_masked column exists
    const { data: columns, error: columnError } = await supabase
      .from('information_schema.columns')
      .select('column_name')
      .eq('table_name', 'accounts')
      .eq('column_name', 'account_masked');
    
    if (columnError) {
      console.error('Error checking columns:', columnError);
      return false;
    }
    
    if (columns && columns.length > 0) {
      console.log('✅ account_masked column already exists');
    } else {
      console.log('❌ account_masked column missing - need service role key to add it');
      return false;
    }
    
    // Update existing accounts with proper masking
    console.log('🔄 Updating existing accounts with proper masking...');
    
    const { data: accounts, error: accountsError } = await supabase
      .from('accounts')
      .select('*');
    
    if (accountsError) {
      console.error('Error fetching accounts:', accountsError);
      return false;
    }
    
    console.log(`Found ${accounts.length} accounts to update`);
    
    for (const account of accounts) {
      // Generate a proper masked version
      const accountNumber = account.name || 'XXXX';
      const masked = `**** **** **** ${accountNumber.slice(-4).padStart(4, 'X')}`;
      
      console.log(`Updating account ${account.id}: ${account.name} -> ${masked}`);
      
      const { error: updateError } = await supabase
        .from('accounts')
        .update({ 
          account_masked: masked,
          updated_at: new Date().toISOString()
        })
        .eq('id', account.id);
      
      if (updateError) {
        console.error(`Error updating account ${account.id}:`, updateError);
      } else {
        console.log(`✅ Updated account ${account.id}`);
      }
    }
    
    return true;
  } catch (error) {
    console.error('Error in applyAccountMasking:', error);
    return false;
  }
}

async function testDataConsistency() {
  console.log('\n🧪 Testing data consistency...');
  
  try {
    // Check accounts
    const { data: accounts, error: accountsError } = await supabase
      .from('accounts')
      .select('id, name, account_masked, balance');
    
    if (accountsError) {
      console.error('Error fetching accounts:', accountsError);
      return;
    }
    
    console.log('\n📊 Accounts status:');
    accounts.forEach(account => {
      console.log(`- ${account.name}: masked="${account.account_masked}", balance=${account.balance}`);
    });
    
    // Check bank_account_transactions
    const { data: bankTransactions, error: bankError } = await supabase
      .from('bank_account_transactions')
      .select('*');
    
    if (bankError) {
      console.error('Error fetching bank transactions:', bankError);
    } else {
      console.log(`\n💳 Bank account transactions: ${bankTransactions.length} records`);
    }
    
    // Check all_transactions view
    const { data: allTransactions, error: allError } = await supabase
      .from('all_transactions')
      .select('*')
      .limit(5);
    
    if (allError) {
      console.error('Error fetching all transactions:', allError);
    } else {
      console.log(`\n📈 All transactions view: ${allTransactions.length} records (showing first 5)`);
      allTransactions.forEach(t => {
        console.log(`- ${t.description}: ${t.amount} ${t.currency} (${t.source_type})`);
      });
    }
    
  } catch (error) {
    console.error('Error in testDataConsistency:', error);
  }
}

async function main() {
  console.log('🚀 Starting account fixes...\n');
  
  const maskingSuccess = await applyAccountMasking();
  
  if (maskingSuccess) {
    console.log('\n✅ Account masking applied successfully');
  } else {
    console.log('\n❌ Account masking failed - may need manual SQL execution');
  }
  
  await testDataConsistency();
  
  console.log('\n🎉 Account fixes completed!');
}

main().catch(console.error);
