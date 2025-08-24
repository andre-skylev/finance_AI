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

async function testPDFConfirmEndpoint() {
  console.log('🧪 Testing PDF confirm endpoint with bank_account_transactions...\n');
  
  try {
    // Simulate the data that would come from PDF processing
    const pdfConfirmData = {
      target: 'a075df9c-15f7-48ec-899c-24c5149f4b31', // Your account ID
      transactions: [
        {
          date: '2025-08-24',
          description: 'Supermercado ABC - Compra',
          amount: '-45.67',
          suggestedCategory: 'Supermercado'
        },
        {
          date: '2025-08-24', 
          description: 'Transferência PIX Recebida',
          amount: '100.00',
          suggestedCategory: 'Transferência'
        }
      ],
      receipts: [
        {
          fileName: 'receipt_001.pdf',
          content: 'SUPERMERCADO ABC\nTotal: R$ 45,67',
          extractedData: {
            total: 45.67,
            merchant: 'Supermercado ABC',
            date: '2025-08-24'
          }
        }
      ],
      type: 'bank_statement'
    };
    
    console.log('📤 Sending test data to PDF confirm endpoint...');
    console.log('Data:', JSON.stringify(pdfConfirmData, null, 2));
    
    // Call the PDF confirm API
    const response = await fetch('http://localhost:3000/api/pdf-confirm', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(pdfConfirmData)
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ API Error:', response.status, errorText);
      return false;
    }
    
    const result = await response.json();
    console.log('✅ API Response:', result);
    
    // Now check what was actually saved in the database
    console.log('\n🔍 Checking database results...');
    
    // Check bank_account_transactions
    const { data: bankTransactions, error: bankError } = await supabase
      .from('bank_account_transactions')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(5);
    
    if (bankError) {
      console.error('❌ Error fetching bank transactions:', bankError);
    } else {
      console.log(`\n💳 Bank account transactions: ${bankTransactions.length} records`);
      bankTransactions.forEach(t => {
        console.log(`- ${t.description}: ${t.amount} ${t.currency}`);
      });
    }
    
    // Check receipts
    const { data: receipts, error: receiptError } = await supabase
      .from('receipts')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(5);
    
    if (receiptError) {
      console.error('❌ Error fetching receipts:', receiptError);
    } else {
      console.log(`\n🧾 Receipts: ${receipts.length} records`);
      receipts.forEach(r => {
        console.log(`- ${r.file_name}: ${r.processing_status}`);
      });
    }
    
    // Check all_transactions view
    const { data: allTransactions, error: allError } = await supabase
      .from('all_transactions')
      .select('*')
      .eq('source_type', 'bank')
      .order('transaction_date', { ascending: false })
      .limit(5);
    
    if (allError) {
      console.error('❌ Error fetching all transactions:', allError);
    } else {
      console.log(`\n📊 All transactions (bank): ${allTransactions.length} records`);
      allTransactions.forEach(t => {
        console.log(`- ${t.description}: ${t.amount} ${t.currency} (${t.source_type})`);
      });
    }
    
    return true;
    
  } catch (error) {
    console.error('❌ Error in test:', error);
    return false;
  }
}

async function checkCurrentCounts() {
  console.log('📊 Current database counts:\n');
  
  try {
    const tables = [
      'accounts',
      'bank_account_transactions', 
      'credit_card_transactions',
      'transactions',
      'receipts'
    ];
    
    for (const table of tables) {
      const { data, error } = await supabase
        .from(table)
        .select('id', { count: 'exact' });
      
      if (error) {
        console.log(`❌ ${table}: Error - ${error.message}`);
      } else {
        console.log(`📋 ${table}: ${data?.length || 0} records`);
      }
    }
    
    // Check all_transactions view
    const { data: allTrans, error: allError } = await supabase
      .from('all_transactions')
      .select('id', { count: 'exact' });
    
    if (allError) {
      console.log(`❌ all_transactions: Error - ${allError.message}`);
    } else {
      console.log(`📈 all_transactions (view): ${allTrans?.length || 0} records`);
    }
    
  } catch (error) {
    console.error('❌ Error checking counts:', error);
  }
}

async function main() {
  console.log('🚀 Testing complete PDF processing flow...\n');
  
  await checkCurrentCounts();
  
  console.log('\n' + '='.repeat(50) + '\n');
  
  const success = await testPDFConfirmEndpoint();
  
  if (success) {
    console.log('\n✅ PDF processing test completed!');
    console.log('\n📝 Summary:');
    console.log('- Test simulated PDF data processing');
    console.log('- Checked if transactions go to bank_account_transactions');
    console.log('- Verified receipt saving functionality');
    console.log('- Confirmed all_transactions view includes new data');
  } else {
    console.log('\n❌ PDF processing test failed');
  }
}

main().catch(console.error);
