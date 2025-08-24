const { createClient } = require('@supabase/supabase-js');

// Load environment variables
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function executeSQL(sql, description) {
  console.log(`🔧 ${description}...`);
  try {
    const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });
    if (error) {
      console.error(`❌ Error in ${description}:`, error.message);
      return false;
    }
    console.log(`✅ ${description} completed`);
    return true;
  } catch (error) {
    console.error(`❌ Exception in ${description}:`, error.message);
    return false;
  }
}

async function checkCurrentState() {
  console.log('🔍 Checking current database state...\n');
  
  try {
    // Check accounts
    const { data: accounts, error: accountsError } = await supabase
      .from('accounts')
      .select('*');
    
    if (accountsError) {
      console.error('Error fetching accounts:', accountsError);
      return;
    }
    
    console.log('📊 Current accounts:');
    console.log(JSON.stringify(accounts, null, 2));
    
    // Check what columns exist in accounts table
    const { data: tableInfo, error: infoError } = await supabase
      .from('accounts')
      .select('*')
      .limit(1);
    
    if (!infoError && tableInfo && tableInfo.length > 0) {
      console.log('\n🔧 Account table columns:');
      console.log(Object.keys(tableInfo[0]));
    }
    
    // Check bank_account_transactions
    const { data: bankTrans, error: bankError } = await supabase
      .from('bank_account_transactions')
      .select('*');
    
    if (bankError) {
      console.log('❌ bank_account_transactions table not accessible:', bankError.message);
    } else {
      console.log(`\n💳 Bank account transactions: ${bankTrans.length} records`);
    }
    
    // Check all_transactions view
    const { data: allTrans, error: allError } = await supabase
      .from('all_transactions')
      .select('*');
    
    if (allError) {
      console.log('❌ all_transactions view not accessible:', allError.message);
    } else {
      console.log(`\n📈 All transactions: ${allTrans.length} records`);
    }
    
  } catch (error) {
    console.error('Error checking state:', error);
  }
}

async function updateAccountMasking() {
  console.log('\n🔧 Updating account masking manually...');
  
  try {
    // Get current accounts
    const { data: accounts, error: accountsError } = await supabase
      .from('accounts')
      .select('*');
    
    if (accountsError) {
      console.error('Error fetching accounts:', accountsError);
      return false;
    }
    
    console.log(`Found ${accounts.length} accounts to update`);
    
    // Update each account with proper masking
    for (const account of accounts) {
      const accountName = account.name || 'Unknown';
      const lastFour = accountName.length >= 4 ? accountName.slice(-4) : accountName.padStart(4, 'X');
      const masked = `**** **** **** ${lastFour}`;
      
      console.log(`Updating ${account.name} -> ${masked}`);
      
      // Check if account_masked field exists by trying to update it
      const { error: updateError } = await supabase
        .from('accounts')
        .update({ 
          account_masked: masked
        })
        .eq('id', account.id);
      
      if (updateError) {
        console.log(`⚠️  account_masked field might not exist: ${updateError.message}`);
        
        // If the field doesn't exist, we need to add it via direct SQL
        // For now, just log this
        console.log(`Need to add account_masked column to accounts table`);
      } else {
        console.log(`✅ Updated account ${account.id}`);
      }
    }
    
    return true;
  } catch (error) {
    console.error('Error updating account masking:', error);
    return false;
  }
}

async function main() {
  console.log('🚀 Checking account masking status...\n');
  
  await checkCurrentState();
  await updateAccountMasking();
  
  console.log('\n🎉 Account masking check completed!');
  console.log('\n💡 If account_masked column is missing, you need to apply the SQL migration:');
  console.log('   ALTER TABLE accounts ADD COLUMN account_masked TEXT;');
}

main().catch(console.error);
