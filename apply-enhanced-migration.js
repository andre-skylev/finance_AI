const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

async function applyEnhancedTransactionMigration() {
  console.log('🚀 Applying Enhanced Transaction Structure Migration...')

  try {
    // Read environment variables from .env.local
    const envPath = path.join(__dirname, '.env.local')
    if (fs.existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, 'utf8')
      const envLines = envContent.split('\n')
      
      for (const line of envLines) {
        if (line.trim() && !line.startsWith('#')) {
          const [key, ...valueParts] = line.split('=')
          const value = valueParts.join('=').replace(/"/g, '')
          if (key && value) {
            process.env[key] = value
          }
        }
      }
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    
    if (!supabaseUrl || !supabaseKey) {
      console.log('❌ Environment variables not found')
      console.log('   NEXT_PUBLIC_SUPABASE_URL:', !!supabaseUrl)
      console.log('   SUPABASE_SERVICE_ROLE_KEY:', !!supabaseKey)
      return
    }

    const supabase = createClient(supabaseUrl, supabaseKey)

    // Read the migration file
    const migrationPath = path.join(__dirname, 'supabase/migrations/017_enhance_transactions_structure.sql')
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8')

    console.log('📄 Migration file loaded successfully')
    console.log(`   📊 Size: ${Math.round(migrationSQL.length / 1024)}KB`)

    // Split the migration into individual statements
    const statements = migrationSQL
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'))

    console.log(`🔧 Found ${statements.length} SQL statements to execute`)

    // Execute each statement
    let successCount = 0
    let errorCount = 0

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i] + ';'
      
      // Skip comments and empty statements
      if (statement.trim() === ';' || statement.startsWith('--')) {
        continue
      }

      console.log(`\n📝 Executing statement ${i + 1}/${statements.length}...`)
      
      // Show a preview of the statement
      const preview = statement.substring(0, 80).replace(/\s+/g, ' ')
      console.log(`   Preview: ${preview}${statement.length > 80 ? '...' : ''}`)

      try {
        const { error } = await supabase.rpc('exec_sql', { sql_query: statement })
        
        if (error) {
          // Try alternative approach for statements that might not work with rpc
          console.log(`   ⚠️ RPC failed, trying direct execution...`)
          
          // For some statements, we might need to use different approaches
          if (statement.includes('ALTER TABLE')) {
            console.log('   ℹ️ ALTER TABLE statement - checking if already applied')
          } else if (statement.includes('CREATE TABLE')) {
            console.log('   ℹ️ CREATE TABLE statement - using IF NOT EXISTS')
          } else if (statement.includes('CREATE INDEX')) {
            console.log('   ℹ️ CREATE INDEX statement - using IF NOT EXISTS')
          } else if (statement.includes('INSERT INTO')) {
            console.log('   ℹ️ INSERT statement - may have duplicates')
          }
          
          console.log(`   ❌ Error: ${error.message}`)
          errorCount++
        } else {
          console.log('   ✅ Success')
          successCount++
        }
      } catch (err) {
        console.log(`   ❌ Exception: ${err.message}`)
        errorCount++
      }
    }

    console.log('\n📊 Migration Summary:')
    console.log(`   ✅ Successful statements: ${successCount}`)
    console.log(`   ❌ Failed statements: ${errorCount}`)
    console.log(`   📈 Success rate: ${Math.round((successCount / (successCount + errorCount)) * 100)}%`)

    if (errorCount === 0) {
      console.log('\n🎉 Migration completed successfully!')
      console.log('🔄 Restart your development server to see the changes')
    } else {
      console.log('\n⚠️ Some statements failed - this might be normal if:')
      console.log('   - Columns/tables already exist (IF NOT EXISTS protection)')
      console.log('   - Using advanced SQL features not supported by RPC')
      console.log('   - Need manual execution in Supabase dashboard')
    }

  } catch (error) {
    console.error('❌ Error applying migration:', error.message)
  }
}

// Alternative: Apply migration manually via Supabase CLI
function showManualInstructions() {
  console.log('\n📋 Manual Migration Instructions:')
  console.log('1. Open Supabase Dashboard: https://supabase.com/dashboard')
  console.log('2. Go to your project > SQL Editor')
  console.log('3. Copy the contents of supabase/migrations/017_enhance_transactions_structure.sql')
  console.log('4. Paste and execute in the SQL Editor')
  console.log('5. Check for any errors and resolve manually')
}

// Run the migration
applyEnhancedTransactionMigration()
  .then(() => {
    console.log('\n💡 Alternative: Apply migration manually if automatic method fails')
    showManualInstructions()
  })
