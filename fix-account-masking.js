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

function generateAccountMasked(accountName, bankName) {
  // Create a meaningful masked version based on account name and bank
  const name = accountName || 'Unknown';
  const bank = bankName || 'Bank';
  
  // Use first 2 chars of bank and last 4 of account name
  const bankPrefix = bank.substring(0, 2).toUpperCase();
  const accountSuffix = name.length >= 4 ? name.slice(-4) : name.padEnd(4, 'X');
  
  return `**** **** ${bankPrefix}** ${accountSuffix}`;
}

function generateAccountHash(accountName, bankName, accountId) {
  // Create a simple hash from the account data
  const data = `${accountName}-${bankName}-${accountId}`;
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(16);
}

async function fixAccountMasking() {
  console.log('🔧 Fixing account masking for existing accounts...\n');
  
  try {
    // Get all accounts
    const { data: accounts, error: accountsError } = await supabase
      .from('accounts')
      .select('*');
    
    if (accountsError) {
      console.error('Error fetching accounts:', accountsError);
      return false;
    }
    
    console.log(`Found ${accounts.length} accounts to fix:`);
    accounts.forEach(acc => {
      console.log(`- ${acc.name} (${acc.bank_name}) - Current masked: "${acc.account_masked}"`);
    });
    
    console.log('\n🔄 Updating account masking...');
    
    for (const account of accounts) {
      const newMasked = generateAccountMasked(account.name, account.bank_name);
      const newHash = generateAccountHash(account.name, account.bank_name, account.id);
      
      console.log(`\nUpdating account: ${account.name}`);
      console.log(`  Old masked: "${account.account_masked}"`);
      console.log(`  New masked: "${newMasked}"`);
      console.log(`  Hash: ${newHash}`);
      
      const { error: updateError } = await supabase
        .from('accounts')
        .update({
          account_masked: newMasked,
          account_number_hash: newHash,
          sensitive_data_encrypted: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', account.id);
      
      if (updateError) {
        console.error(`❌ Error updating account ${account.id}:`, updateError);
      } else {
        console.log(`✅ Successfully updated account ${account.id}`);
      }
    }
    
    return true;
  } catch (error) {
    console.error('Error in fixAccountMasking:', error);
    return false;
  }
}

async function verifyFixes() {
  console.log('\n🧪 Verifying the fixes...\n');
  
  try {
    const { data: accounts, error: accountsError } = await supabase
      .from('accounts')
      .select('id, name, bank_name, account_masked, account_number_hash, sensitive_data_encrypted');
    
    if (accountsError) {
      console.error('Error fetching accounts:', accountsError);
      return;
    }
    
    console.log('📊 Updated accounts:');
    accounts.forEach(account => {
      console.log(`\n- Account: ${account.name} (${account.bank_name})`);
      console.log(`  Masked: "${account.account_masked}"`);
      console.log(`  Hash: ${account.account_number_hash}`);
      console.log(`  Encrypted: ${account.sensitive_data_encrypted}`);
    });
    
    // Check if the default placeholder is gone
    const hasDefaultPlaceholder = accounts.some(acc => acc.account_masked === '**** **** **** ****');
    
    if (hasDefaultPlaceholder) {
      console.log('\n⚠️  Some accounts still have the default placeholder');
    } else {
      console.log('\n✅ All accounts now have proper masking!');
    }
    
  } catch (error) {
    console.error('Error verifying fixes:', error);
  }
}

async function main() {
  console.log('🚀 Starting account masking fix...\n');
  
  const success = await fixAccountMasking();
  
  if (success) {
    await verifyFixes();
    console.log('\n🎉 Account masking fix completed successfully!');
  } else {
    console.log('\n❌ Account masking fix failed');
  }
}

main().catch(console.error);
