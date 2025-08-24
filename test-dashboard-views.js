// Test if dashboard views exist
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function testDashboardViews() {
  console.log('🔍 Testing dashboard views...');
  
  try {
    // Test if account_balances_view exists
    console.log('\n1️⃣ Testing account_balances_view...');
    const { data: accountsView, error: accountsError } = await supabase
      .from('account_balances_view')
      .select('*')
      .limit(1);
    
    if (accountsError) {
      console.error('❌ account_balances_view error:', accountsError.message);
      console.log('📋 Migration 002_add_dashboard_views.sql may not be applied');
    } else {
      console.log('✅ account_balances_view exists and accessible');
      console.log('📊 Columns available:', Object.keys(accountsView?.[0] || {}));
    }
    
    // Test other views
    console.log('\n2️⃣ Testing other dashboard views...');
    const viewTests = [
      'monthly_expenses_by_category',
      'monthly_cash_flow',
      'goals_progress_view',
      'budget_vs_actual'
    ];
    
    for (const viewName of viewTests) {
      try {
        const { error: viewError } = await supabase
          .from(viewName)
          .select('*')
          .limit(1);
        
        if (viewError) {
          console.log(`❌ ${viewName}: ${viewError.message}`);
        } else {
          console.log(`✅ ${viewName}: OK`);
        }
      } catch (e) {
        console.log(`❌ ${viewName}: ${e.message}`);
      }
    }
    
  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

testDashboardViews();
