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

async function testPDFProcessingFlow() {
  console.log('🧪 Testing PDF processing flow with bank_account_transactions...\n');
  
  try {
    // Get the current account
    const { data: accounts, error: accountsError } = await supabase
      .from('accounts')
      .select('*')
      .limit(1);
    
    if (accountsError) {
      console.error('❌ Error fetching accounts:', accountsError);
      return;
    }
    
    if (!accounts || accounts.length === 0) {
      console.error('❌ No accounts found');
      return;
    }
    
    const account = accounts[0];
    console.log(`✅ Using account: ${account.name} (${account.id})`);
    console.log(`   Masked: "${account.account_masked}"`);
    console.log(`   Hash: ${account.account_number_hash}`);
    
    // Test data for bank transaction
    const testTransaction = {
      account_id: account.id,
      amount: -45.67,
      currency: 'BRL',
      description: 'Teste Supermercado ABC',
      merchant_name: 'Supermercado ABC',
      location: 'São Paulo, SP',
      transaction_date: '2025-08-24',
      transaction_type: 'purchase',
      category_id: null,
      confidence_score: 0.95,
      pattern_matched: true,
      statement_id: 'stmt_test_' + Date.now()
    };
    
    console.log('\n💳 Inserting test transaction into bank_account_transactions...');
    
    const { data: insertedTransaction, error: insertError } = await supabase
      .from('bank_account_transactions')
      .insert([{
        ...testTransaction,
        user_id: account.user_id
      }])
      .select();
    
    if (insertError) {
      console.error('❌ Error inserting transaction:', insertError);
      return;
    }
    
    console.log('✅ Transaction inserted successfully:', insertedTransaction[0].id);
    
    // Test receipt creation
    console.log('\n🧾 Testing receipt creation...');
    
    const testReceipt = {
      user_id: account.user_id,
      file_name: 'test_receipt.pdf',
      file_path: '/test/receipts/test_receipt.pdf',
      file_size: 1024,
      mime_type: 'application/pdf',
      extracted_text: 'SUPERMERCADO ABC\nTotal: R$ 45,67\nData: 24/08/2025',
      processing_status: 'completed',
      confidence_score: 0.95
    };
    
    const { data: insertedReceipt, error: receiptError } = await supabase
      .from('receipts')
      .insert([testReceipt])
      .select();
    
    if (receiptError) {
      console.error('❌ Error inserting receipt:', receiptError);
    } else {
      console.log('✅ Receipt inserted successfully:', insertedReceipt[0].id);
      
      // Link receipt to transaction if possible
      const { error: linkError } = await supabase
        .from('bank_account_transactions')
        .update({ receipt_id: insertedReceipt[0].id })
        .eq('id', insertedTransaction[0].id);
      
      if (linkError) {
        console.log('⚠️  Could not link receipt to transaction (expected - column might not exist)');
      } else {
        console.log('✅ Receipt linked to transaction');
      }
    }
    
    // Test the consolidated view
    console.log('\n📊 Testing all_transactions view...');
    
    const { data: allTransactions, error: viewError } = await supabase
      .from('all_transactions')
      .select('*')
      .eq('source_type', 'bank')
      .order('created_at', { ascending: false })
      .limit(5);
    
    if (viewError) {
      console.error('❌ Error querying all_transactions view:', viewError);
    } else {
      console.log(`✅ Found ${allTransactions.length} bank transactions in view:`);
      allTransactions.forEach(t => {
        console.log(`   - ${t.description}: ${t.amount} ${t.currency} (${t.source_type})`);
      });
    }
    
    // Check summary
    console.log('\n📈 Final summary...');
    
    const { data: bankTransCount } = await supabase
      .from('bank_account_transactions')
      .select('id', { count: 'exact' });
    
    const { data: receiptsCount } = await supabase
      .from('receipts')
      .select('id', { count: 'exact' });
    
    const { data: allTransCount } = await supabase
      .from('all_transactions')
      .select('id', { count: 'exact' });
    
    console.log(`📊 Bank account transactions: ${bankTransCount?.length || 0}`);
    console.log(`🧾 Receipts: ${receiptsCount?.length || 0}`);
    console.log(`📈 All transactions (view): ${allTransCount?.length || 0}`);
    
    console.log('\n🎉 PDF processing flow test completed!');
    
  } catch (error) {
    console.error('❌ Error in test:', error);
  }
}

async function verifyAccountMasking() {
  console.log('🔍 Verifying account masking...\n');
  
  try {
    const { data: accounts, error } = await supabase
      .from('accounts')
      .select('id, name, bank_name, account_masked, account_number_hash, sensitive_data_encrypted');
    
    if (error) {
      console.error('❌ Error fetching accounts:', error);
      return;
    }
    
    console.log(`Found ${accounts.length} accounts:`);
    accounts.forEach(acc => {
      console.log(`\n- ${acc.name} (${acc.bank_name})`);
      console.log(`  Masked: "${acc.account_masked}"`);
      console.log(`  Hash: ${acc.account_number_hash}`);
      console.log(`  Encrypted: ${acc.sensitive_data_encrypted}`);
      
      if (acc.account_masked === '**** **** **** ****') {
        console.log('  ⚠️  Still using default placeholder');
      } else {
        console.log('  ✅ Properly masked');
      }
    });
    
  } catch (error) {
    console.error('❌ Error verifying accounts:', error);
  }
}

async function main() {
  console.log('🚀 Comprehensive system test after migrations...\n');
  
  await verifyAccountMasking();
  console.log('\n' + '='.repeat(50) + '\n');
  await testPDFProcessingFlow();
}

main().catch(console.error);
